import { DRIVER_IDLE_STATUS } from "../shared/constants.js";
import { formatDateTime, timeNow } from "../shared/dates.js";
import {
  deliveryIsLate,
  formatDeliveryDistance,
  getDeliveryRouteProgress,
  getDistanceMeters,
  getDeliveryStatus,
  isDeliveryTerminal,
  isDeliveryOrder,
  normalizeDeliveryLocationHistory,
  normalizeDeliveryLocationSample,
  normalizeDriverDeliveryStatus,
  normalizePickupStatus,
  RESTAURANT_COORDINATES,
  setDriverIdle,
  syncDriverWithDeliveryOrder
} from "../domain/delivery.js";
import { setTicketStatus } from "../domain/kitchen.js";
import { normalizeFulfillmentStatus, normalizeOrderOperationalStatus } from "../domain/orders.js";
import { getShiftAttendanceStatus, normalizeScheduleRole } from "../domain/scheduling.js";
import { saveState, state } from "./state.js";
import { applyPaidPaymentToOrder } from "./payment-ledger.js";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const ROUTE_REFRESH_DISTANCE_METERS = 250;

function roundedCoordinate(value) {
  return Number(Number(value).toFixed(6));
}

function simplifyRouteGeometry(points, maxPoints = 140) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function osrmInstruction(step) {
  const maneuver = step?.maneuver || {};
  const type = String(maneuver.type || "continue").replace(/_/g, " ");
  const modifier = String(maneuver.modifier || "").replace(/_/g, " ");
  const road = String(step?.name || "").replace(/\s+/g, " ").trim();
  const typeLabel = {
    depart: "Start",
    arrive: "Arrive",
    turn: "Turn",
    new_name: "Continue",
    continue: "Continue",
    merge: "Merge",
    ramp: "Take ramp",
    fork: "Keep",
    end_of_road: "At end of road",
    roundabout: "Use roundabout",
    rotary: "Use roundabout",
    notification: "Continue"
  }[type] || type.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  const direction = modifier ? ` ${modifier}` : "";
  const roadLabel = road ? ` on ${road}` : "";
  return `${typeLabel}${direction}${roadLabel}`.replace(/\s+/g, " ").trim();
}

export function createDeliveryRuntime(deps) {
  const {
    currentRoleKey,
    currentUser,
    isOrderPaid,
    orderById,
    render,
    showToast
  } = deps;
  const activeLocationWatches = new Map();
  const activeRouteRequests = new Map();

  function driverById(driverId) {
    return state.drivers.find((driver) => driver.id === driverId);
  }

  function driverMatchesUser(driver, user = currentUser()) {
    if (!driver || !user) return false;
    return driver.id === user.id || driver.name.split(" ")[0].toLowerCase() === user.name.split(" ")[0].toLowerCase();
  }

  function activeUserForDriver(driver) {
    if (!driver) return null;
    return state.users.find((user) => user.status === "Active" && user.role === "driver" && driverMatchesUser(driver, user)) || null;
  }

  function activeClockedDriverShift(driver) {
    const user = activeUserForDriver(driver);
    if (!user) return null;
    return state.staffShifts.find((shift) => {
      return shift.staffId === user.id
        && normalizeScheduleRole(shift.role, "") === "Driver"
        && Number(shift.clockInAtMs)
        && !Number(shift.clockOutAtMs);
    }) || null;
  }

  function getDriverAssignmentState(driver, order = null) {
    if (!driver) return { canAssign: false, label: "Unknown driver" };

    const assignedToThisOrder = Boolean(order?.id && driver.orderId === order.id);
    const busyOnAnotherOrder = Boolean(driver.orderId && driver.orderId !== order?.id);
    if (busyOnAnotherOrder || (driver.status !== DRIVER_IDLE_STATUS && !assignedToThisOrder)) {
      return { canAssign: false, label: `Busy - ${driver.status}` };
    }

    const user = activeUserForDriver(driver);
    if (!user) return { canAssign: false, label: "No active driver account" };

    const shift = activeClockedDriverShift(driver);
    const shiftLabel = shift ? getShiftAttendanceStatus(shift) : "Not clocked in";
    if (assignedToThisOrder) {
      return { canAssign: true, label: `Current order - ${shiftLabel}` };
    }
    if (!shift) return { canAssign: false, label: "Not clocked in" };
    if (shift.breakStartedAtMs) return { canAssign: false, label: "On break" };
    return { canAssign: true, label: shiftLabel };
  }

  function getAssignableDrivers(order = null) {
    return state.drivers.filter((driver) => getDriverAssignmentState(driver, order).canAssign);
  }

  function currentDriverRecord() {
    const user = currentUser();
    return state.drivers.find((driver) => driverMatchesUser(driver, user)) || null;
  }

  function canManageDeliveryOperations() {
    return ["owner_admin", "manager"].includes(currentRoleKey());
  }

  function currentUserCanUpdateDelivery(order) {
    if (!order || !isDeliveryOrder(order)) return false;
    if (canManageDeliveryOperations()) return true;
    const driver = driverById(order.assignedDriver);
    return currentRoleKey() === "driver" && driverMatchesUser(driver);
  }

  function deliveryDestination(order) {
    const base = String(order?.deliveryAddress || order?.address || order?.customerName || order?.customer || "").replace(/\s+/g, " ").trim();
    if (!base) return "Roermond, Netherlands";
    return /netherlands|nederland|roermond/i.test(base) ? base : `${base}, Roermond, Netherlands`;
  }

  function latestDeliveryOrigin(order) {
    return normalizeDeliveryLocationSample(order?.deliveryLastLocation)
      || normalizeDeliveryLocationSample(driverById(order?.assignedDriver)?.lastLocation)
      || { ...RESTAURANT_COORDINATES };
  }

  async function geocodeDeliveryDestination(order) {
    const destination = deliveryDestination(order);
    const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&addressdetails=0&accept-language=nl,en&q=${encodeURIComponent(destination)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Destination lookup failed");
    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat: roundedCoordinate(lat),
      lng: roundedCoordinate(lng),
      label: String(first?.display_name || destination).replace(/\s+/g, " ").trim()
    };
  }

  function routeNeedsRefresh(order, origin) {
    const route = order.deliveryRoute;
    if (!route?.geometry?.length || !route.origin || !route.destination) return true;
    if (getDistanceMeters(route.origin, origin) > ROUTE_REFRESH_DISTANCE_METERS) return true;
    return false;
  }

  async function fetchRoadRoute(origin, destination, label) {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${OSRM_ROUTE_URL}/${coordinates}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Road route failed");
    const payload = await response.json();
    const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
    const geometry = route?.geometry?.coordinates?.map((point) => ({
      lat: roundedCoordinate(point[1]),
      lng: roundedCoordinate(point[0])
    })) || [];
    if (geometry.length < 2) throw new Error("Road route was empty");

    const steps = (route.legs || [])
      .flatMap((leg) => leg.steps || [])
      .map((step) => ({
        instruction: osrmInstruction(step),
        distanceMeters: Math.round(Number(step.distance) || 0),
        durationSeconds: Math.round(Number(step.duration) || 0)
      }))
      .filter((step) => step.instruction)
      .slice(0, 8);

    return {
      source: "osrm",
      status: "Road route ready",
      origin,
      destination,
      destinationLabel: label,
      geometry: simplifyRouteGeometry(geometry),
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
      steps,
      fetchedAtMs: Date.now()
    };
  }

  function updateOrderRouteProgress(order) {
    const progress = getDeliveryRouteProgress(order.deliveryRoute?.geometry, order.deliveryLastLocation);
    if (!progress.distanceRemainingMeters && order.deliveryRoute?.distanceMeters && !order.deliveryLastLocation) {
      order.deliveryDistanceRemainingMeters = Math.round(order.deliveryRoute.distanceMeters);
      order.deliveryDistanceTraveledMeters = 0;
      order.deliveryRouteProgress = 0;
      order.deliveryEtaSeconds = Math.round(Number(order.deliveryRoute.durationSeconds) || 0);
      return;
    }

    order.deliveryRouteProgress = progress.percent;
    order.deliveryDistanceTraveledMeters = progress.distanceTraveledMeters;
    order.deliveryDistanceRemainingMeters = progress.distanceRemainingMeters;

    const routeDistance = Math.max(1, Number(order.deliveryRoute?.distanceMeters) || 0);
    const routeDuration = Math.max(0, Number(order.deliveryRoute?.durationSeconds) || 0);
    order.deliveryEtaSeconds = routeDuration && progress.distanceRemainingMeters
      ? Math.round(routeDuration * (progress.distanceRemainingMeters / routeDistance))
      : 0;
  }

  async function ensureDeliveryRoute(orderId, originOverride = null) {
    if (activeRouteRequests.has(orderId)) return activeRouteRequests.get(orderId);

    const request = (async () => {
      const order = orderById(orderId);
      if (!order || !isDeliveryOrder(order)) return null;

      const originSample = normalizeDeliveryLocationSample(originOverride) || latestDeliveryOrigin(order);
      const origin = {
        lat: roundedCoordinate(originSample.lat),
        lng: roundedCoordinate(originSample.lng)
      };

      if (!routeNeedsRefresh(order, origin)) return order.deliveryRoute;

      order.deliveryTrackingStatus = order.deliveryLastLocation ? "Building road route" : "Mapping destination";
      saveState();
      render();

      const destination = await geocodeDeliveryDestination(order);
      if (!destination) {
        const latestOrder = orderById(orderId);
        if (latestOrder) {
          latestOrder.deliveryRoute = {
            source: "pending",
            status: "Destination address not found",
            origin,
            destination: null,
            destinationLabel: deliveryDestination(latestOrder),
            geometry: [],
            distanceMeters: 0,
            durationSeconds: 0,
            steps: [],
            fetchedAtMs: Date.now()
          };
          latestOrder.deliveryTrackingStatus = "GPS active, address not mapped";
          saveState();
          render();
        }
        return null;
      }

      const route = await fetchRoadRoute(origin, destination, destination.label);
      const latestOrder = orderById(orderId);
      if (!latestOrder) return route;
      latestOrder.deliveryRoute = route;
      updateOrderRouteProgress(latestOrder);
      latestOrder.deliveryTrackingStatus = latestOrder.deliveryLastLocation ? "Live GPS active" : "Road route ready";
      syncDriverWithDeliveryOrder(driverById(latestOrder.assignedDriver), latestOrder);
      saveState();
      render();
      return route;
    })()
      .catch((error) => {
        const order = orderById(orderId);
        if (order) {
          order.deliveryTrackingStatus = "GPS active, route service unavailable";
          order.deliveryRoute = {
            source: "pending",
            status: error?.message || "Route unavailable",
            origin: latestDeliveryOrigin(order),
            destination: null,
            destinationLabel: deliveryDestination(order),
            geometry: [],
            distanceMeters: 0,
            durationSeconds: 0,
            steps: [],
            fetchedAtMs: Date.now()
          };
          saveState();
          render();
        }
        return null;
      })
      .finally(() => activeRouteRequests.delete(orderId));

    activeRouteRequests.set(orderId, request);
    return request;
  }

  function recordDriverLocation(orderId, position) {
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order) || ["Delivered", "Returned", "Cancelled"].includes(getDeliveryStatus(order) || order.status)) {
      stopDeliveryLocationWatch(orderId);
      return;
    }

    const sample = normalizeDeliveryLocationSample({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      heading: position.coords.heading,
      speedMetersPerSecond: position.coords.speed,
      atMs: position.timestamp || Date.now()
    });
    if (!sample) return;

    order.deliveryLastLocation = sample;
    order.deliveryLocationHistory = normalizeDeliveryLocationHistory([...(order.deliveryLocationHistory || []), sample]);
    order.deliveryTrackingStatus = `Live GPS ${formatDateTime(sample.atMs)}`;
    if (order.deliveryRoute?.geometry?.length) updateOrderRouteProgress(order);

    const driver = driverById(order.assignedDriver);
    if (driver) {
      driver.lastLocation = sample;
      driver.locationUpdatedAtMs = sample.atMs;
      syncDriverWithDeliveryOrder(driver, order);
      if (getDeliveryStatus(order) === "On the way" && !order.deliveryDistanceRemainingMeters) {
        driver.location = `GPS ${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`;
      }
    }

    saveState();
    render();
    void ensureDeliveryRoute(order.id, sample);
  }

  function stopDeliveryLocationWatch(orderId) {
    const watchId = activeLocationWatches.get(orderId);
    if (watchId !== undefined && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    activeLocationWatches.delete(orderId);
  }

  function startDeliveryLocationWatch(orderId) {
    if (activeLocationWatches.has(orderId)) return true;
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order)) return false;

    if (!navigator.geolocation) {
      order.deliveryTrackingStatus = "GPS unavailable in this browser";
      saveState();
      render();
      showToast("Live GPS is not available in this browser.");
      void ensureDeliveryRoute(orderId);
      return false;
    }

    order.deliveryTrackingStatus = "Waiting for GPS permission";
    saveState();
    render();

    const watchId = navigator.geolocation.watchPosition(
      (position) => recordDriverLocation(orderId, position),
      (error) => {
        const latestOrder = orderById(orderId);
        if (error.code === error.PERMISSION_DENIED) stopDeliveryLocationWatch(orderId);
        if (latestOrder) {
          latestOrder.deliveryTrackingStatus = error.code === error.PERMISSION_DENIED
            ? "Location permission denied"
            : "Waiting for GPS signal";
          saveState();
          render();
        }
        showToast(error.code === error.PERMISSION_DENIED ? "Allow location access to track the trip live." : "Trying to get a live GPS fix.");
        void ensureDeliveryRoute(orderId);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );

    activeLocationWatches.set(orderId, watchId);
    void ensureDeliveryRoute(orderId);
    return true;
  }

  function assignDriverToDeliveryOrder(order) {
    if (order.fulfillment !== "Delivery") return null;
    const requestedDriver = driverById(order.assignedDriver);
    const driver = requestedDriver && getDriverAssignmentState(requestedDriver, order).canAssign
      ? requestedDriver
      : getAssignableDrivers(order).find((candidate) => candidate.id !== order.assignedDriver);
    if (!driver) {
      order.assignedDriver = "";
      return null;
    }

    state.drivers.forEach((candidate) => {
      if (candidate.orderId === order.id && candidate.id !== driver.id) {
        candidate.status = "Available";
        candidate.orderId = null;
        candidate.eta = "-";
        candidate.location = "Restaurant";
      }
    });
    order.deliveryStatus = getDeliveryStatus(order) || "Assigned";
    order.pickupStatus = normalizePickupStatus(order.pickupStatus, order.deliveryStatus);
    order.fulfillmentStatus = "Scheduled";
    order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || Date.now();
    order.deliveryStatusUpdatedAtMs = order.deliveryStatusUpdatedAtMs || order.deliveryAssignedAtMs;
    order.assignedDriver = driver.id;
    syncDriverWithDeliveryOrder(driver, order);
    return driver;
  }

  function selectedDriverIdFromAction(orderId, action = null) {
    const root = action?.closest?.(".order-driver-reassign, .delivery-assignment-controls") || document;
    const scopedSelect = root.querySelector?.("[data-delivery-driver-select]") as HTMLSelectElement | null;
    if (scopedSelect) return scopedSelect.value;
    const checkedOption = root.querySelector?.("[data-order-driver-option]:checked") as HTMLInputElement | null;
    if (checkedOption) return checkedOption.value;

    const fallbackSelect = document.querySelector(`[data-delivery-driver-select="${orderId}"]`) as HTMLSelectElement | null;
    return fallbackSelect?.value || "";
  }

  function addDeliveryAssignmentNote(order, previousDriver, nextDriver) {
    const user = currentUser();
    const previousName = previousDriver?.name || "Unassigned";
    const nextName = nextDriver?.name || "Unassigned";
    const text = previousDriver
      ? `Driver reassigned from ${previousName} to ${nextName}.`
      : `Driver assigned to ${nextName}.`;
    order.deliveryNotes = [
      ...(order.deliveryNotes || []),
      {
        id: `DLV-NOTE-${Date.now()}`,
        text,
        authorId: user?.id || "",
        authorName: user?.name || "Dispatcher",
        at: timeNow(),
        atMs: Date.now()
      }
    ].slice(-12);
  }

  function assignDeliveryOrderToDriver(orderId, action = null) {
    if (!canManageDeliveryOperations()) {
      showToast("Only managers can assign deliveries.");
      return;
    }

    const order = orderById(orderId);
    if (!order || !isDeliveryOrder(order)) {
      showToast("Choose a delivery order to assign.");
      return;
    }
    if (order.status === "Cancelled" || isDeliveryTerminal(order)) {
      showToast(`Order #${order.number} cannot be reassigned from its current delivery status.`);
      return;
    }

    const driver = driverById(selectedDriverIdFromAction(orderId, action));
    if (!driver) {
      showToast("Choose a driver for this delivery.");
      return;
    }

    const assignmentState = getDriverAssignmentState(driver, order);
    if (!assignmentState.canAssign) {
      showToast(`${driver.name} is not available: ${assignmentState.label.toLowerCase()}.`);
      return;
    }
    if (order.assignedDriver === driver.id) {
      showToast(`${driver.name} is already assigned to order #${order.number}.`);
      return;
    }

    const previousDriver = driverById(order.assignedDriver);
    const now = Date.now();
    state.drivers.forEach((candidate) => {
      if (candidate.orderId === order.id && candidate.id !== driver.id) setDriverIdle(candidate);
    });
    order.assignedDriver = driver.id;
    order.deliveryStatus = getDeliveryStatus(order) || "Assigned";
    order.pickupStatus = normalizePickupStatus(order.pickupStatus, order.deliveryStatus);
    order.deliveryAssignedAtMs = now;
    order.deliveryStatusUpdatedAtMs = now;
    addDeliveryAssignmentNote(order, previousDriver, driver);
    syncDriverWithDeliveryOrder(driver, order);
    saveState();
    render();
    showToast(`Order #${order.number} ${previousDriver ? "reassigned" : "assigned"} to ${driver.name}.`);
  }

  function updateDeliveryStatus(orderId, status, options: any = {}) {
    const order = orderById(orderId);
    const nextStatus = normalizeDriverDeliveryStatus(status);
    if (!order || !nextStatus || !currentUserCanUpdateDelivery(order)) {
      showToast("This role cannot update that delivery.");
      return;
    }

    const wasLate = deliveryIsLate(order);
    const now = Date.now();
    const nowText = timeNow();
    order.deliveryStatus = nextStatus;
    order.deliveryStatusUpdatedAtMs = now;
    order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || now;
    order.pickupStatus = normalizePickupStatus(order.pickupStatus, nextStatus);

    if (nextStatus === "At restaurant") order.pickupStatus = "At restaurant";
    if (["Picked up", "On the way", "Delivered", "Failed delivery"].includes(nextStatus)) order.pickupStatus = "Picked up";
    if (["Picked up", "On the way", "Delivered"].includes(nextStatus)) order.fulfillmentStatus = normalizeFulfillmentStatus(nextStatus);
    if (nextStatus === "On the way") {
      order.deliveryTripStartedAt = order.deliveryTripStartedAt || nowText;
      order.deliveryTripStartedAtMs = order.deliveryTripStartedAtMs || now;
      order.deliveryTrackingStatus = order.deliveryTrackingStatus || "Starting live GPS";
    }
    if (nextStatus === "Delivered") {
      order.deliveredAt = nowText;
      order.deliveredAtMs = now;
      order.deliveryWasLate = order.deliveryWasLate || wasLate;
      order.deliveryTripEndedAt = order.deliveryTripEndedAt || nowText;
      order.deliveryTripEndedAtMs = order.deliveryTripEndedAtMs || now;
      order.deliveryTrackingStatus = "Arrived";
      order.deliveryRouteProgress = 100;
      order.deliveryDistanceRemainingMeters = 0;
      order.deliveryEtaSeconds = 0;
      state.tickets
        .filter((ticket) => ticket.orderId === order.id)
        .forEach((ticket) => setTicketStatus(ticket, "Done"));
      order.status = isOrderPaid(order) ? "Paid" : "Served";
      order.operationalStatus = normalizeOrderOperationalStatus(order.status);
      order.fulfillmentStatus = "Delivered";
    }
    if (nextStatus === "Failed delivery") {
      order.failedAt = nowText;
      order.failedAtMs = now;
      order.deliveryTripEndedAt = order.deliveryTripEndedAt || nowText;
      order.deliveryTripEndedAtMs = order.deliveryTripEndedAtMs || now;
      order.deliveryTrackingStatus = "Delivery stopped";
    }
    if (nextStatus === "Returned") {
      order.returnedAt = nowText;
      order.returnedAtMs = now;
      order.deliveryWasLate = order.deliveryWasLate || wasLate;
      order.deliveryTripEndedAt = order.deliveryTripEndedAt || nowText;
      order.deliveryTripEndedAtMs = order.deliveryTripEndedAtMs || now;
      order.deliveryTrackingStatus = "Returned";
      order.pickupStatus = "Returned";
      if (!isOrderPaid(order)) order.status = "Cancelled";
      order.operationalStatus = normalizeOrderOperationalStatus(order.status);
      order.fulfillmentStatus = "Cancelled";
    }

    const driver = driverById(order.assignedDriver);
    syncDriverWithDeliveryOrder(driver, order);
    if (["Delivered", "Failed delivery", "Returned"].includes(nextStatus)) stopDeliveryLocationWatch(order.id);
    saveState();
    render();
    if (nextStatus === "On the way" && options.startTracking !== false) startDeliveryLocationWatch(order.id);
    if (!options.silent) showToast(`Delivery #${order.number} marked ${nextStatus.toLowerCase()}.`);
  }

  function startDeliveryTrip(orderId) {
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order)) {
      showToast("This role cannot start that trip.");
      return;
    }
    if (!order.assignedDriver) {
      showToast("Assign a driver before starting a live trip.");
      return;
    }

    const currentStatus = getDeliveryStatus(order) || "Assigned";
    if (currentStatus !== "On the way") {
      updateDeliveryStatus(orderId, "On the way", { silent: true, startTracking: false });
    }

    const latestOrder = orderById(orderId);
    if (latestOrder) {
      latestOrder.deliveryTripStartedAt = latestOrder.deliveryTripStartedAt || timeNow();
      latestOrder.deliveryTripStartedAtMs = latestOrder.deliveryTripStartedAtMs || Date.now();
      latestOrder.deliveryTrackingStatus = "Starting live GPS";
      saveState();
      render();
    }

    startDeliveryLocationWatch(orderId);
    showToast(`Live trip started for order #${order.number}.`);
  }

  function markDeliveryCashCollected(orderId) {
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order)) {
      showToast("This role cannot record delivery cash.");
      return;
    }
    if (isOrderPaid(order)) {
      showToast(`Order #${order.number} is already paid.`);
      return;
    }

    const user = currentUser();
    const now = Date.now();
    const nowText = timeNow();
    order.cashCollected = true;
    order.cashCollectedAt = nowText;
    order.cashCollectedAtMs = now;
    order.cashCollectedByName = user?.name || "Driver";
    applyPaidPaymentToOrder(order, {
      provider: "cash",
      paymentMethod: "Cash",
      paymentProcessor: "Cash",
      paidAt: nowText,
      paidAtMs: now,
      paidByUserId: user?.id || order.paidByUserId || "",
      paidByName: user?.name || order.paidByName || "Driver",
      captureMode: "staff_recorded"
    });
    if (order.status === "Served" || getDeliveryStatus(order) === "Delivered") order.status = "Paid";
    order.operationalStatus = normalizeOrderOperationalStatus(order.status);
    order.fulfillmentStatus = normalizeFulfillmentStatus(order.fulfillmentStatus || order.status);
    saveState();
    render();
    showToast(`Cash collected for order #${order.number}.`);
  }

  function addDeliveryNote(orderId) {
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order)) {
      showToast("This role cannot add a delivery note.");
      return;
    }

    const input = document.querySelector(`[data-delivery-note-input="${orderId}"]`) as HTMLInputElement | null;
    const text = String(input?.value || "").replace(/\s+/g, " ").trim();
    if (!text) {
      showToast("Add a note before saving.");
      return;
    }

    const user = currentUser();
    order.deliveryNotes = [
      ...(order.deliveryNotes || []),
      {
        id: `DLV-NOTE-${Date.now()}`,
        text,
        authorId: user?.id || "",
        authorName: user?.name || "Driver",
        at: timeNow(),
        atMs: Date.now()
      }
    ].slice(-12);
    saveState();
    render();
    showToast("Delivery note added.");
  }

  function uploadDeliveryProof(orderId) {
    const order = orderById(orderId);
    if (!order || !currentUserCanUpdateDelivery(order)) {
      showToast("This role cannot upload delivery proof.");
      return;
    }

    const input = document.querySelector(`[data-delivery-proof-input="${orderId}"]`) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      showToast("Choose a photo before uploading.");
      return;
    }

    order.deliveryProofPhotoName = file.name;
    order.deliveryProofAtMs = Date.now();
    order.deliveryProofByName = currentUser()?.name || "Driver";
    saveState();
    render();
    showToast("Delivery proof saved.");
  }

  return {
    addDeliveryNote,
    assignDeliveryOrderToDriver,
    assignDriverToDeliveryOrder,
    canManageDeliveryOperations,
    currentDriverRecord,
    currentUserCanUpdateDelivery,
    driverById,
    getAssignableDrivers,
    getDriverAssignmentState,
    markDeliveryCashCollected,
    startDeliveryTrip,
    updateDeliveryStatus,
    uploadDeliveryProof
  };
}

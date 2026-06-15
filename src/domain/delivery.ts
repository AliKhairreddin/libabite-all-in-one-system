import {
  DELIVERY_LATE_MINUTES,
  DELIVERY_STATUS_ETA_MINUTES,
  DRIVER_DELIVERY_STATUSES,
  DRIVER_IDLE_STATUS,
  DRIVER_TERMINAL_DELIVERY_STATUSES,
  MINUTE_MS
} from "../shared/constants.js";
import { formatDuration, normalizeOptionalTimestamp } from "../shared/dates.js";

const EARTH_RADIUS_METERS = 6371000;

export const RESTAURANT_COORDINATES = {
  lat: 51.1949,
  lng: 5.9878
};

export function normalizeDriverDeliveryStatus(status) {
  const legacyMap = {
    "On route": "On the way"
  };
  const candidate = legacyMap[String(status || "").trim()] || String(status || "").trim();
  return DRIVER_DELIVERY_STATUSES.includes(candidate) ? candidate : "";
}

export function normalizeDriverStatus(status) {
  const deliveryStatus = normalizeDriverDeliveryStatus(status);
  if (deliveryStatus) return deliveryStatus;
  return DRIVER_IDLE_STATUS;
}

export function normalizePickupStatus(status, deliveryStatus = "") {
  const candidate = normalizeDriverDeliveryStatus(status);
  if (candidate) return candidate;
  if (["Picked up", "On the way", "Delivered", "Failed delivery"].includes(deliveryStatus)) return "Picked up";
  if (deliveryStatus === "Returned") return "Returned";
  if (deliveryStatus === "At restaurant") return "At restaurant";
  return deliveryStatus ? "Assigned" : "";
}

export function getDeliveryStatus(order) {
  if (order?.fulfillment !== "Delivery") return "";
  return normalizeDriverDeliveryStatus(order.deliveryStatus) || (order.assignedDriver ? "Assigned" : "");
}

export function isDeliveryOrder(order) {
  return order?.fulfillment === "Delivery";
}

export function isDeliveryTerminal(order) {
  return DRIVER_TERMINAL_DELIVERY_STATUSES.includes(getDeliveryStatus(order));
}

export function isActiveDelivery(order) {
  return isDeliveryOrder(order)
    && !isDeliveryTerminal(order)
    && order.status !== "Cancelled"
    && Boolean(order.assignedDriver);
}

function parseTodayClockTimeToTimestamp(time) {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const timestamp = new Date();
  timestamp.setHours(hours, minutes, 0, 0);
  return timestamp.getTime();
}

export function getDeliveryAgeMinutes(order) {
  const reference = normalizeOptionalTimestamp(order?.deliveryAssignedAtMs)
    || normalizeOptionalTimestamp(order?.sentAtMs)
    || normalizeOptionalTimestamp(order?.createdAtMs)
    || Date.now();
  return Math.max(0, Math.floor((Date.now() - reference) / MINUTE_MS));
}

export function getDeliveryLateMinutes(order) {
  if (!isActiveDelivery(order)) return 0;
  const requestedAtMs = parseTodayClockTimeToTimestamp(order.requestedTime);
  const requestedLateMinutes = requestedAtMs ? Math.floor((Date.now() - requestedAtMs) / MINUTE_MS) : 0;
  const ageLateMinutes = getDeliveryAgeMinutes(order) - DELIVERY_LATE_MINUTES;
  return Math.max(0, requestedLateMinutes, ageLateMinutes);
}

export function deliveryIsLate(order) {
  return getDeliveryLateMinutes(order) > 0;
}

export function getDeliveryEtaMinutes(order) {
  const status = getDeliveryStatus(order);
  if (!status || DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status) || status === "Failed delivery") return 0;
  const baseMinutes = DELIVERY_STATUS_ETA_MINUTES[status] ?? DELIVERY_STATUS_ETA_MINUTES.Assigned;
  const updatedAtMs = normalizeOptionalTimestamp(order.deliveryStatusUpdatedAtMs)
    || normalizeOptionalTimestamp(order.deliveryAssignedAtMs)
    || Date.now();
  const elapsed = Math.floor((Date.now() - updatedAtMs) / MINUTE_MS);
  const floor = status === "Assigned" || status === "At restaurant" ? 8 : 3;
  return Math.max(floor, baseMinutes - Math.max(0, elapsed));
}

export function formatDeliveryEta(order) {
  const status = getDeliveryStatus(order);
  if (!order.assignedDriver) return "Unassigned";
  if (status === "Failed delivery") return "Return pending";
  if (status === "Delivered") return "Delivered";
  if (status === "Returned") return "Returned";
  const lateMinutes = getDeliveryLateMinutes(order);
  if (lateMinutes > 0) return `Late ${formatDuration(lateMinutes)}`;
  return `${getDeliveryEtaMinutes(order)} min`;
}

export function formatCustomerDeliveryEta(order) {
  const status = getDeliveryStatus(order);
  if (status === "Delivered") return "Delivered";
  if (status === "Returned") return "Returned";
  if (status === "Failed delivery") return "Delivery issue";
  if (!order?.assignedDriver) return "ETA after confirmation";
  return formatDeliveryEta(order);
}

export function getDeliveryLocationForStatus(order, status = getDeliveryStatus(order)) {
  const address = String(order?.deliveryAddress || "").trim();
  const shortAddress = address.split(",")[0] || "customer";
  if (status === "At restaurant" || status === "Assigned") return "Restaurant";
  if (status === "Picked up") return "Leaving restaurant";
  if (status === "On the way") return `Route to ${shortAddress}`;
  if (status === "Failed delivery") return address || "Customer address";
  return "Restaurant";
}

export function deliveryStatusClass(status) {
  if (status === "Delivered") return "ok";
  if (status === "Failed delivery" || status === "Returned") return "danger";
  if (status === "Assigned") return "warning";
  return "info";
}

export function normalizeDeliveryCoordinate(value, min, max) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

export function normalizeDeliveryCoordinates(value) {
  if (!value || typeof value !== "object") return null;
  const lat = normalizeDeliveryCoordinate(value.lat ?? value.latitude, -90, 90);
  const lng = normalizeDeliveryCoordinate(value.lng ?? value.lon ?? value.longitude, -180, 180);
  return lat === null || lng === null ? null : { lat, lng };
}

export function normalizeDeliveryLocationSample(value) {
  const coordinates = normalizeDeliveryCoordinates(value);
  if (!coordinates) return null;
  const atMs = normalizeOptionalTimestamp(value.atMs) || Date.now();
  const accuracyMeters = Math.max(0, Math.round(Number(value.accuracyMeters ?? value.accuracy) || 0));
  const heading = Number(value.heading);
  const speedMetersPerSecond = Number(value.speedMetersPerSecond ?? value.speed);

  return {
    ...coordinates,
    accuracyMeters,
    heading: Number.isFinite(heading) && heading >= 0 ? Math.round(heading) : "",
    speedMetersPerSecond: Number.isFinite(speedMetersPerSecond) && speedMetersPerSecond >= 0 ? speedMetersPerSecond : "",
    atMs
  };
}

export function normalizeDeliveryLocationHistory(history, limit = 120) {
  return (Array.isArray(history) ? history : [])
    .map(normalizeDeliveryLocationSample)
    .filter(Boolean)
    .sort((first, second) => first.atMs - second.atMs)
    .slice(-limit);
}

export function normalizeDeliveryRoute(route) {
  if (!route || typeof route !== "object") return null;
  const origin = normalizeDeliveryCoordinates(route.origin);
  const destination = normalizeDeliveryCoordinates(route.destination);
  const geometry = (Array.isArray(route.geometry) ? route.geometry : [])
    .map(normalizeDeliveryCoordinates)
    .filter(Boolean)
    .slice(0, 180);
  const distanceMeters = Math.max(0, Math.round(Number(route.distanceMeters) || getRouteDistanceMeters(geometry)));
  const durationSeconds = Math.max(0, Math.round(Number(route.durationSeconds) || 0));
  const steps = (Array.isArray(route.steps) ? route.steps : [])
    .map((step) => ({
      instruction: String(step?.instruction || "").replace(/\s+/g, " ").trim(),
      distanceMeters: Math.max(0, Math.round(Number(step?.distanceMeters) || 0)),
      durationSeconds: Math.max(0, Math.round(Number(step?.durationSeconds) || 0))
    }))
    .filter((step) => step.instruction)
    .slice(0, 8);

  return {
    source: String(route.source || "estimated").trim() || "estimated",
    status: String(route.status || "").replace(/\s+/g, " ").trim(),
    origin,
    destination,
    destinationLabel: String(route.destinationLabel || "").replace(/\s+/g, " ").trim(),
    geometry,
    distanceMeters,
    durationSeconds,
    steps,
    fetchedAtMs: normalizeOptionalTimestamp(route.fetchedAtMs)
  };
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

export function getDistanceMeters(first, second) {
  const start = normalizeDeliveryCoordinates(first);
  const end = normalizeDeliveryCoordinates(second);
  if (!start || !end) return 0;

  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getRouteDistanceMeters(points) {
  const normalized = (Array.isArray(points) ? points : [])
    .map(normalizeDeliveryCoordinates)
    .filter(Boolean);
  return normalized.reduce((distance, point, index) => {
    if (index === 0) return distance;
    return distance + getDistanceMeters(normalized[index - 1], point);
  }, 0);
}

function pointToPlanarMeters(point, origin) {
  const latMeters = 111320;
  const lngMeters = 111320 * Math.cos(toRadians(origin.lat));
  return {
    x: (point.lng - origin.lng) * lngMeters,
    y: (point.lat - origin.lat) * latMeters
  };
}

export function getDeliveryRouteProgress(routeGeometry, currentLocation) {
  const current = normalizeDeliveryCoordinates(currentLocation);
  const geometry = (Array.isArray(routeGeometry) ? routeGeometry : [])
    .map(normalizeDeliveryCoordinates)
    .filter(Boolean);

  if (!current || geometry.length < 2) {
    return {
      percent: 0,
      distanceTraveledMeters: 0,
      distanceRemainingMeters: 0,
      distanceToRouteMeters: 0
    };
  }

  const totalDistance = getRouteDistanceMeters(geometry);
  let distanceBeforeSegment = 0;
  let bestDistanceToRoute = Number.POSITIVE_INFINITY;
  let bestDistanceTraveled = 0;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    const segmentDistance = getDistanceMeters(start, end);
    if (!segmentDistance) continue;

    const startPlanar = pointToPlanarMeters(start, start);
    const endPlanar = pointToPlanarMeters(end, start);
    const currentPlanar = pointToPlanarMeters(current, start);
    const segmentX = endPlanar.x - startPlanar.x;
    const segmentY = endPlanar.y - startPlanar.y;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const rawRatio = segmentLengthSquared
      ? ((currentPlanar.x - startPlanar.x) * segmentX + (currentPlanar.y - startPlanar.y) * segmentY) / segmentLengthSquared
      : 0;
    const ratio = Math.max(0, Math.min(1, rawRatio));
    const projected = {
      x: startPlanar.x + segmentX * ratio,
      y: startPlanar.y + segmentY * ratio
    };
    const distanceToRoute = Math.hypot(currentPlanar.x - projected.x, currentPlanar.y - projected.y);

    if (distanceToRoute < bestDistanceToRoute) {
      bestDistanceToRoute = distanceToRoute;
      bestDistanceTraveled = distanceBeforeSegment + segmentDistance * ratio;
    }

    distanceBeforeSegment += segmentDistance;
  }

  const distanceTraveledMeters = Math.max(0, Math.min(totalDistance, bestDistanceTraveled));
  const distanceRemainingMeters = Math.max(0, totalDistance - distanceTraveledMeters);

  return {
    percent: totalDistance ? Math.round((distanceTraveledMeters / totalDistance) * 100) : 0,
    distanceTraveledMeters: Math.round(distanceTraveledMeters),
    distanceRemainingMeters: Math.round(distanceRemainingMeters),
    distanceToRouteMeters: Number.isFinite(bestDistanceToRoute) ? Math.round(bestDistanceToRoute) : 0
  };
}

export function formatDeliveryDistance(meters) {
  const distance = Math.max(0, Math.round(Number(meters) || 0));
  if (distance < 50) return "<50 m";
  if (distance < 1000) return `${Math.round(distance / 10) * 10} m`;
  return `${(distance / 1000).toFixed(distance < 10000 ? 1 : 0)} km`;
}

export function setDriverIdle(driver) {
  if (!driver) return;
  driver.status = DRIVER_IDLE_STATUS;
  driver.orderId = null;
  driver.eta = "-";
  driver.location = "Restaurant";
}

export function syncDriverWithDeliveryOrder(driver, order) {
  if (!driver || !order) return;
  const status = getDeliveryStatus(order) || "Assigned";
  if (DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status)) {
    setDriverIdle(driver);
    return;
  }
  driver.status = status;
  driver.orderId = order.id;
  driver.eta = formatDeliveryEta(order);
  if (status === "On the way" && Number(order.deliveryDistanceRemainingMeters) > 0) {
    driver.location = `${formatDeliveryDistance(order.deliveryDistanceRemainingMeters)} from customer`;
  } else if (status === "On the way" && order.deliveryLastLocation) {
    driver.location = "Live GPS active";
  } else {
    driver.location = getDeliveryLocationForStatus(order, status);
  }
}

export function reconcileDeliveryAssignments(appState) {
  const driverMap = new Map((appState.drivers || []).map((driver) => [driver.id, driver]));
  const activeOrderIds = new Set();

  (appState.orders || []).forEach((order) => {
    if (order.fulfillment !== "Delivery") return;
    const status = normalizeDriverDeliveryStatus(order.deliveryStatus) || (order.assignedDriver ? "Assigned" : "");
    order.deliveryStatus = status;
    order.pickupStatus = normalizePickupStatus(order.pickupStatus, status);
    if (!order.assignedDriver || !driverMap.has(order.assignedDriver)) {
      order.assignedDriver = "";
      return;
    }
    if (DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status)) return;
    if (order.status === "Cancelled") return;
    activeOrderIds.add(order.id);
  });

  (appState.drivers || []).forEach((driver) => {
    if (driver.orderId && !activeOrderIds.has(driver.orderId)) setDriverIdle(driver);
  });

  (appState.orders || []).forEach((order) => {
    if (!order.assignedDriver || !activeOrderIds.has(order.id)) return;
    const driver = driverMap.get(order.assignedDriver);
    if (driver) syncDriverWithDeliveryOrder(driver, order);
  });
}

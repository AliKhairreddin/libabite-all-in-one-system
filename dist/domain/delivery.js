import { DELIVERY_LATE_MINUTES, DELIVERY_STATUS_ETA_MINUTES, DRIVER_DELIVERY_STATUSES, DRIVER_IDLE_STATUS, DRIVER_TERMINAL_DELIVERY_STATUSES, MINUTE_MS } from "../shared/constants.js";
import { formatDuration, normalizeOptionalTimestamp } from "../shared/dates.js";
export function normalizeDriverDeliveryStatus(status) {
    const legacyMap = {
        "On route": "On the way"
    };
    const candidate = legacyMap[String(status || "").trim()] || String(status || "").trim();
    return DRIVER_DELIVERY_STATUSES.includes(candidate) ? candidate : "";
}
export function normalizeDriverStatus(status) {
    const deliveryStatus = normalizeDriverDeliveryStatus(status);
    if (deliveryStatus)
        return deliveryStatus;
    return DRIVER_IDLE_STATUS;
}
export function normalizePickupStatus(status, deliveryStatus = "") {
    const candidate = normalizeDriverDeliveryStatus(status);
    if (candidate)
        return candidate;
    if (["Picked up", "On the way", "Delivered", "Failed delivery"].includes(deliveryStatus))
        return "Picked up";
    if (deliveryStatus === "Returned")
        return "Returned";
    if (deliveryStatus === "At restaurant")
        return "At restaurant";
    return deliveryStatus ? "Assigned" : "";
}
export function getDeliveryStatus(order) {
    if (order?.fulfillment !== "Delivery")
        return "";
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
    if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        return null;
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
    if (!isActiveDelivery(order))
        return 0;
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
    if (!status || DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status) || status === "Failed delivery")
        return 0;
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
    if (!order.assignedDriver)
        return "Unassigned";
    if (status === "Failed delivery")
        return "Return pending";
    if (status === "Delivered")
        return "Delivered";
    if (status === "Returned")
        return "Returned";
    const lateMinutes = getDeliveryLateMinutes(order);
    if (lateMinutes > 0)
        return `Late ${formatDuration(lateMinutes)}`;
    return `${getDeliveryEtaMinutes(order)} min`;
}
export function getDeliveryLocationForStatus(order, status = getDeliveryStatus(order)) {
    const address = String(order?.deliveryAddress || "").trim();
    const shortAddress = address.split(",")[0] || "customer";
    if (status === "At restaurant" || status === "Assigned")
        return "Restaurant";
    if (status === "Picked up")
        return "Leaving restaurant";
    if (status === "On the way")
        return `Route to ${shortAddress}`;
    if (status === "Failed delivery")
        return address || "Customer address";
    return "Restaurant";
}
export function deliveryStatusClass(status) {
    if (status === "Delivered")
        return "ok";
    if (status === "Failed delivery" || status === "Returned")
        return "danger";
    if (status === "Assigned")
        return "warning";
    return "info";
}
export function setDriverIdle(driver) {
    if (!driver)
        return;
    driver.status = DRIVER_IDLE_STATUS;
    driver.orderId = null;
    driver.eta = "-";
    driver.location = "Restaurant";
}
export function syncDriverWithDeliveryOrder(driver, order) {
    if (!driver || !order)
        return;
    const status = getDeliveryStatus(order) || "Assigned";
    if (DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status)) {
        setDriverIdle(driver);
        return;
    }
    driver.status = status;
    driver.orderId = order.id;
    driver.eta = formatDeliveryEta(order);
    driver.location = getDeliveryLocationForStatus(order, status);
}
export function reconcileDeliveryAssignments(appState) {
    const driverMap = new Map((appState.drivers || []).map((driver) => [driver.id, driver]));
    const activeOrderIds = new Set();
    (appState.orders || []).forEach((order) => {
        if (order.fulfillment !== "Delivery")
            return;
        const status = normalizeDriverDeliveryStatus(order.deliveryStatus) || (order.assignedDriver ? "Assigned" : "");
        order.deliveryStatus = status;
        order.pickupStatus = normalizePickupStatus(order.pickupStatus, status);
        if (!order.assignedDriver || !driverMap.has(order.assignedDriver)) {
            order.assignedDriver = "";
            return;
        }
        if (DRIVER_TERMINAL_DELIVERY_STATUSES.includes(status))
            return;
        if (order.status === "Cancelled")
            return;
        activeOrderIds.add(order.id);
    });
    (appState.drivers || []).forEach((driver) => {
        if (driver.orderId && !activeOrderIds.has(driver.orderId))
            setDriverIdle(driver);
    });
    (appState.orders || []).forEach((order) => {
        if (!order.assignedDriver || !activeOrderIds.has(order.id))
            return;
        const driver = driverMap.get(order.assignedDriver);
        if (driver)
            syncDriverWithDeliveryOrder(driver, order);
    });
}
//# sourceMappingURL=delivery.js.map
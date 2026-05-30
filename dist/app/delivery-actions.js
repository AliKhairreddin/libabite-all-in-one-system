import { DRIVER_IDLE_STATUS } from "../shared/constants.js";
import { timeNow } from "../shared/dates.js";
import { deliveryIsLate, getDeliveryStatus, isDeliveryOrder, normalizeDriverDeliveryStatus, normalizePickupStatus, setDriverIdle, syncDriverWithDeliveryOrder } from "../domain/delivery.js";
import { setTicketStatus } from "../domain/kitchen.js";
import { saveState, state } from "./state.js";
export function createDeliveryRuntime(deps) {
    const { currentRoleKey, currentUser, isOrderPaid, orderById, render, showToast } = deps;
    function driverById(driverId) {
        return state.drivers.find((driver) => driver.id === driverId);
    }
    function driverMatchesUser(driver, user = currentUser()) {
        if (!driver || !user)
            return false;
        return driver.id === user.id || driver.name.split(" ")[0].toLowerCase() === user.name.split(" ")[0].toLowerCase();
    }
    function currentDriverRecord() {
        const user = currentUser();
        return state.drivers.find((driver) => driverMatchesUser(driver, user)) || null;
    }
    function canManageDeliveryOperations() {
        return ["owner_admin", "manager"].includes(currentRoleKey());
    }
    function currentUserCanUpdateDelivery(order) {
        if (!order || !isDeliveryOrder(order))
            return false;
        if (canManageDeliveryOperations())
            return true;
        const driver = driverById(order.assignedDriver);
        return currentRoleKey() === "driver" && driverMatchesUser(driver);
    }
    function assignDriverToDeliveryOrder(order) {
        if (order.fulfillment !== "Delivery")
            return null;
        const requestedDriver = driverById(order.assignedDriver);
        const driver = requestedDriver && (requestedDriver.status === "Available" || requestedDriver.orderId === order.id)
            ? requestedDriver
            : state.drivers.find((candidate) => candidate.status === "Available");
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
        order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || Date.now();
        order.deliveryStatusUpdatedAtMs = order.deliveryStatusUpdatedAtMs || order.deliveryAssignedAtMs;
        order.assignedDriver = driver.id;
        syncDriverWithDeliveryOrder(driver, order);
        return driver;
    }
    function assignDeliveryOrderToDriver(orderId) {
        if (!canManageDeliveryOperations()) {
            showToast("Only managers can assign deliveries.");
            return;
        }
        const order = orderById(orderId);
        if (!order || !isDeliveryOrder(order)) {
            showToast("Choose a delivery order to assign.");
            return;
        }
        const select = document.querySelector(`[data-delivery-driver-select="${orderId}"]`);
        const driver = driverById(select?.value);
        if (!driver) {
            showToast("Choose a driver for this delivery.");
            return;
        }
        if (driver.status !== DRIVER_IDLE_STATUS && driver.orderId !== order.id) {
            showToast(`${driver.name} already has an active delivery.`);
            return;
        }
        state.drivers.forEach((candidate) => {
            if (candidate.orderId === order.id && candidate.id !== driver.id)
                setDriverIdle(candidate);
        });
        order.assignedDriver = driver.id;
        order.deliveryStatus = getDeliveryStatus(order) || "Assigned";
        order.pickupStatus = normalizePickupStatus(order.pickupStatus, order.deliveryStatus);
        order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || Date.now();
        order.deliveryStatusUpdatedAtMs = Date.now();
        syncDriverWithDeliveryOrder(driver, order);
        saveState();
        render();
        showToast(`Order #${order.number} assigned to ${driver.name}.`);
    }
    function updateDeliveryStatus(orderId, status) {
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
        if (nextStatus === "At restaurant")
            order.pickupStatus = "At restaurant";
        if (["Picked up", "On the way", "Delivered", "Failed delivery"].includes(nextStatus))
            order.pickupStatus = "Picked up";
        if (nextStatus === "Delivered") {
            order.deliveredAt = nowText;
            order.deliveredAtMs = now;
            order.deliveryWasLate = order.deliveryWasLate || wasLate;
            state.tickets
                .filter((ticket) => ticket.orderId === order.id)
                .forEach((ticket) => setTicketStatus(ticket, "Done"));
            order.status = isOrderPaid(order) ? "Paid" : "Served";
        }
        if (nextStatus === "Failed delivery") {
            order.failedAt = nowText;
            order.failedAtMs = now;
        }
        if (nextStatus === "Returned") {
            order.returnedAt = nowText;
            order.returnedAtMs = now;
            order.deliveryWasLate = order.deliveryWasLate || wasLate;
            order.pickupStatus = "Returned";
            if (!isOrderPaid(order))
                order.status = "Cancelled";
        }
        const driver = driverById(order.assignedDriver);
        syncDriverWithDeliveryOrder(driver, order);
        saveState();
        render();
        showToast(`Delivery #${order.number} marked ${nextStatus.toLowerCase()}.`);
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
        order.paymentStatus = "Paid";
        order.paymentMethod = "Cash";
        order.paidAt = order.paidAt || nowText;
        order.paidAtMs = order.paidAtMs || now;
        order.paidByUserId = user?.id || order.paidByUserId || "";
        order.paidByName = user?.name || order.paidByName || "Driver";
        if (order.status === "Served" || getDeliveryStatus(order) === "Delivered")
            order.status = "Paid";
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
        const input = document.querySelector(`[data-delivery-note-input="${orderId}"]`);
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
        const input = document.querySelector(`[data-delivery-proof-input="${orderId}"]`);
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
        markDeliveryCashCollected,
        updateDeliveryStatus,
        uploadDeliveryProof
    };
}
//# sourceMappingURL=delivery-actions.js.map
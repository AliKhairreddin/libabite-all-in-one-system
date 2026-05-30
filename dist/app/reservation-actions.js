import { saveState, state } from "./state.js";
export function createReservationActionsRuntime(deps) {
    const { can, getReservationValidation, render, renderReservationPlanner, showToast, tableById } = deps;
    function addReservation(formData) {
        if (!can("canManageReservations")) {
            showToast("This role cannot create reservations.");
            return;
        }
        const guests = Math.max(1, Math.floor(Number(formData.get("guests")) || 1));
        const time = formData.get("time") || "";
        const tableId = formData.get("tableId");
        const validation = getReservationValidation({ guests, time, tableId });
        if (!validation.ok) {
            showToast(validation.detail);
            renderReservationPlanner();
            return;
        }
        const reservation = {
            id: `RES-${Date.now()}`,
            name: formData.get("name") || "Guest",
            guests,
            time,
            tableId,
            source: formData.get("source"),
            status: "Confirmed"
        };
        state.reservations.push(reservation);
        saveState();
        render();
        showToast(`Reservation booked for ${reservation.name} at ${tableById(tableId).name}.`);
    }
    return {
        addReservation
    };
}
//# sourceMappingURL=reservation-actions.js.map
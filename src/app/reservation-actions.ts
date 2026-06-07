import { toDateInputString } from "../domain/scheduling.js";
import {
  isReservationDate,
  isReservationTime,
  normalizeReservationStatus
} from "../domain/reservations.js";
import { RESERVATION_SOURCES } from "../shared/constants.js";
import { normalizePaymentMethod, normalizePaymentStatus } from "../domain/payments.js";
import { timeNow } from "../shared/dates.js";
import { saveState, state } from "./state.js";
import { recordReservationPayment } from "./payment-ledger.js";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanNotes(value) {
  return String(value || "").trim();
}

function normalizeReservationSource(source) {
  const candidate = cleanText(source);
  return RESERVATION_SOURCES.includes(candidate) ? candidate : "Website";
}

export function createReservationActionsRuntime(deps) {
  const {
    can,
    getAvailableReservationTable,
    getReservationRequestValidation,
    getReservationValidation,
    render,
    renderReservationPlanner,
    renderWebsiteReservationScreen,
    showToast,
    tableById
  } = deps;

  function reservationById(id) {
    return state.reservations.find((reservation) => reservation.id === id);
  }

  function reservationFromForm(formData, fallback: any = {}) {
    const source = normalizeReservationSource(formData.get("source") || fallback.source);
    const paymentProcessor = cleanText(formData.get("paymentProcessor") || fallback.paymentProcessor);
    const paymentStatus = normalizePaymentStatus(formData.get("paymentStatus") || fallback.paymentStatus);
    const paymentMethod = normalizePaymentMethod(
      fallback.paymentMethod || (paymentProcessor === "Cash" ? "Cash" : paymentProcessor ? "Online payment" : "Unpaid / pay later"),
      paymentStatus
    );
    return {
      id: cleanText(formData.get("reservationId") || fallback.id),
      date: isReservationDate(formData.get("date")) ? String(formData.get("date")) : fallback.date || toDateInputString(),
      name: cleanText(formData.get("name") || fallback.name) || "Guest",
      guests: Math.max(1, Math.floor(Number(formData.get("guests") || fallback.guests) || 1)),
      time: cleanText(formData.get("time") || fallback.time),
      tableId: cleanText(formData.get("tableId") || fallback.tableId),
      phone: cleanText(formData.get("phone") || fallback.phone),
      email: cleanText(formData.get("email") || fallback.email),
      notes: cleanNotes(formData.get("notes") || fallback.notes),
      source,
      status: normalizeReservationStatus(formData.get("status") || fallback.status, source === "Website" ? "Pending" : "Confirmed"),
      paymentStatus,
      paymentMethod,
      paymentProcessor,
      paymentReference: cleanText(formData.get("paymentReference") || fallback.paymentReference),
      depositAmount: Math.max(0, Number(formData.get("depositAmount") || fallback.depositAmount) || 0),
      paidAt: paymentStatus === "Paid" ? fallback.paidAt || timeNow() : cleanText(fallback.paidAt),
      paidAtMs: paymentStatus === "Paid" ? fallback.paidAtMs || Date.now() : fallback.paidAtMs || ""
    };
  }

  function recordReservationDepositIfNeeded(reservation) {
    if (!reservation) return;
    if (!reservation.depositAmount && reservation.paymentStatus === "Unpaid" && !reservation.paymentReference) return;
    recordReservationPayment(reservation, {
      provider: reservation.paymentProcessor,
      paymentMethod: reservation.paymentMethod,
      paymentReference: reservation.paymentReference,
      status: reservation.paymentStatus,
      amountCents: Math.round((Number(reservation.depositAmount) || 0) * 100),
      paidAt: reservation.paidAt,
      paidAtMs: reservation.paidAtMs,
      captureMode: reservation.source === "Website" ? "online_checkout" : "staff_recorded"
    });
  }

  function addReservation(formData) {
    if (!can("canManageReservations")) {
      showToast("This role cannot create reservations.");
      return;
    }

    const editingId = cleanText(formData.get("reservationId") || state.reservationEditingId);
    const existingReservation = reservationById(editingId);
    const reservation = reservationFromForm(formData, existingReservation || {});
    const validation = getReservationValidation({
      id: existingReservation?.id || reservation.id,
      date: reservation.date,
      guests: reservation.guests,
      time: reservation.time,
      tableId: reservation.tableId,
      status: reservation.status
    });

    if (!validation.ok) {
      showToast(validation.detail);
      renderReservationPlanner();
      return;
    }

    if (existingReservation) {
      Object.assign(existingReservation, reservation, {
        id: existingReservation.id,
        createdAt: existingReservation.createdAt || timeNow(),
        updatedAt: timeNow()
      });
      recordReservationDepositIfNeeded(existingReservation);
      state.reservationEditingId = "";
      saveState();
      render();
      showToast(`Reservation updated for ${existingReservation.name}.`);
      return;
    }

    const newReservation = {
      ...reservation,
      id: `RES-${Date.now()}`,
      createdAt: timeNow(),
      updatedAt: ""
    };
    state.reservations.push(newReservation);
    recordReservationDepositIfNeeded(newReservation);
    state.reservationEditingId = "";
    saveState();
    render();
    showToast(`Reservation booked for ${newReservation.name} at ${tableById(newReservation.tableId)?.name || "table"}.`);
  }

  function submitWebsiteReservation(formData) {
    const reservation = reservationFromForm(formData, { source: "Website", status: "Pending" });
    reservation.source = "Website";
    reservation.status = "Pending";

    const validation = getReservationRequestValidation({ ...reservation, tableId: "" });
    if (!validation.ok) {
      showToast(validation.detail);
      renderWebsiteReservationScreen();
      return;
    }

    const selectedTable = tableById(reservation.tableId);
    if (selectedTable) {
      const tableValidation = getReservationValidation({
        ...reservation,
        tableId: selectedTable.id,
        status: "Pending"
      });
      if (!tableValidation.ok) {
        showToast(tableValidation.detail);
        renderWebsiteReservationScreen();
        return;
      }
    }

    const table = selectedTable || validation.table || getAvailableReservationTable(reservation);
    if (!table) {
      showToast("No table is available for that party size and time.");
      renderWebsiteReservationScreen();
      return;
    }

    const newReservation = {
      ...reservation,
      id: `RES-${Date.now()}`,
      tableId: table.id,
      createdAt: timeNow(),
      updatedAt: ""
    };
    state.reservations.push(newReservation);
    state.websiteLastReservationId = newReservation.id;
    saveState();
    render();
    showToast(`Reservation request received for ${newReservation.name}.`);
  }

  function updateReservationStatus(reservationId, status) {
    if (!can("canManageReservations")) {
      showToast("This role cannot manage reservations.");
      return;
    }

    const reservation = reservationById(reservationId);
    if (!reservation) return;
    const nextStatus = normalizeReservationStatus(status, reservation.status || "Pending");

    if (nextStatus === "Confirmed") {
      if (!tableById(reservation.tableId)) {
        const table = getAvailableReservationTable(reservation);
        if (table) reservation.tableId = table.id;
      }
      const validation = getReservationValidation({ ...reservation, status: nextStatus });
      if (!validation.ok) {
        showToast(validation.detail);
        renderReservationPlanner();
        return;
      }
    }

    reservation.status = nextStatus;
    reservation.updatedAt = timeNow();
    saveState();
    render();
    showToast(`${reservation.name} marked ${nextStatus.toLowerCase()}.`);
  }

  function selectReservationForEdit(reservationId) {
    if (!can("canManageReservations")) {
      showToast("This role cannot edit reservations.");
      return;
    }
    if (!reservationById(reservationId)) return;
    state.reservationEditingId = reservationId;
    saveState();
    render();
  }

  function cancelReservationEdit() {
    state.reservationEditingId = "";
    saveState();
    render();
  }

  function addReservationBlock(formData) {
    if (!can("canManageReservations")) {
      showToast("This role cannot block reservation times.");
      return;
    }

    const date = isReservationDate(formData.get("date")) ? String(formData.get("date")) : "";
    const startTime = cleanText(formData.get("startTime"));
    const endTime = cleanText(formData.get("endTime"));
    if (!isReservationTime(startTime) || !isReservationTime(endTime)) {
      showToast("Choose a valid start and end time to block.");
      return;
    }

    state.reservationBlocks.push({
      id: `RB-${Date.now()}`,
      date,
      startTime,
      endTime,
      reason: cleanText(formData.get("reason")) || "Unavailable",
      active: true
    });
    saveState();
    render();
    showToast("Reservation time blocked.");
  }

  function deleteReservationBlock(blockId) {
    if (!can("canManageReservations")) {
      showToast("This role cannot manage reservation blocks.");
      return;
    }
    state.reservationBlocks = state.reservationBlocks.filter((block) => block.id !== blockId);
    saveState();
    render();
    showToast("Reservation block removed.");
  }

  function saveReservationCapacityRule(formData) {
    if (!can("canManageReservations")) {
      showToast("This role cannot set reservation capacity.");
      return;
    }

    const startTime = cleanText(formData.get("startTime"));
    const endTime = cleanText(formData.get("endTime"));
    const maxGuests = Math.max(0, Math.floor(Number(formData.get("maxGuests")) || 0));
    const maxReservations = Math.max(0, Math.floor(Number(formData.get("maxReservations")) || 0));
    if (!isReservationTime(startTime) || !isReservationTime(endTime)) {
      showToast("Choose a valid capacity time window.");
      return;
    }
    if (maxGuests < 1 && maxReservations < 1) {
      showToast("Set a guest cap or booking cap.");
      return;
    }

    state.reservationCapacityRules.push({
      id: `RC-${Date.now()}`,
      date: isReservationDate(formData.get("date")) ? String(formData.get("date")) : "",
      startTime,
      endTime,
      maxGuests,
      maxReservations,
      note: cleanText(formData.get("note")),
      active: true
    });
    saveState();
    render();
    showToast("Reservation capacity rule saved.");
  }

  function deleteReservationCapacityRule(ruleId) {
    if (!can("canManageReservations")) {
      showToast("This role cannot manage reservation capacity.");
      return;
    }
    state.reservationCapacityRules = state.reservationCapacityRules.filter((rule) => rule.id !== ruleId);
    saveState();
    render();
    showToast("Reservation capacity rule removed.");
  }

  return {
    addReservation,
    addReservationBlock,
    cancelReservationEdit,
    deleteReservationBlock,
    deleteReservationCapacityRule,
    saveReservationCapacityRule,
    selectReservationForEdit,
    submitWebsiteReservation,
    updateReservationStatus
  };
}

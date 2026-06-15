import { state } from "../app/state.js";
import { DATA_MODEL, LANGUAGE_OPTIONS, ROLE_ORDER } from "../shared/constants.js";
import { getReservationDateLabel, reservationStatusClass } from "../domain/reservations.js";
import { toDateInputString } from "../domain/scheduling.js";
import { escapeHtml } from "../shared/html.js";
import { qrCodeSvg } from "../shared/qr.js";
import { reservationTableMapHtml } from "./table-map.js";

export function createSettingsUi(deps) {
  const document: any = window.document;
  const {
    can,
    emptyState,
    getQrOrderUrl,
    getReservationIssues,
    getReservationSeatingRecommendation,
    getReservationValidation,
    getReservationWindowLabel,
    getWebsiteReservationUrl,
    tableById
  } = deps;

  function renderSettings() {
    const form = document.querySelector("#settingsForm");
    const defaultLanguageSelect = document.querySelector("#defaultLanguageSelect");
    const languageChecks = document.querySelector("#supportedLanguageChecks");
    const schemaGrid = document.querySelector("#schemaGrid");
    if (!form || !defaultLanguageSelect || !languageChecks || !schemaGrid) return;
  
    const settings = state.restaurantSettings;
    const editable = can("canEditSettings");
    form.elements.restaurantName.value = settings.restaurantName;
    form.elements.location.value = settings.location;
    form.elements.currency.value = settings.currency;
    form.elements.opensAt.value = settings.opensAt;
    form.elements.closesAt.value = settings.closesAt;
  
    defaultLanguageSelect.innerHTML = LANGUAGE_OPTIONS
      .map((language) => `<option value="${escapeHtml(language.id)}">${escapeHtml(language.label)}</option>`)
      .join("");
    defaultLanguageSelect.value = settings.defaultLanguage;
  
    languageChecks.innerHTML = LANGUAGE_OPTIONS
      .map((language) => `
        <label class="check-row">
          <input name="supportedLanguages" type="checkbox" value="${escapeHtml(language.id)}" ${settings.supportedLanguages.includes(language.id) ? "checked" : ""}>
          <span>${escapeHtml(language.label)}</span>
        </label>
      `)
      .join("");
  
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !editable;
    });
  
    const counts = {
      users: state.users.length,
      roles: ROLE_ORDER.length,
      restaurant_settings: 1,
      sellable_products: state.products.length,
      purchased_products: state.ingredients.length,
      customers: state.customers.length,
      orders: state.orders.length,
      kitchen_tickets: state.tickets.length,
      external_delivery_platforms: state.externalPlatforms.length,
      external_product_mappings: state.externalProductMappings.length,
      external_order_imports: state.externalOrderImports.length,
      table_qr_codes: state.tableQrCodes.length,
      reservations: state.reservations.length,
      reservation_blocks: state.reservationBlocks.length,
      reservation_capacity_rules: state.reservationCapacityRules.length,
      procedures: state.procedures.length,
      procedure_completions: state.procedureCompletions.length,
      recipes: state.products.reduce((sum, product) => sum + (product.recipe?.length || 0), 0)
    };
  
    schemaGrid.innerHTML = DATA_MODEL
      .map((collection) => `
        <article class="schema-card">
          <header>
            <strong>${escapeHtml(collection.name)}</strong>
            <span class="pill info">${counts[collection.name] || 0}</span>
          </header>
          <p>${escapeHtml(collection.fields)}</p>
        </article>
      `)
      .join("");
  
    renderQrCodeManagement();
  }
  
  function tableOptionsHtml(selectedTableId) {
    return state.tables
      .map((table) => `<option value="${escapeHtml(table.id)}" ${table.id === selectedTableId ? "selected" : ""}>${escapeHtml(table.name)} - ${escapeHtml(table.zone)}</option>`)
      .join("");
  }
  
  function renderQrCodeManagement() {
    const form = document.querySelector("#qrCodeForm");
    const tableSelect = document.querySelector("#qrTableSelect");
    const areaInput = document.querySelector("#qrAreaInput");
    const list = document.querySelector("#qrCodeList");
    if (!form || !tableSelect || !areaInput || !list) return;
  
    const editable = can("canEditSettings");
    const selectedTable = tableById(tableSelect.value) || state.tables[0];
    tableSelect.innerHTML = tableOptionsHtml(selectedTable?.id || "");
    tableSelect.value = selectedTable?.id || "";
    if (!areaInput.value && selectedTable) areaInput.value = selectedTable.zone;
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !editable;
    });
  
    const sortedCodes = state.tableQrCodes.slice().sort((first, second) => {
      const firstTable = tableById(first.tableId)?.name || "";
      const secondTable = tableById(second.tableId)?.name || "";
      return firstTable.localeCompare(secondTable) || first.createdAt.localeCompare(second.createdAt);
    });
  
    list.innerHTML = sortedCodes.length
      ? sortedCodes.map((code) => {
        const table = tableById(code.tableId);
        const url = getQrOrderUrl(code);
        const disabled = code.status !== "Active";
        return `
          <article class="qr-admin-card ${disabled ? "is-disabled" : ""}">
            <header>
              <div>
                <strong>${escapeHtml(table?.name || "Unassigned table")}</strong>
                <p>${escapeHtml(code.area || table?.zone || "Dining room")} · ${escapeHtml(code.token)}</p>
              </div>
              <span class="pill ${disabled ? "warning" : "ok"}">${escapeHtml(code.status)}</span>
            </header>
            <div class="qr-admin-body">
              <div class="qr-code-box">
                ${qrCodeSvg(url, `${table?.name || "Table"} QR order code`)}
              </div>
              <div class="qr-admin-controls">
                <div class="form-row">
                  <label>
                    Table
                    <select data-qr-table="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>
                      ${tableOptionsHtml(code.tableId)}
                    </select>
                  </label>
                  <label>
                    Area
                    <input data-qr-area="${escapeHtml(code.id)}" type="text" value="${escapeHtml(code.area || table?.zone || "")}" ${!editable ? "disabled" : ""}>
                  </label>
                </div>
                <label>
                  Customer URL
                  <input type="text" value="${escapeHtml(url)}" readonly>
                </label>
                <div class="mini-actions qr-actions">
                  <button class="mini-btn" type="button" data-open-qr="${escapeHtml(code.id)}">Open</button>
                  <button class="mini-btn" type="button" data-assign-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>Assign</button>
                  <button class="mini-btn" type="button" data-regenerate-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>Regenerate</button>
                  <button class="mini-btn ${disabled ? "" : "danger-action"}" type="button" data-toggle-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>${disabled ? "Enable" : "Disable"}</button>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join("")
      : emptyState("Create table QR codes to enable customer ordering.");
  }

  function reservationRecommendationHtml(recommendation, selectedTableId) {
    if (!recommendation || recommendation.kind === "none") {
      return `
        <div class="reservation-recommendation is-empty">
          <span class="pill warning">Planning</span>
          <p>${escapeHtml(recommendation?.detail || "Choose a table manually once the guest count and time are set.")}</p>
        </div>
      `;
    }

    const recommendedTableIds = (recommendation.tables || []).map((table) => table.id);
    const selectedRecommended = Boolean(selectedTableId && recommendedTableIds.includes(selectedTableId));
    const pillText = recommendation.kind === "merge"
      ? "Merge"
      : selectedRecommended
        ? "Selected"
        : "Suggested";

    return `
      <div class="reservation-recommendation ${selectedRecommended ? "is-selected" : ""}">
        <span class="pill ${recommendation.kind === "merge" ? "info" : "ok"}">${escapeHtml(pillText)}</span>
        <div>
          <strong>${escapeHtml(recommendation.title)}</strong>
          <p>${escapeHtml(recommendation.detail)}</p>
        </div>
      </div>
    `;
  }
  
  function renderReservationPlanner() {
    const form = document.querySelector("#reservationForm");
    const tableSelect = document.querySelector("#reservationTable");
    const tableMap = document.querySelector("#reservationTableMap");
    const availabilityPanel = document.querySelector("#reservationAvailability");
    const submitButton = document.querySelector("#bookReservationBtn");
    const title = document.querySelector("#reservationFormTitle");
    const cancelButton = document.querySelector("#cancelReservationEditBtn");
    const publicReservationInput = document.querySelector("#publicReservationLinkInput");
    const publicReservationLink = document.querySelector("#publicReservationLink");
    if (!form || !tableSelect || !availabilityPanel || !submitButton) return;
  
    const today = toDateInputString();
    const editingReservation = state.reservations.find((reservation) => reservation.id === state.reservationEditingId);
    const editingChanged = editingReservation && form.elements.reservationId.value !== editingReservation.id;
    if (editingReservation && editingChanged) {
      form.elements.reservationId.value = editingReservation.id;
      form.elements.date.value = editingReservation.date || today;
      form.elements.name.value = editingReservation.name || "";
      form.elements.guests.value = editingReservation.guests || 1;
      form.elements.time.value = editingReservation.time || "19:00";
      form.elements.phone.value = editingReservation.phone || "";
      form.elements.email.value = editingReservation.email || "";
      form.elements.source.value = editingReservation.source || "Website";
      form.elements.status.value = editingReservation.status || "Pending";
      form.elements.depositAmount.value = editingReservation.depositAmount || 0;
      form.elements.paymentStatus.value = editingReservation.paymentStatus || "Unpaid";
      form.elements.paymentProcessor.value = editingReservation.paymentProcessor || "";
      form.elements.paymentReference.value = editingReservation.paymentReference || "";
      form.elements.notes.value = editingReservation.notes || "";
    } else if (!editingReservation && form.elements.reservationId.value) {
      form.reset();
      form.elements.reservationId.value = "";
      form.elements.name.value = "Nour Family";
      form.elements.guests.value = 4;
      form.elements.time.value = "19:30";
      form.elements.status.value = "Confirmed";
      form.elements.source.value = "Website";
      form.elements.depositAmount.value = 0;
      form.elements.paymentStatus.value = "Unpaid";
      form.elements.paymentProcessor.value = "";
      form.elements.paymentReference.value = "";
    }

    if (!form.elements.date.value) form.elements.date.value = today;
    document.querySelectorAll("#reservationBlockForm input[name='date']").forEach((input: any) => {
      if (!input.value) input.value = today;
    });

    if (title) title.textContent = editingReservation ? "Edit reservation" : "Add reservation";
    if (cancelButton) cancelButton.hidden = !editingReservation;
    const websiteReservationUrl = getWebsiteReservationUrl ? getWebsiteReservationUrl() : "?reservation=website";
    if (publicReservationInput) publicReservationInput.value = websiteReservationUrl;
    if (publicReservationLink) publicReservationLink.href = websiteReservationUrl;

    const guests = Math.max(1, Math.floor(Number(form.elements.guests.value) || 1));
    const time = form.elements.time.value || "";
    const date = form.elements.date.value || today;
    const status = form.elements.status.value || editingReservation?.status || "Confirmed";
    const currentTable = tableById(tableSelect.value);
    const editingTable = tableById(editingReservation?.tableId);
    const selectedTableId = editingChanged
      ? editingTable?.id || ""
      : currentTable?.id || editingTable?.id || "";
    const recommendation = getReservationSeatingRecommendation({ id: editingReservation?.id, date, guests, time, status });
  
    tableSelect.innerHTML = `<option value="">Select table manually</option>` + state.tables
      .map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(table.name)} - ${table.capacity} seats - ${escapeHtml(table.zone)}</option>`)
      .join("");
    tableSelect.value = selectedTableId;
  
    const validation = getReservationValidation({ id: editingReservation?.id, date, guests, time, tableId: tableSelect.value, status });
    if (tableMap) {
      tableMap.innerHTML = reservationTableMapHtml({
        tables: state.tables,
        selectedTableId: tableSelect.value,
        recommendedTableIds: (recommendation.tables || []).map((table) => table.id),
        title: "Select dining table",
        getTableValidation: (table) => getReservationValidation({
          id: editingReservation?.id,
          date,
          guests,
          time,
          tableId: table.id,
          status
        })
      });
    }
    availabilityPanel.className = `availability-card ${validation.className}`.trim();
    availabilityPanel.innerHTML = `
      <header>
        <strong>${escapeHtml(validation.title)}</strong>
        <span class="pill ${validation.pillClass}">${escapeHtml(validation.pillText)}</span>
      </header>
      <p>${escapeHtml(validation.detail)}</p>
      ${reservationRecommendationHtml(recommendation, tableSelect.value)}
    `;
    const editable = can("canManageReservations");
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      if (element.id === "publicReservationLinkInput") return;
      element.disabled = !editable;
    });
    submitButton.disabled = !editable || !validation.ok;
  }
  
  function reservationActionsHtml(reservation, editable) {
    const buttons = [];
    if (reservation.status === "Pending") {
      buttons.push(`<button class="mini-btn" type="button" data-reservation-id="${escapeHtml(reservation.id)}" data-reservation-status="Confirmed" ${!editable ? "disabled" : ""}>Approve</button>`);
      buttons.push(`<button class="mini-btn danger-action" type="button" data-reservation-id="${escapeHtml(reservation.id)}" data-reservation-status="Declined" ${!editable ? "disabled" : ""}>Decline</button>`);
    }
    if (reservation.status === "Confirmed") {
      buttons.push(`<button class="mini-btn" type="button" data-reservation-id="${escapeHtml(reservation.id)}" data-reservation-status="Arrived" ${!editable ? "disabled" : ""}>Arrived</button>`);
      buttons.push(`<button class="mini-btn danger-action" type="button" data-reservation-id="${escapeHtml(reservation.id)}" data-reservation-status="No-show" ${!editable ? "disabled" : ""}>No-show</button>`);
    }
    if (reservation.status === "Declined" || reservation.status === "Cancelled" || reservation.status === "No-show") {
      buttons.push(`<button class="mini-btn" type="button" data-reservation-id="${escapeHtml(reservation.id)}" data-reservation-status="Confirmed" ${!editable ? "disabled" : ""}>Reopen</button>`);
    }
    buttons.push(`<button class="mini-btn" type="button" data-edit-reservation="${escapeHtml(reservation.id)}" ${!editable ? "disabled" : ""}>Edit</button>`);
    return `<div class="mini-actions">${buttons.join("")}</div>`;
  }

  function renderReservationOps(editable) {
    const container = document.querySelector("#reservationOpsGrid");
    if (!container) return;

    const blockCards = state.reservationBlocks.map((block) => `
      <article class="reservation-ops-card">
        <header>
          <div>
            <strong>${escapeHtml(block.date ? getReservationDateLabel(block.date) : "Daily")} ${escapeHtml(block.startTime)}-${escapeHtml(block.endTime)}</strong>
            <p>${escapeHtml(block.reason || "Unavailable")}</p>
          </div>
          <button class="mini-btn danger-action" type="button" data-delete-reservation-block="${escapeHtml(block.id)}" ${!editable ? "disabled" : ""}>Remove</button>
        </header>
      </article>
    `);

    const ruleCards = state.reservationCapacityRules.map((rule) => `
      <article class="reservation-ops-card">
        <header>
          <div>
            <strong>${escapeHtml(rule.date ? getReservationDateLabel(rule.date) : "Daily")} ${escapeHtml(rule.startTime)}-${escapeHtml(rule.endTime)}</strong>
            <p>${rule.maxGuests ? `${rule.maxGuests} guests` : "No guest cap"} | ${rule.maxReservations ? `${rule.maxReservations} bookings` : "No booking cap"}${rule.note ? ` | ${escapeHtml(rule.note)}` : ""}</p>
          </div>
          <button class="mini-btn danger-action" type="button" data-delete-capacity-rule="${escapeHtml(rule.id)}" ${!editable ? "disabled" : ""}>Remove</button>
        </header>
      </article>
    `);

    container.innerHTML = [...blockCards, ...ruleCards].length
      ? [...blockCards, ...ruleCards].join("")
      : emptyState("No blocked times or capacity rules.");
  }

  function renderReservations() {
    const editable = can("canManageReservations");
    const today = toDateInputString();
    renderReservationOps(editable);

    const tableSummary = document.querySelector("#tableCapacityGrid");
    if (tableSummary) {
      tableSummary.innerHTML = state.tables.map((table) => {
        const reservations = state.reservations.filter((reservation) => reservation.date === today && reservation.tableId === table.id && !["Declined", "Cancelled", "No-show"].includes(reservation.status));
        const nextReservation = reservations.slice().sort((a, b) => a.time.localeCompare(b.time))[0];
        return `
          <article class="table-capacity-card">
            <strong>${escapeHtml(table.name)}</strong>
            <span>${table.capacity} seats</span>
            <p>${escapeHtml(nextReservation ? `${reservations.length} tonight, next ${nextReservation.time}` : "Open tonight")}</p>
          </article>
        `;
      }).join("");
    }
  
    const reservationList = document.querySelector("#reservationList");
    if (!reservationList) return;
    const reservations = state.reservations
      .slice()
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.time.localeCompare(b.time));
    reservationList.innerHTML = reservations.length
      ? reservations
      .map((reservation) => {
        const table = tableById(reservation.tableId);
        const issues = getReservationIssues(reservation);
        const statusClass = issues.length ? "danger" : reservationStatusClass(reservation.status);
        const statusText = issues.length ? "Review" : reservation.status;
        const contact = [reservation.phone, reservation.email].filter(Boolean).join(" | ") || "No contact";
        const depositText = Number(reservation.depositAmount || 0) > 0
          ? ` | Deposit ${reservation.paymentStatus || "Unpaid"} EUR ${Number(reservation.depositAmount || 0).toFixed(2)}`
          : "";
        return `
          <article class="reservation-card ${issues.length ? "is-conflict" : ""}">
            <header>
              <div>
                <strong>${escapeHtml(getReservationDateLabel(reservation.date))} ${escapeHtml(reservation.time)} ${escapeHtml(reservation.name)}</strong>
                <p>${reservation.guests} guests | ${escapeHtml(table ? table.name : "Unassigned")} | ${escapeHtml(reservation.source)} | ${escapeHtml(contact)}${escapeHtml(depositText)}</p>
              </div>
              <span class="pill ${statusClass}">${escapeHtml(statusText)}</span>
            </header>
            <p>${escapeHtml(issues.length ? issues.join(" | ") : `${getReservationWindowLabel(reservation.time)} hold, seats up to ${table?.capacity || 0}.${reservation.notes ? ` ${reservation.notes}` : ""}`)}</p>
            ${reservationActionsHtml(reservation, editable)}
          </article>
        `;
      }).join("")
      : emptyState("No reservations yet.");
  }
  
  return {
    renderQrCodeManagement,
    renderReservationPlanner,
    renderReservations,
    renderSettings
  };
}

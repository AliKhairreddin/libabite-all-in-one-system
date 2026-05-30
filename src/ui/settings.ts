import { state } from "../app/state.js";
import { DATA_MODEL, LANGUAGE_OPTIONS, ROLE_ORDER } from "../shared/constants.js";
import { escapeHtml } from "../shared/html.js";
import { qrCodeSvg } from "../shared/qr.js";

export function createSettingsUi(deps) {
  const document: any = window.document;
  const {
    can,
    emptyState,
    getAvailableReservationTable,
    getQrOrderUrl,
    getReservationIssues,
    getReservationValidation,
    getReservationWindowLabel,
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
      table_qr_codes: state.tableQrCodes.length,
      reservations: state.reservations.length,
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
  
  function renderReservationPlanner() {
    const form = document.querySelector("#reservationForm");
    const tableSelect = document.querySelector("#reservationTable");
    const availabilityPanel = document.querySelector("#reservationAvailability");
    const submitButton = document.querySelector("#bookReservationBtn");
    if (!form || !tableSelect || !availabilityPanel || !submitButton) return;
  
    const guests = Math.max(1, Math.floor(Number(form.elements.guests.value) || 1));
    const time = form.elements.time.value || "";
    const currentTable = tableById(tableSelect.value);
    const preferredTable = currentTable || getAvailableReservationTable({ guests, time }) || state.tables[0];
  
    tableSelect.innerHTML = state.tables
      .map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(table.name)} - ${table.capacity} seats - ${escapeHtml(table.zone)}</option>`)
      .join("");
    tableSelect.value = preferredTable?.id || "";
  
    const validation = getReservationValidation({ guests, time, tableId: tableSelect.value });
    availabilityPanel.className = `availability-card ${validation.className}`.trim();
    availabilityPanel.innerHTML = `
      <header>
        <strong>${escapeHtml(validation.title)}</strong>
        <span class="pill ${validation.pillClass}">${escapeHtml(validation.pillText)}</span>
      </header>
      <p>${escapeHtml(validation.detail)}</p>
    `;
    submitButton.disabled = !can("canManageReservations") || !validation.ok;
  }
  
  function renderReservations() {
    const tableSummary = document.querySelector("#tableCapacityGrid");
    if (tableSummary) {
      tableSummary.innerHTML = state.tables.map((table) => {
        const reservations = state.reservations.filter((reservation) => reservation.tableId === table.id);
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
  
    document.querySelector("#reservationList").innerHTML = state.reservations
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((reservation) => {
        const table = tableById(reservation.tableId);
        const issues = getReservationIssues(reservation);
        const statusClass = issues.length ? "danger" : "ok";
        const statusText = issues.length ? "Review" : reservation.status;
        return `
          <article class="reservation-card ${issues.length ? "is-conflict" : ""}">
            <header>
              <div>
                <strong>${escapeHtml(reservation.time)} ${escapeHtml(reservation.name)}</strong>
                <p>${reservation.guests} guests | ${escapeHtml(table ? table.name : "Unassigned")} | ${escapeHtml(reservation.source)}</p>
              </div>
              <span class="pill ${statusClass}">${escapeHtml(statusText)}</span>
            </header>
            <p>${escapeHtml(issues.length ? issues.join(" | ") : `${getReservationWindowLabel(reservation.time)} hold, seats up to ${table?.capacity || 0}.`)}</p>
          </article>
        `;
      }).join("");
  }
  
  return {
    renderQrCodeManagement,
    renderReservationPlanner,
    renderReservations,
    renderSettings
  };
}

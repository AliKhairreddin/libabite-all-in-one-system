import { escapeHtml } from "../shared/html.js";

const DEFAULT_TABLE_LAYOUTS = [
  { id: "table-1", x: 12, y: 16, w: 15, h: 18, shape: "round", seats: "two", feature: "window" },
  { id: "table-2", x: 12, y: 55, w: 15, h: 18, shape: "round", seats: "two", feature: "window" },
  { id: "table-3", x: 40, y: 20, w: 18, h: 20, shape: "square", seats: "four", feature: "main" },
  { id: "table-4", x: 63, y: 20, w: 18, h: 20, shape: "square", seats: "four", feature: "main" },
  { id: "table-5", x: 41, y: 58, w: 26, h: 18, shape: "banquette", seats: "banquette", feature: "couch" },
  { id: "table-6", x: 73, y: 55, w: 18, h: 25, shape: "family", seats: "banquette", feature: "corner" }
];

function fallbackLayout(index) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 12 + column * 27,
    y: 16 + row * 28,
    w: 17,
    h: 18,
    shape: "square",
    seats: "four",
    feature: "main"
  };
}

function tableLayout(table, index) {
  return DEFAULT_TABLE_LAYOUTS.find((layout) => layout.id === table.id) || fallbackLayout(index);
}

function seatMarkup(layout) {
  if (layout.seats === "two") {
    return `
      <span class="floor-seat seat-top" aria-hidden="true"></span>
      <span class="floor-seat seat-bottom" aria-hidden="true"></span>
    `;
  }

  if (layout.seats === "banquette") {
    return `
      <span class="floor-couch" aria-hidden="true"></span>
      <span class="floor-seat seat-front-a" aria-hidden="true"></span>
      <span class="floor-seat seat-front-b" aria-hidden="true"></span>
      <span class="floor-seat seat-front-c" aria-hidden="true"></span>
    `;
  }

  return `
    <span class="floor-seat seat-top" aria-hidden="true"></span>
    <span class="floor-seat seat-right" aria-hidden="true"></span>
    <span class="floor-seat seat-bottom" aria-hidden="true"></span>
    <span class="floor-seat seat-left" aria-hidden="true"></span>
  `;
}

function statusForTable(table, getTableValidation) {
  const validation = getTableValidation?.(table);
  if (!validation) {
    return {
      className: "is-available",
      label: "Available",
      detail: `${table.capacity} seats`
    };
  }

  return {
    className: validation.ok ? "is-available" : "is-unavailable",
    label: validation.pillText || (validation.ok ? "Available" : "Unavailable"),
    detail: validation.detail || `${table.capacity} seats`
  };
}

export function reservationTableMapHtml({
  tables,
  selectedTableId = "",
  getTableValidation,
  title = "Choose a table",
  kicker = "Floor map",
  mapId = "reservation-table-map"
}) {
  const selectedTable = tables.find((table) => table.id === selectedTableId) || tables[0];
  const tableButtons = tables.map((table, index) => {
    const layout = tableLayout(table, index);
    const status = statusForTable(table, getTableValidation);
    const selected = table.id === selectedTable?.id;
    const tableLabel = `${table.name}, ${table.capacity} seats, ${table.zone}`;

    return `
      <button
        class="floor-table floor-table-${escapeHtml(layout.shape)} floor-feature-${escapeHtml(layout.feature)} ${status.className} ${selected ? "is-selected" : ""}"
        type="button"
        data-reservation-map-table="${escapeHtml(table.id)}"
        aria-pressed="${selected ? "true" : "false"}"
        aria-label="${escapeHtml(`${tableLabel}. ${status.label}`)}"
        style="--x: ${layout.x}%; --y: ${layout.y}%; --w: ${layout.w}%; --h: ${layout.h}%"
      >
        <span class="floor-table-shadow" aria-hidden="true"></span>
        ${seatMarkup(layout)}
        <span class="floor-table-top">
          <strong>${escapeHtml(table.name.replace(/^Table\s*/i, "T"))}</strong>
          <span>${table.capacity} seats</span>
        </span>
      </button>
    `;
  }).join("");

  return `
    <section class="reservation-table-map" id="${escapeHtml(mapId)}" data-view-mode="3d" aria-label="${escapeHtml(title)}">
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(kicker)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="segmented reservation-map-toggle" role="group" aria-label="Map view">
          <button type="button" data-reservation-map-view="2d">2D</button>
          <button class="is-selected" type="button" data-reservation-map-view="3d">3D</button>
        </div>
      </header>
      <div class="reservation-floor-plan">
        <div class="floor-zone floor-window" aria-hidden="true">Window</div>
        <div class="floor-zone floor-entry" aria-hidden="true">Entry</div>
        <div class="floor-zone floor-counter" aria-hidden="true">Counter</div>
        <div class="floor-wall floor-banquette-wall" aria-hidden="true"></div>
        ${tableButtons}
      </div>
      <footer>
        <span class="map-key map-key-selected">Selected</span>
        <span class="map-key map-key-available">Available</span>
        <span class="map-key map-key-unavailable">Unavailable</span>
        ${selectedTable ? `<strong>${escapeHtml(`${selectedTable.name} · ${selectedTable.capacity} seats · ${selectedTable.zone}`)}</strong>` : ""}
      </footer>
    </section>
  `;
}

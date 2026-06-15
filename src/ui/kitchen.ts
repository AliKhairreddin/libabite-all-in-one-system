import { state } from "../app/state.js";
import { getOrderProgressSummary as summarizeOrderProgress } from "../domain/kitchen.js";
import { formatDuration } from "../shared/dates.js";
import { escapeHtml } from "../shared/html.js";
import { slugify } from "../shared/ids.js";

export function createKitchenUi(deps) {
  const document: any = window.document;
  const {
    can,
    emptyState,
    getKitchenSlaSummary,
    getOpenTickets,
    getStationNames,
    getTicketOrderAgeMinutes,
    getTicketPriority,
    getTicketSla,
    getTicketStatusLabel,
    orderById,
    orderLocationLabel,
    orderTypeLabel,
    productById,
    ticketStatusClass
  } = deps;

  function renderKitchen() {
    const tabs = document.querySelector("#stationTabs");
    const stationSummary = document.querySelector("#kitchenStationSummary");
    const activeStation = getStationNames().includes(state.activeStation) ? state.activeStation : "All";
    state.activeStation = activeStation;
  
    tabs.innerHTML = getStationNames()
      .map((station) => {
        const count = station === "All"
          ? getOpenTickets().length
          : getOpenTickets().filter((ticket) => ticket.station === station).length;
        return `
          <button type="button" class="${state.activeStation === station ? "is-selected" : ""}" data-station="${escapeHtml(station)}">
            ${escapeHtml(station)}
            ${count ? `<span class="tab-count">${count}</span>` : ""}
          </button>
        `;
      })
      .join("");
  
    const tickets = state.activeStation === "All"
      ? getOpenTickets()
      : getOpenTickets().filter((ticket) => ticket.station === state.activeStation);
    const sortedTickets = sortKitchenTickets(tickets);
  
    if (stationSummary) {
      stationSummary.innerHTML = kitchenStationSummaryCards(tickets, state.activeStation);
    }
  
    document.querySelector("#ticketBoard").innerHTML = tickets.length
      ? sortedTickets.map(ticketCard).join("")
      : emptyState("This screen is clear.");
  
    renderKitchenOrderProgress();
  }
  
  function sortKitchenTickets(tickets) {
    const statusRank = {
      Delayed: 0,
      Queued: 1,
      Accepted: 2,
      Preparing: 3,
      Ready: 4,
      Done: 5
    };
    return tickets.slice().sort((first, second) => {
      const priorityRank = getTicketPriority(first).label === "Urgent" ? 0 : getTicketPriority(first).label === "High" ? 1 : 2;
      const nextPriorityRank = getTicketPriority(second).label === "Urgent" ? 0 : getTicketPriority(second).label === "High" ? 1 : 2;
      return priorityRank - nextPriorityRank
        || (statusRank[first.status] ?? 9) - (statusRank[second.status] ?? 9)
        || first.createdAtMs - second.createdAtMs;
    });
  }
  
  function kitchenStationSummaryCards(tickets, station) {
    const stationLabel = station === "All" ? "All stations" : station;
    const counts = tickets.reduce((summary, ticket) => {
      summary[ticket.status] = (summary[ticket.status] || 0) + 1;
      return summary;
    }, {});
    const ready = (counts.Ready || 0);
    const active = (counts.Accepted || 0) + (counts.Preparing || 0) + (counts.Delayed || 0);
    const newCount = counts.Queued || 0;
    return [
      { label: "Screen", value: stationLabel, note: `${tickets.length} open station ${tickets.length === 1 ? "task" : "tasks"}`, className: "info" },
      { label: "New orders", value: newCount, note: "Waiting for accept", className: newCount ? "warning" : "ok" },
      { label: "Active", value: active, note: `${counts.Delayed || 0} delayed`, className: counts.Delayed ? "danger" : active ? "info" : "ok" },
      { label: "Ready", value: ready, note: "Awaiting completion", className: ready ? "ok" : "info" }
    ].map((card) => `
      <article class="kds-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  }
  
  function ticketActionButtons(ticket) {
    if (!can("canAdvanceTickets")) return "";
    const done = ticket.status === "Done";
    const ready = ticket.status === "Ready";
    return `
      <div class="mini-actions kds-actions">
        ${ticket.status === "Queued" ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Accepted">Accept order</button>` : ""}
        ${!["Preparing", "Ready", "Done"].includes(ticket.status) ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Preparing">Preparing</button>` : ""}
        ${!ready && !done ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Ready">Finished</button>` : ""}
        ${!["Delayed", "Ready", "Done"].includes(ticket.status) ? `<button class="mini-btn danger-action" type="button" data-delay-ticket="${escapeHtml(ticket.id)}">Delayed</button>` : ""}
        ${!done ? `<button class="mini-btn" type="button" data-issue-ticket="${escapeHtml(ticket.id)}">Issue note</button>` : ""}
        ${ready ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Done">Clear task</button>` : ""}
      </div>
    `;
  }

  function visibleTicketNoteParts(notes) {
    const parts = String(notes || "")
      .split(/\s+\|\s+/)
      .map((part) => part.trim())
      .filter((part) => part && !/^Payment ref(?:erence)?:/i.test(part));
    return parts.length ? parts : ["No notes or modifiers"];
  }
  
  function ticketCard(ticket) {
    const product = productById(ticket.productId);
    const order = orderById(ticket.orderId);
    const sla = getTicketSla(ticket);
    const priority = getTicketPriority(ticket);
    const statusClass = ticketStatusClass(ticket.status);
    const orderAge = getTicketOrderAgeMinutes(ticket);
    const orderLabel = order ? `#${order.number} ${orderLocationLabel(order)}` : ticket.orderId;
    const notes = ticket.notes || "No notes or modifiers";
    const noteParts = visibleTicketNoteParts(notes);
    const stationScope = state.activeStation === "All" ? ticket.station : `${state.activeStation} only`;
    return `
      <article class="ticket-card ${sla.cardClass} status-${escapeHtml(slugify(ticket.status))}">
        <header>
          <div class="ticket-heading">
            <span class="ticket-kicker">${escapeHtml(stationScope)}</span>
            <strong>${escapeHtml(orderLabel)}</strong>
            <p>${ticket.quantity}x ${escapeHtml(product?.name || "Unknown item")}</p>
          </div>
          <div class="ticket-pills">
            <span class="pill ${statusClass}">${escapeHtml(getTicketStatusLabel(ticket.status))}</span>
            <span class="pill ${priority.className}">${escapeHtml(priority.label)}</span>
            <span class="pill ${sla.pillClass}">${escapeHtml(sla.label)}</span>
          </div>
        </header>
        <div class="ticket-notes">
          <span>Notes/modifiers</span>
          <div class="ticket-note-list">
            ${noteParts.map((part) => `<p>${escapeHtml(part)}</p>`).join("")}
          </div>
        </div>
        ${ticket.issueNote ? `
          <div class="ticket-issue">
            <span>Issue</span>
            <p>${escapeHtml(ticket.issueNote)}</p>
          </div>
        ` : ""}
        <div class="ticket-timing">
          <div class="meta-line">
            <span>Placed ${escapeHtml(formatDuration(orderAge))} ago</span>
            <span>Kitchen ${escapeHtml(formatDuration(sla.ageMinutes))}</span>
            <span>Target ${sla.targetMinutes}m</span>
            <span>${escapeHtml(sla.detail)}</span>
          </div>
          <div class="sla-meter ${sla.state}" aria-label="${escapeHtml(`${sla.label}: age ${formatDuration(sla.ageMinutes)} of ${sla.targetMinutes} minutes`)}">
            <div class="progress-bar" style="--value: ${sla.progress}%"></div>
          </div>
        </div>
        ${ticketActionButtons(ticket)}
      </article>
    `;
  }
  
  function getOrderProgressSummary(order) {
    return summarizeOrderProgress(order, state.tickets);
  }
  
  function getStationProgressRows(order) {
    const tickets = state.tickets.filter((ticket) => ticket.orderId === order.id);
    const byStation = new Map();
    tickets.forEach((ticket) => {
      const rows = byStation.get(ticket.station) || [];
      rows.push(ticket);
      byStation.set(ticket.station, rows);
    });
  
    return [...byStation.entries()].map(([station, stationTickets]) => {
      const summary = getKitchenSlaSummary(stationTickets.filter((ticket) => ticket.status !== "Done"));
      const ready = stationTickets.filter((ticket) => ticket.status === "Ready" || ticket.status === "Done").length;
      const completed = stationTickets.filter((ticket) => ticket.status === "Done").length;
      const status = stationTickets.some((ticket) => ticket.status === "Delayed")
        ? "Delayed"
        : completed === stationTickets.length
          ? "Complete"
          : ready === stationTickets.length
          ? "Ready"
          : stationTickets.some((ticket) => ticket.status === "Preparing")
            ? "Preparing"
            : stationTickets.some((ticket) => ticket.status === "Accepted")
              ? "Accepted"
              : "New";
      const className = status === "Delayed" || summary.escalated ? "danger" : status === "Ready" || status === "Complete" ? "ok" : status === "New" ? "warning" : "info";
      return { station, status, className, ready, total: stationTickets.length };
    });
  }
  
  function orderProgressCard(order) {
    const summary = getOrderProgressSummary(order);
    const stationRows = getStationProgressRows(order);
    return `
      <article class="order-progress-card">
        <header>
          <div>
            <strong>#${order.number} ${escapeHtml(orderLocationLabel(order))}</strong>
            <p>${summary.finished}/${summary.total} station ${summary.total === 1 ? "task" : "tasks"} ready · ${escapeHtml(orderTypeLabel(order))}</p>
          </div>
          <span class="pill ${summary.className}">${escapeHtml(summary.status)}</span>
        </header>
        <div class="progress-track"><div class="progress-bar" style="--value: ${summary.percent}%"></div></div>
        <div class="station-progress-list">
          ${stationRows.map((row) => `
            <div class="station-progress-row">
              <span>${escapeHtml(row.station)}</span>
              <strong>${row.ready}/${row.total} · ${escapeHtml(row.status)}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }
  
  function renderKitchenOrderProgress() {
    const container = document.querySelector("#kitchenOrderProgress");
    if (!container) return;
  
    const kitchenOrders = state.orders
      .filter((order) => ["Sent to kitchen", "Preparing", "Delayed", "Ready", "Served"].includes(order.status))
      .filter((order) => state.tickets.some((ticket) => ticket.orderId === order.id))
      .slice()
      .sort((first, second) => (second.createdAtMs || 0) - (first.createdAtMs || 0));
  
    container.innerHTML = kitchenOrders.length
      ? kitchenOrders.map(orderProgressCard).join("")
      : emptyState("No kitchen progress to show.");
  }
  
  return {
    renderKitchen,
    renderKitchenOrderProgress
  };
}

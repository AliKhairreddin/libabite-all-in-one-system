import {
  KITCHEN_STATIONS,
  MINUTE_MS,
  SLA_WARNING_WINDOW_MINUTES,
  TICKET_SLA_MINUTES
} from "../shared/constants.js";
import { formatDuration } from "../shared/dates.js";
import { normalizeKitchenStation } from "../data/normalize.js";
import { normalizeOrderType } from "../domain/orders.js";
import { state } from "./state.js";
import { orderById } from "./entities.js";

export function getStationNames() {
  const stations = new Set(KITCHEN_STATIONS);
  state.products.filter((product) => product.active).forEach((product) => stations.add(normalizeKitchenStation(product.station)));
  getOpenTickets().forEach((ticket) => stations.add(normalizeKitchenStation(ticket.station)));
  const knownStations = KITCHEN_STATIONS.filter((station) => stations.has(station));
  const customStations = [...stations]
    .filter((station) => !KITCHEN_STATIONS.includes(station))
    .sort((first, second) => first.localeCompare(second));
  return ["All", ...knownStations, ...customStations];
}

export function getOpenTickets() {
  return state.tickets.filter((ticket) => ticket.status !== "Done");
}

export function getTicketTargetMinutes(ticket) {
  return Number(ticket.slaMinutes) || TICKET_SLA_MINUTES[ticket.station] || TICKET_SLA_MINUTES.default;
}

export function getTicketAgeMinutes(ticket, now = Date.now()) {
  const endTime = ticket.readyAtMs || ticket.completedAtMs || now;
  return Math.max(0, Math.floor((endTime - ticket.createdAtMs) / MINUTE_MS));
}

export function getTicketOrderAgeMinutes(ticket, now = Date.now()) {
  const order = orderById(ticket.orderId);
  const startedAt = order?.createdAtMs || ticket.createdAtMs;
  const endTime = ticket.completedAtMs || now;
  return Math.max(0, Math.floor((endTime - startedAt) / MINUTE_MS));
}

export function getTicketSla(ticket, now = Date.now()) {
  const targetMinutes = getTicketTargetMinutes(ticket);
  const ageMinutes = getTicketAgeMinutes(ticket, now);
  const remainingMinutes = targetMinutes - ageMinutes;
  const progress = Math.min(100, Math.max(4, Math.round((ageMinutes / targetMinutes) * 100)));

  if (ticket.status === "Delayed") {
    return {
      state: "delayed",
      label: "Delayed",
      pillClass: "danger",
      cardClass: "sla-delayed",
      detail: ticket.issueNote ? `Issue: ${ticket.issueNote}` : "Issue needs manager attention",
      ageMinutes,
      targetMinutes,
      progress: 100
    };
  }

  if (ticket.status === "Ready" || ticket.status === "Done") {
    return {
      state: "ready",
      label: "Ready",
      pillClass: "ok",
      cardClass: "sla-ready",
      detail: `Ready in ${formatDuration(ageMinutes)}`,
      ageMinutes,
      targetMinutes,
      progress
    };
  }

  if (remainingMinutes <= 0) {
    return {
      state: "escalated",
      label: "Escalated",
      pillClass: "danger",
      cardClass: "sla-escalated",
      detail: `${formatDuration(Math.abs(remainingMinutes))} over target`,
      ageMinutes,
      targetMinutes,
      progress: 100
    };
  }

  if (remainingMinutes <= SLA_WARNING_WINDOW_MINUTES) {
    return {
      state: "warning",
      label: "Warn",
      pillClass: "warning",
      cardClass: "sla-warning",
      detail: `${formatDuration(remainingMinutes)} to target`,
      ageMinutes,
      targetMinutes,
      progress
    };
  }

  return {
    state: "aging",
    label: "Aging",
    pillClass: "info",
    cardClass: "sla-aging",
    detail: `${formatDuration(remainingMinutes)} to target`,
    ageMinutes,
    targetMinutes,
    progress
  };
}

export function getTicketPriority(ticket, now = Date.now()) {
  const order = orderById(ticket.orderId);
  const sla = getTicketSla(ticket, now);
  if (ticket.status === "Delayed" || sla.state === "escalated") return { label: "Urgent", className: "danger" };
  if (sla.state === "warning" || order?.fulfillment === "Delivery") return { label: "High", className: "warning" };
  if (order?.fulfillment === "Pickup" || normalizeOrderType(order?.channel) === "External delivery app order") {
    return { label: "High", className: "warning" };
  }
  return { label: "Normal", className: "info" };
}

export function getTicketStatusLabel(status) {
  if (status === "Queued") return "New";
  if (status === "Done") return "Complete";
  return status;
}

export function ticketStatusClass(status) {
  if (status === "Ready" || status === "Done") return "ok";
  if (status === "Preparing" || status === "Accepted") return "info";
  if (status === "Delayed") return "danger";
  return "warning";
}

export function getKitchenSlaSummary(tickets = getOpenTickets(), now = Date.now()) {
  return tickets.reduce((summary, ticket) => {
    const sla = getTicketSla(ticket, now);
    summary.total += 1;
    summary[sla.state] = (summary[sla.state] || 0) + 1;
    return summary;
  }, { total: 0, aging: 0, warning: 0, escalated: 0, delayed: 0, ready: 0 });
}

export function getSlaSummaryLabel(summary) {
  const issues = [];
  if (summary.delayed) issues.push(`${summary.delayed} delayed`);
  if (summary.escalated) issues.push(`${summary.escalated} escalated`);
  if (summary.warning) issues.push(`${summary.warning} warning`);
  if (issues.length) return issues.join(", ");
  if (summary.total) return "All within SLA";
  return "Kitchen clear";
}

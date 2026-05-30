import { TICKET_STATUSES, TICKET_STATUS_FLOW } from "../shared/constants.js";
export function advanceStatus(current) {
    if (current === "Delayed")
        return "Preparing";
    return TICKET_STATUS_FLOW[Math.min(TICKET_STATUS_FLOW.indexOf(current) + 1, TICKET_STATUS_FLOW.length - 1)] || "Queued";
}
export function setTicketStatus(ticket, status, options = {}) {
    if (!TICKET_STATUSES.includes(status))
        return false;
    const now = options.now ?? Date.now();
    ticket.status = status;
    if (["Accepted", "Preparing", "Delayed", "Ready", "Done"].includes(status) && !ticket.acceptedAtMs) {
        ticket.acceptedAtMs = now;
    }
    if (status === "Preparing" && !ticket.startedAtMs) {
        ticket.startedAtMs = now;
    }
    if (status === "Delayed" && !ticket.delayedAtMs) {
        ticket.delayedAtMs = now;
    }
    if (status === "Ready" && !ticket.readyAtMs) {
        if (!ticket.startedAtMs)
            ticket.startedAtMs = now;
        ticket.readyAtMs = now;
    }
    if (status === "Done" && !ticket.completedAtMs) {
        if (!ticket.startedAtMs)
            ticket.startedAtMs = now;
        if (!ticket.readyAtMs)
            ticket.readyAtMs = now;
        ticket.completedAtMs = now;
    }
    return true;
}
export function getOrderProgressSummary(order, tickets = []) {
    const orderTickets = tickets.filter((ticket) => ticket.orderId === order.id);
    const finished = orderTickets.filter((ticket) => ticket.status === "Ready" || ticket.status === "Done").length;
    const completed = orderTickets.filter((ticket) => ticket.status === "Done").length;
    const delayed = orderTickets.filter((ticket) => ticket.status === "Delayed").length;
    const preparing = orderTickets.filter((ticket) => ticket.status === "Preparing").length;
    const accepted = orderTickets.filter((ticket) => ticket.status === "Accepted").length;
    const total = orderTickets.length;
    const percent = total ? Math.round((finished / total) * 100) : 0;
    let status = order.status;
    if (delayed)
        status = "Delayed";
    else if (total && completed === total)
        status = "Complete";
    else if (total && finished === total)
        status = "Ready";
    else if (preparing)
        status = "Preparing";
    else if (accepted)
        status = "Accepted";
    else if (finished)
        status = "In progress";
    else if (total)
        status = "New";
    const className = status === "Delayed" ? "danger" : status === "Ready" || status === "Complete" ? "ok" : status === "New" ? "warning" : "info";
    return { tickets: orderTickets, finished, completed, delayed, preparing, accepted, total, percent, status, className };
}
//# sourceMappingURL=kitchen.js.map
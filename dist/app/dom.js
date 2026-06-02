import { escapeHtml } from "../shared/html.js";
let toastTimeout;
export function createNode(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}
export function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
}
export function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast)
        return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}
//# sourceMappingURL=dom.js.map
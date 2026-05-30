import { createQrToken } from "../data/normalize.js";
import { saveState, state } from "./state.js";
import { timeNow } from "../shared/dates.js";
export function createQrRuntime(deps) {
    const { can, render, showToast, tableById } = deps;
    function qrCodeById(id) {
        return state.tableQrCodes.find((code) => code.id === id);
    }
    function qrCodeByToken(token) {
        return state.tableQrCodes.find((code) => code.token === token);
    }
    function getActiveQrCodeForTable(tableId) {
        return state.tableQrCodes.find((code) => code.tableId === tableId && code.status === "Active") || null;
    }
    function getQrBaseUrl() {
        const base = `${window.location.origin}${window.location.pathname}`;
        return window.location.protocol === "file:" ? window.location.pathname : base;
    }
    function getQrOrderUrl(code) {
        const separator = getQrBaseUrl().includes("?") ? "&" : "?";
        return `${getQrBaseUrl()}${separator}qr=${encodeURIComponent(code.token)}`;
    }
    function getStaffUrl() {
        return getQrBaseUrl();
    }
    function getWebsiteOrderingUrl() {
        const separator = getQrBaseUrl().includes("?") ? "&" : "?";
        return `${getQrBaseUrl()}${separator}order=website`;
    }
    function getCustomerQrSession() {
        const params = new URLSearchParams(window.location.search);
        const token = String(params.get("qr") || "").trim();
        const tableParam = String(params.get("table") || "").trim();
        if (!token && !tableParam)
            return null;
        if (token) {
            const code = qrCodeByToken(token);
            if (!code)
                return { error: "This QR code is not recognized.", code: null, table: null };
            const table = tableById(code.tableId);
            if (!table)
                return { error: "This QR code is not assigned to a table.", code, table: null };
            if (code.status !== "Active")
                return { error: `${table.name} ordering is disabled.`, code, table };
            return { error: "", code, table };
        }
        const table = tableById(tableParam);
        if (!table)
            return { error: "This table link is not recognized.", code: null, table: null };
        const code = getActiveQrCodeForTable(table.id);
        if (!code)
            return { error: `${table.name} does not have an active QR code.`, code: null, table };
        return { error: "", code, table };
    }
    function getWebsiteOrderSession() {
        const params = new URLSearchParams(window.location.search);
        const route = String(params.get("order") || params.get("website") || params.get("channel") || "").trim().toLowerCase();
        if (route !== "website" && route !== "online" && route !== "web")
            return null;
        return { error: "", mode: "website" };
    }
    function getCustomerOrderingSession() {
        const qrSession = getCustomerQrSession();
        if (qrSession)
            return { ...qrSession, mode: "qr" };
        return getWebsiteOrderSession();
    }
    function createTableQrCode(formData) {
        if (!can("canEditSettings")) {
            showToast("This role cannot manage QR codes.");
            return;
        }
        const table = tableById(formData.get("tableId"));
        if (!table) {
            showToast("Choose a table before creating a QR code.");
            return;
        }
        state.tableQrCodes
            .filter((code) => code.tableId === table.id && code.status === "Active")
            .forEach((code) => {
            code.status = "Disabled";
        });
        const token = createQrToken(table.id, new Set(state.tableQrCodes.map((code) => code.token)));
        state.tableQrCodes.push({
            id: `qr-${table.id}-${Date.now()}`,
            tableId: table.id,
            area: String(formData.get("area") || table.zone || "Dining room").trim(),
            token,
            status: "Active",
            createdAt: timeNow(),
            regeneratedAt: ""
        });
        saveState();
        render();
        showToast(`${table.name} QR code created.`);
    }
    function assignQrCode(qrCodeId) {
        if (!can("canEditSettings")) {
            showToast("This role cannot manage QR codes.");
            return;
        }
        const code = qrCodeById(qrCodeId);
        const tableSelect = document.querySelector(`[data-qr-table="${qrCodeId}"]`);
        const areaInput = document.querySelector(`[data-qr-area="${qrCodeId}"]`);
        const table = tableById(tableSelect?.value);
        if (!code || !table) {
            showToast("Choose a valid table for that QR code.");
            return;
        }
        code.tableId = table.id;
        code.area = String(areaInput?.value || table.zone || "Dining room").trim();
        if (code.status === "Active") {
            state.tableQrCodes
                .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
                .forEach((item) => {
                item.status = "Disabled";
            });
        }
        saveState();
        render();
        showToast(`${code.token} assigned to ${table.name}.`);
    }
    function toggleQrCode(qrCodeId) {
        if (!can("canEditSettings")) {
            showToast("This role cannot manage QR codes.");
            return;
        }
        const code = qrCodeById(qrCodeId);
        if (!code)
            return;
        code.status = code.status === "Active" ? "Disabled" : "Active";
        if (code.status === "Active") {
            state.tableQrCodes
                .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
                .forEach((item) => {
                item.status = "Disabled";
            });
        }
        saveState();
        render();
        showToast(`QR code ${code.status.toLowerCase()}.`);
    }
    function regenerateQrCode(qrCodeId) {
        if (!can("canEditSettings")) {
            showToast("This role cannot manage QR codes.");
            return;
        }
        const code = qrCodeById(qrCodeId);
        if (!code)
            return;
        code.token = createQrToken(code.tableId, new Set(state.tableQrCodes.filter((item) => item.id !== code.id).map((item) => item.token)));
        code.status = "Active";
        code.regeneratedAt = timeNow();
        state.tableQrCodes
            .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
            .forEach((item) => {
            item.status = "Disabled";
        });
        saveState();
        render();
        showToast("QR code regenerated; the previous link is disabled.");
    }
    function openQrCustomerUrl(qrCodeId) {
        const code = qrCodeById(qrCodeId);
        if (!code)
            return;
        window.open(getQrOrderUrl(code), "_blank", "noopener");
    }
    return {
        assignQrCode,
        createTableQrCode,
        getActiveQrCodeForTable,
        getCustomerOrderingSession,
        getCustomerQrSession,
        getQrOrderUrl,
        getStaffUrl,
        getWebsiteOrderSession,
        getWebsiteOrderingUrl,
        openQrCustomerUrl,
        qrCodeById,
        regenerateQrCode,
        toggleQrCode
    };
}
//# sourceMappingURL=qr.js.map
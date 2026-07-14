export function captureWebsiteCheckoutDraft(formData) {
    const values = {};
    formData.forEach((rawValue, rawName) => {
        const name = String(rawName || "");
        if (!name || typeof rawValue !== "string")
            return;
        if (!Object.prototype.hasOwnProperty.call(values, name))
            values[name] = [];
        values[name].push(rawValue);
    });
    return { values };
}
export function restoreWebsiteCheckoutDraftControls(controls, draft) {
    const values = draft?.values || {};
    for (const control of controls) {
        const name = String(control?.name || "");
        if (!name)
            continue;
        const savedValues = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : [];
        const type = String(control.type || "").toLowerCase();
        if (type === "radio" || type === "checkbox") {
            control.checked = savedValues.includes(String(control.value ?? "on"));
            continue;
        }
        if (savedValues.length)
            control.value = savedValues[savedValues.length - 1];
    }
}
//# sourceMappingURL=checkout-draft.js.map
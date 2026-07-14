export type WebsiteCheckoutDraft = {
  values: Record<string, string[]>;
};

type CheckoutDraftFormData = {
  forEach(callback: (value: FormDataEntryValue, name: string) => void): void;
};

type CheckoutDraftControl = {
  name?: string;
  type?: string;
  value?: string;
  checked?: boolean;
};

export function captureWebsiteCheckoutDraft(formData: CheckoutDraftFormData): WebsiteCheckoutDraft {
  const values: Record<string, string[]> = {};
  formData.forEach((rawValue, rawName) => {
    const name = String(rawName || "");
    if (!name || typeof rawValue !== "string") return;
    if (!Object.prototype.hasOwnProperty.call(values, name)) values[name] = [];
    values[name].push(rawValue);
  });
  return { values };
}

export function restoreWebsiteCheckoutDraftControls(
  controls: Iterable<CheckoutDraftControl>,
  draft: WebsiteCheckoutDraft | null | undefined
) {
  const values = draft?.values || {};
  for (const control of controls) {
    const name = String(control?.name || "");
    if (!name) continue;
    const savedValues = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : [];
    const type = String(control.type || "").toLowerCase();
    if (type === "radio" || type === "checkbox") {
      control.checked = savedValues.includes(String(control.value ?? "on"));
      continue;
    }
    if (savedValues.length) control.value = savedValues[savedValues.length - 1];
  }
}

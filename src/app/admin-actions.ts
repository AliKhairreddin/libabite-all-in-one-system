import {
  DEFAULT_RECEIPT_PRINTER_SETTINGS,
  DEFAULT_RESTAURANT_SETTINGS,
  KITCHEN_STATIONS,
  LANGUAGE_OPTIONS,
  ROLE_DEFINITIONS
} from "../shared/constants.js";
import { normalizeKitchenStation, normalizeReceiptPrinterSettings, normalizeRestaurantSettings } from "../data/normalize.js";
import { enqueueReceiptPrintJob } from "./receipt-printing.js";
import { uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";

export function createAdminActionsRuntime(deps) {
  const {
    can,
    render,
    roleDefinition,
    showToast
  } = deps;

  function createStaffUser(formData) {
    if (!can("canCreateUsers")) {
      showToast("Only Owner/Admin can create staff users.");
      return;
    }

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "");
    const password = String(formData.get("password") || "").trim();
    const planned = String(formData.get("planned") || "12:00-20:00").trim();
    const station = normalizeKitchenStation(formData.get("station"));

    if (!name || !email || !ROLE_DEFINITIONS[role] || role === "owner_admin" || password.length < 4) {
      showToast("Add a name, email, staff role, and password of at least 4 characters.");
      return;
    }

    if (state.users.some((user) => user.email === email)) {
      showToast("A user with that email already exists.");
      return;
    }

    const id = uniqueRecordId(email.split("@")[0], [state.users, state.staff, state.drivers]);
    const roleInfo = roleDefinition(role);
    state.users.push({
      id,
      name,
      email,
      role,
      station: role === "kitchen_staff" && KITCHEN_STATIONS.includes(station) ? station : "",
      password,
      status: "Active"
    });
    state.staff.push({
      id,
      name,
      role: roleInfo.operationalRole,
      planned,
      clocked: "-",
      status: "Starts soon"
    });

    if (role === "driver") {
      state.drivers.push({
        id,
        name,
        status: "Available",
        eta: "-",
        orderId: null,
        location: "Restaurant"
      });
    }

    saveState();
    render();
    showToast(`${name} can now log in as ${roleInfo.label}.`);
  }

  function saveRestaurantSettings(formData) {
    if (!can("canEditSettings")) {
      showToast("This role cannot edit restaurant settings.");
      return;
    }

    const defaultLanguage = String(formData.get("defaultLanguage") || DEFAULT_RESTAURANT_SETTINGS.defaultLanguage);
    const supportedLanguages = formData.getAll("supportedLanguages").filter((language) => {
      return LANGUAGE_OPTIONS.some((option) => option.id === language);
    });
    if (!supportedLanguages.includes(defaultLanguage)) supportedLanguages.push(defaultLanguage);

    state.restaurantSettings = normalizeRestaurantSettings({
      restaurantName: String(formData.get("restaurantName") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      currency: "EUR",
      opensAt: String(formData.get("opensAt") || ""),
      closesAt: String(formData.get("closesAt") || ""),
      defaultLanguage,
      supportedLanguages
    });
    state.receiptPrinterSettings = normalizeReceiptPrinterSettings({
      ...DEFAULT_RECEIPT_PRINTER_SETTINGS,
      enabled: formData.get("receiptPrinterEnabled") === "on",
      printerId: String(formData.get("receiptPrinterId") || "").trim(),
      printerName: String(formData.get("receiptPrinterName") || "").trim(),
      connection: "network-escpos",
      host: String(formData.get("receiptPrinterHost") || "").trim(),
      port: Number(formData.get("receiptPrinterPort") || DEFAULT_RECEIPT_PRINTER_SETTINGS.port),
      paperWidth: Number(formData.get("receiptPrinterPaperWidth") || DEFAULT_RECEIPT_PRINTER_SETTINGS.paperWidth),
      copies: Number(formData.get("receiptPrinterCopies") || DEFAULT_RECEIPT_PRINTER_SETTINGS.copies),
      printOnOrderSent: formData.get("receiptPrintOnOrderSent") === "on",
      printOnPaid: formData.get("receiptPrintOnPaid") === "on",
      printOnQrOrder: formData.get("receiptPrintOnQrOrder") === "on",
      printOnWebsitePayment: formData.get("receiptPrintOnWebsitePayment") === "on",
      printOnExternalImport: formData.get("receiptPrintOnExternalImport") === "on",
      cutPaper: formData.get("receiptPrinterCutPaper") === "on",
      openCashDrawer: formData.get("receiptPrinterOpenDrawer") === "on",
      maxAttempts: Number(formData.get("receiptPrinterMaxAttempts") || DEFAULT_RECEIPT_PRINTER_SETTINGS.maxAttempts)
    });

    saveState();
    render();
    showToast("Restaurant settings saved.");
  }

  function queueReceiptPrinterTest() {
    if (!can("canEditSettings")) {
      showToast("This role cannot test receipt printers.");
      return;
    }

    const job = enqueueReceiptPrintJob({ id: "", number: 0 }, "test_print", {
      force: true,
      detail: "Printer test from Settings"
    });
    saveState();
    render();
    showToast(job ? "Receipt printer test queued." : "Could not queue receipt printer test.");
  }

  return {
    createStaffUser,
    queueReceiptPrinterTest,
    saveRestaurantSettings
  };
}

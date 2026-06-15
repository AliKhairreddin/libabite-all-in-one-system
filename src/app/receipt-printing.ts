import { DEFAULT_RECEIPT_PRINTER_SETTINGS } from "../shared/constants.js";
import { state } from "./state.js";

const ACTIVE_JOB_STATUSES = new Set(["queued", "claimed"]);

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function jobId(nowMs = Date.now()) {
  const random = Math.random().toString(36).slice(2, 8);
  return `RCP-${nowMs}-${random}`;
}

export function getReceiptPrinterSettings() {
  return {
    ...DEFAULT_RECEIPT_PRINTER_SETTINGS,
    ...(state.receiptPrinterSettings || {})
  };
}

export function isReceiptPrintTriggerEnabled(trigger, settings = getReceiptPrinterSettings()) {
  if (!settings.enabled && trigger !== "manual_reprint" && trigger !== "test_print") return false;
  if (trigger === "order_sent") return Boolean(settings.printOnOrderSent);
  if (trigger === "order_paid") return Boolean(settings.printOnPaid);
  if (trigger === "qr_order_sent") return Boolean(settings.printOnQrOrder);
  if (trigger === "website_payment_paid") return Boolean(settings.printOnWebsitePayment);
  if (trigger === "external_order_imported") return Boolean(settings.printOnExternalImport);
  return true;
}

export function receiptPrintDedupeKey(orderId, trigger, printerId) {
  return `receipt:${printerId}:${orderId || "test"}:${trigger}:v1`;
}

export function enqueueReceiptPrintJob(order, trigger = "manual_reprint", options: any = {}) {
  const settings = getReceiptPrinterSettings();
  const orderId = cleanText(order?.id);
  if (!orderId && trigger !== "test_print") return null;
  if (!isReceiptPrintTriggerEnabled(trigger, settings) && !options.force) return null;

  const nowMs = Date.now();
  const printerId = cleanText(options.printerId, settings.printerId);
  const id = jobId(nowMs);
  const dedupeKey = options.dedupeKey
    || (options.force || trigger === "manual_reprint" || trigger === "test_print"
      ? `receipt:${printerId}:${orderId || "test"}:${trigger}:${id}`
      : receiptPrintDedupeKey(orderId, trigger, printerId));
  const jobs = Array.isArray(state.receiptPrintJobs) ? state.receiptPrintJobs : [];
  const existing = jobs.find((job) => job.dedupeKey === dedupeKey && job.status !== "cancelled");
  if (existing && !options.force) return existing;

  const job: any = {
    id,
    orderId,
    orderNumber: Math.max(0, Math.floor(Number(order?.number) || 0)),
    trigger,
    status: "queued",
    printerId,
    printerName: cleanText(options.printerName, settings.printerName),
    copies: Math.max(1, Math.min(5, Math.floor(Number(options.copies) || Number(settings.copies) || 1))),
    attemptCount: 0,
    maxAttempts: Math.max(1, Math.min(10, Math.floor(Number(settings.maxAttempts) || 3))),
    dedupeKey,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    claimedAtMs: "",
    claimedBy: "",
    printedAtMs: "",
    failedAtMs: "",
    error: "",
    detail: options.detail || ""
  };

  state.receiptPrintJobs = [job, ...jobs].slice(0, 250);
  return job;
}

export function getReceiptPrintJobsForOrder(orderId) {
  return (Array.isArray(state.receiptPrintJobs) ? state.receiptPrintJobs : [])
    .filter((job) => job.orderId === orderId)
    .sort((first, second) => Number(second.updatedAtMs || second.createdAtMs) - Number(first.updatedAtMs || first.createdAtMs));
}

export function getReceiptPrintSummary(orderId) {
  const jobs = getReceiptPrintJobsForOrder(orderId);
  const latest = jobs[0];
  if (!latest) {
    return {
      job: null,
      label: "Not queued",
      detail: "No receipt print job has been created.",
      className: "warning",
      active: false,
      failed: false,
      printed: false
    };
  }

  const status = cleanText(latest.status, "queued");
  const attemptLabel = latest.attemptCount ? ` Attempt ${latest.attemptCount}/${latest.maxAttempts || 3}.` : "";
  const errorLabel = latest.error ? ` ${latest.error}` : "";
  const labels = {
    queued: "Queued",
    claimed: "Printing",
    printed: "Printed",
    failed: "Failed",
    cancelled: "Cancelled"
  };
  const className = status === "printed" ? "ok" : status === "failed" ? "danger" : status === "cancelled" ? "warning" : "info";

  return {
    job: latest,
    label: labels[status] || "Queued",
    detail: `${latest.printerName || "Receipt printer"}.${attemptLabel}${errorLabel}`.trim(),
    className,
    active: ACTIVE_JOB_STATUSES.has(status),
    failed: status === "failed",
    printed: status === "printed"
  };
}

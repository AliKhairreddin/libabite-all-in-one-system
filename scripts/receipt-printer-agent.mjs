#!/usr/bin/env node
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const dryRun = process.env.RECEIPT_DRY_RUN === "true" || args.has("--dry-run");
const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
const appStateKey = process.env.CONVEX_STATE_KEY || process.env.VITE_CONVEX_STATE_KEY || "libabite-main";
const agentId = process.env.RECEIPT_AGENT_ID || `receipt-agent-${process.pid}`;
const pollMs = Math.max(1000, Number(process.env.RECEIPT_POLL_MS) || 2500);

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: npm run printer:agent -- [--once] [--dry-run]

Environment:
  CONVEX_URL or VITE_CONVEX_URL          Convex deployment URL
  CONVEX_STATE_KEY or VITE_CONVEX_STATE_KEY  App state key, defaults to libabite-main
  RECEIPT_PRINTER_HOST                  Network ESC/POS printer IP or hostname
  RECEIPT_PRINTER_PORT                  Printer TCP port, defaults to 9100
  RECEIPT_DRY_RUN=true                  Render receipt text without contacting hardware`);
  process.exit(0);
}

if (!convexUrl) {
  console.error("Missing CONVEX_URL or VITE_CONVEX_URL.");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function ascii(value) {
  return cleanText(value)
    .replace(/€/g, "EUR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function money(value) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

function productById(state, id) {
  return (state.products || []).find((product) => product.id === id);
}

function tableById(state, id) {
  return (state.tables || []).find((table) => table.id === id);
}

function vatRate(product) {
  if (product?.vatSetting === "standard") return 0.21;
  if (product?.vatSetting === "zero") return 0;
  return 0.09;
}

function orderTotals(state, order) {
  const rows = new Map();
  let total = 0;

  for (const item of order.items || []) {
    const product = productById(state, item.productId);
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const lineTotal = (Number(product?.price) || 0) * quantity;
    const rate = vatRate(product);
    const taxable = lineTotal / (1 + rate);
    const tax = lineTotal - taxable;
    const key = String(rate);
    const current = rows.get(key) || { rate, tax: 0, taxable: 0 };
    current.tax += tax;
    current.taxable += taxable;
    rows.set(key, current);
    total += lineTotal;
  }

  return {
    total,
    subtotalExVat: [...rows.values()].reduce((sum, row) => sum + row.taxable, 0),
    vatRows: [...rows.values()].sort((first, second) => first.rate - second.rate)
  };
}

function wrapText(text, width) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word.slice(0, width);
    } else if ((line.length + 1 + word.length) <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word.slice(0, width);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function center(text, width) {
  const value = ascii(text).slice(0, width);
  const pad = Math.max(0, Math.floor((width - value.length) / 2));
  return `${" ".repeat(pad)}${value}`;
}

function leftRight(left, right, width) {
  const safeLeft = ascii(left);
  const safeRight = ascii(right);
  const room = Math.max(1, width - safeRight.length - 1);
  const leftValue = safeLeft.length > room ? safeLeft.slice(0, room - 1) + "." : safeLeft;
  return `${leftValue}${" ".repeat(Math.max(1, width - leftValue.length - safeRight.length))}${safeRight}`;
}

function orderLocation(state, order) {
  const table = tableById(state, order.tableId);
  if (table) return table.name;
  return order.deliveryAddressLabel || order.deliveryAddress || order.customerName || order.customer || "Walk-in";
}

function buildReceiptText(state, job) {
  const settings = state.restaurantSettings || {};
  const printerSettings = state.receiptPrinterSettings || {};
  const width = Math.max(32, Math.min(64, Number(process.env.RECEIPT_PRINTER_PAPER_WIDTH) || Number(job.paperWidth) || Number(printerSettings.paperWidth) || 42));

  if (job.trigger === "test_print") {
    return [
      center(settings.restaurantName || "LibaBite", width),
      center("RECEIPT PRINTER TEST", width),
      "-".repeat(width),
      leftRight("Agent", agentId, width),
      leftRight("State", appStateKey, width),
      leftRight("Time", new Date().toLocaleString(), width),
      "",
      "If this printed, automatic receipt printing is connected.",
      "\n\n"
    ].join("\n");
  }

  const order = (state.orders || []).find((item) => item.id === job.orderId);
  if (!order) throw new Error(`Order ${job.orderId} not found.`);

  const totals = orderTotals(state, order);
  const lines = [
    center(settings.restaurantName || "LibaBite", width),
    center(settings.location || "", width),
    "-".repeat(width),
    leftRight(`Order #${order.number || order.id}`, order.channel || order.orderType || "", width),
    leftRight("Created", order.createdAt || new Date(order.createdAtMs || Date.now()).toLocaleString(), width),
    leftRight("Location", orderLocation(state, order), width),
    leftRight("Fulfillment", order.fulfillment || "", width),
    leftRight("Staff", order.staffName || "Self service", width),
    "-".repeat(width)
  ];

  for (const item of order.items || []) {
    const product = productById(state, item.productId);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const price = Number(product?.price) || 0;
    const title = `${quantity}x ${product?.name || "Unknown item"}`;
    lines.push(leftRight(title, money(price * quantity), width));
    const detail = [Array.isArray(item.modifiers) ? item.modifiers.join(", ") : "", item.note || item.notes || ""].filter(Boolean).join(" / ");
    if (detail) {
      wrapText(`  ${detail}`, width).forEach((line) => lines.push(line));
    }
  }

  if (order.notes) {
    lines.push("-".repeat(width));
    wrapText(`Order note: ${order.notes}`, width).forEach((line) => lines.push(line));
  }

  lines.push("-".repeat(width));
  lines.push(leftRight("Subtotal excl. VAT", money(totals.subtotalExVat), width));
  for (const row of totals.vatRows) {
    lines.push(leftRight(`VAT ${Math.round(row.rate * 100)}%`, money(row.tax), width));
  }
  lines.push(leftRight("TOTAL", money(totals.total), width));
  lines.push("-".repeat(width));
  lines.push(leftRight("Payment", order.paymentStatus || "Unpaid", width));
  lines.push(leftRight("Method", order.paymentMethod || "-", width));
  if (order.paidAt) lines.push(leftRight("Paid", order.paidAt, width));
  if (order.paymentProcessor) lines.push(leftRight("Processor", order.paymentProcessor, width));
  lines.push("");
  lines.push(center("Thank you", width));
  lines.push("\n\n");
  return lines.join("\n");
}

function escposBuffer(text, options) {
  const parts = [
    Buffer.from([0x1b, 0x40]),
    Buffer.from(ascii(text), "ascii")
  ];
  if (options.openCashDrawer) parts.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  if (options.cutPaper) parts.push(Buffer.from([0x1d, 0x56, 0x41, 0x00]));
  return Buffer.concat(parts);
}

function sendTcp(buffer, host, port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => socket.end(buffer));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`Timed out connecting to ${host}:${port}.`));
    });
    socket.once("error", reject);
    socket.once("close", (hadError) => {
      if (!hadError) resolve();
    });
  });
}

async function printJob(job, state) {
  const settings = state.receiptPrinterSettings || {};
  const host = process.env.RECEIPT_PRINTER_HOST || settings.host;
  const port = Math.max(1, Math.min(65535, Number(process.env.RECEIPT_PRINTER_PORT) || Number(settings.port) || 9100));
  const text = buildReceiptText(state, job);
  const buffer = escposBuffer(text, {
    cutPaper: settings.cutPaper !== false,
    openCashDrawer: Boolean(settings.openCashDrawer)
  });

  if (dryRun) {
    console.log(`\n--- receipt job ${job.id} ---\n${text}`);
    return;
  }
  if (!host) throw new Error("Receipt printer host/IP is not configured.");
  await sendTcp(buffer, host, port);
}

async function reportFailure(job, error) {
  const message = error instanceof Error ? error.message : String(error);
  await client.mutation(api.receiptPrintJobs.fail, {
    appStateKey,
    jobId: job.id,
    error: message,
    agentId
  });
  console.error(`[receipt-agent] ${job.id} failed: ${message}`);
}

async function processOne() {
  const claimed = await client.mutation(api.receiptPrintJobs.claimNext, { appStateKey, agentId });
  if (!claimed?.job) return false;

  const job = claimed.job;
  try {
    await printJob(job, claimed.state);
    await client.mutation(api.receiptPrintJobs.complete, { appStateKey, jobId: job.id, agentId });
    console.log(`[receipt-agent] printed ${job.id}${job.orderNumber ? ` for order #${job.orderNumber}` : ""}`);
  } catch (error) {
    await reportFailure(job, error);
  }
  return true;
}

while (true) {
  try {
    const didWork = await processOne();
    if (once) break;
    if (!didWork) await sleep(pollMs);
  } catch (error) {
    console.error(`[receipt-agent] ${error instanceof Error ? error.message : String(error)}`);
    if (once) process.exit(1);
    await sleep(pollMs);
  }
}

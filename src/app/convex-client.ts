import { ConvexClient } from "convex/browser";

const DEFAULT_STATE_KEY = "libabite-main";

let sharedClient: ConvexClient | null = null;
let sharedClientUrl = "";

export function readConvexEnv(name: string) {
  return String(import.meta.env[name] || "").trim();
}

export function getConvexUrl() {
  return readConvexEnv("VITE_CONVEX_URL");
}

export function getConvexStateKey() {
  return readConvexEnv("VITE_CONVEX_STATE_KEY") || DEFAULT_STATE_KEY;
}

export function isConvexEnabled() {
  return Boolean(getConvexUrl()) && readConvexEnv("VITE_CONVEX_DISABLED") !== "true";
}

export function getSharedConvexClient() {
  const url = getConvexUrl();
  if (!url || !isConvexEnabled()) return null;
  if (!sharedClient || sharedClientUrl !== url) {
    void sharedClient?.close();
    sharedClient = new ConvexClient(url, { unsavedChangesWarning: true });
    sharedClientUrl = url;
  }
  return sharedClient;
}

export async function closeSharedConvexClient() {
  await sharedClient?.close();
  sharedClient = null;
  sharedClientUrl = "";
}

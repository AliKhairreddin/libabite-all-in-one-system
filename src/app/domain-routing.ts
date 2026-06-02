const TEMP_CUSTOMER_HOST = "thatcanadian.dev";
const TEMP_STAFF_HOST = "app.thatcanadian.dev";

function readEnv(name: string) {
  return String(import.meta.env[name] || "").trim();
}

function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, "");
}

function configuredOrigin(name: string) {
  const value = readEnv(name);
  if (!value) return "";
  try {
    return normalizeOrigin(new URL(value).origin);
  } catch {
    return normalizeOrigin(value);
  }
}

function configuredHostname(name: string) {
  const origin = configuredOrigin(name);
  if (!origin) return "";
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function isLocalHost(hostname = window.location.hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "";
}

export function isCustomerHost(hostname = window.location.hostname) {
  if (isLocalHost(hostname)) return false;
  const customerHost = configuredHostname("VITE_CUSTOMER_SITE_URL");
  const staffHost = configuredHostname("VITE_STAFF_APP_URL");
  if (staffHost && hostname === staffHost) return false;
  if (customerHost && hostname === customerHost) return true;
  return hostname === TEMP_CUSTOMER_HOST || hostname === `www.${TEMP_CUSTOMER_HOST}`;
}

export function getCurrentAppUrl() {
  if (window.location.protocol === "file:") return window.location.pathname;
  return `${window.location.origin}${window.location.pathname || "/"}`;
}

export function getCustomerSiteUrl() {
  const configured = configuredOrigin("VITE_CUSTOMER_SITE_URL");
  if (configured) return `${configured}/`;
  if (isLocalHost()) return getCurrentAppUrl();
  if ([TEMP_CUSTOMER_HOST, `www.${TEMP_CUSTOMER_HOST}`, TEMP_STAFF_HOST].includes(window.location.hostname)) {
    return `https://${TEMP_CUSTOMER_HOST}/`;
  }
  return getCurrentAppUrl();
}

export function getStaffAppUrl() {
  const configured = configuredOrigin("VITE_STAFF_APP_URL");
  if (configured) return `${configured}/`;
  if (isLocalHost()) return getCurrentAppUrl();
  if ([TEMP_CUSTOMER_HOST, `www.${TEMP_CUSTOMER_HOST}`, TEMP_STAFF_HOST].includes(window.location.hostname)) {
    return `https://${TEMP_STAFF_HOST}/`;
  }
  return getCurrentAppUrl();
}

export function withQuery(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

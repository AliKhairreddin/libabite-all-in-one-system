import { EXTERNAL_DELIVERY_PLATFORMS } from "../shared/constants.js";
import { normalizeExternalPlatformId } from "./external-delivery.js";

export const EXTERNAL_PLATFORM_ADAPTERS = {
  "uber-eats": {
    id: "uber-eats",
    name: "Uber Eats",
    orderOwnership: "marketplace",
    paymentOwnership: "platform",
    deliveryOwnership: "platform_or_merchant",
    requiredSecrets: ["UBER_EATS_CLIENT_ID", "UBER_EATS_CLIENT_SECRET", "UBER_EATS_STORE_ID"],
    webhookEvents: ["orders.notification", "orders.release"],
    capabilities: ["order_webhook", "fetch_order", "accept_order", "deny_order", "status_push", "menu_sync"],
    fallbackMethods: ["manual", "email", "csv", "staff"],
    docsUrl: "https://developer.uber.com/docs/eats/guides/order-integration"
  },
  thuisbezorgd: {
    id: "thuisbezorgd",
    name: "Thuisbezorgd",
    orderOwnership: "marketplace",
    paymentOwnership: "platform",
    deliveryOwnership: "platform_or_merchant",
    requiredSecrets: ["JET_CONNECT_CLIENT_ID", "JET_CONNECT_CLIENT_SECRET", "JET_CONNECT_LOCATION_ID"],
    webhookEvents: ["incoming_order", "order_cancelled"],
    capabilities: ["pos_order_injection", "item_availability", "status_push", "menu_sync"],
    fallbackMethods: ["manual", "email", "csv", "staff"],
    docsUrl: "https://developers.just-eat.com/documentation"
  },
  "local-delivery": {
    id: "local-delivery",
    name: "Other local delivery platform",
    orderOwnership: "restaurant",
    paymentOwnership: "restaurant",
    deliveryOwnership: "merchant",
    requiredSecrets: [],
    webhookEvents: [],
    capabilities: ["manual_import", "status_tracking"],
    fallbackMethods: ["manual", "staff"],
    docsUrl: ""
  }
};

export function externalPlatformAdapter(platformId) {
  const id = normalizeExternalPlatformId(platformId);
  return EXTERNAL_PLATFORM_ADAPTERS[id] || EXTERNAL_PLATFORM_ADAPTERS[EXTERNAL_DELIVERY_PLATFORMS[0]?.id] || EXTERNAL_PLATFORM_ADAPTERS["local-delivery"];
}

export function externalPlatformRequiredSecrets(platformId) {
  return externalPlatformAdapter(platformId).requiredSecrets;
}

export function getExternalPlatformReadiness(platform: any = {}) {
  const adapter = externalPlatformAdapter(platform.id || platform.platformId);
  const integrationMethod = platform.integrationMethod || "manual";
  const hasApiDetails = Boolean(String(platform.apiDetails || "").trim());
  const apiReady = integrationMethod === "api" && platform.status === "Connected" && hasApiDetails;
  return {
    adapter,
    apiReady,
    mode: apiReady ? "api" : integrationMethod,
    missing: apiReady ? [] : adapter.requiredSecrets,
    fallbackMethods: adapter.fallbackMethods
  };
}

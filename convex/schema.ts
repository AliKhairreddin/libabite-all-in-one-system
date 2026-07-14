import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const operationalRecordFields = {
  appStateKey: v.string(),
  externalId: v.string(),
  name: v.optional(v.string()),
  status: v.optional(v.string()),
  recordHash: v.optional(v.string()),
  raw: v.any(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number())
};

export default defineSchema({
  appStates: defineTable({
    key: v.string(),
    state: v.any(),
    version: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
    clientId: v.optional(v.string())
  }).index("by_key", ["key"]),

  syncEvents: defineTable({
    appStateKey: v.string(),
    type: v.string(),
    payload: v.any(),
    at: v.number(),
    actorId: v.optional(v.string()),
    clientId: v.optional(v.string())
  })
    .index("by_app_state", ["appStateKey", "at"])
    .index("by_type", ["type", "at"]),

  integrationConfigs: defineTable({
    key: v.string(),
    name: v.string(),
    provider: v.string(),
    status: v.string(),
    config: v.any(),
    updatedAt: v.number()
  })
    .index("by_key", ["key"])
    .index("by_provider", ["provider"]),

  notificationOutbox: defineTable({
    appStateKey: v.string(),
    dedupeKey: v.string(),
    recordType: v.string(),
    recordId: v.string(),
    eventType: v.string(),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    provider: v.string(),
    templateKey: v.string(),
    templateVersion: v.number(),
    templateVariables: v.any(),
    status: v.string(),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.number(),
    lastAttemptAt: v.optional(v.number()),
    providerMessageId: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    acceptedAt: v.optional(v.number())
  })
    .index("by_dedupe", ["dedupeKey"])
    .index("by_record", ["appStateKey", "recordType", "recordId"])
    .index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  integrationOutbox: defineTable({
    appStateKey: v.string(),
    dedupeKey: v.string(),
    integration: v.string(),
    operation: v.string(),
    recordType: v.string(),
    recordId: v.string(),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    explicitMarketingConsent: v.boolean(),
    consentedAt: v.optional(v.number()),
    consentPolicyVersion: v.optional(v.string()),
    status: v.string(),
    attemptCount: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.number(),
    lastAttemptAt: v.optional(v.number()),
    providerRecordId: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number())
  })
    .index("by_dedupe", ["dedupeKey"])
    .index("by_record", ["appStateKey", "recordType", "recordId"])
    .index("by_app_email", ["appStateKey", "recipientEmail"])
    .index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  marketingConsents: defineTable({
    appStateKey: v.string(),
    email: v.string(),
    explicitConsent: v.boolean(),
    sourceRecordType: v.string(),
    sourceRecordId: v.string(),
    consentedAt: v.number(),
    policyVersion: v.optional(v.string()),
    mailchimpStatus: v.optional(v.string()),
    updatedAt: v.number()
  })
    .index("by_app_email", ["appStateKey", "email"])
    .index("by_source", ["appStateKey", "sourceRecordType", "sourceRecordId"]),

  restaurantProfiles: defineTable({
    key: v.string(),
    appStateKey: v.string(),
    restaurantName: v.string(),
    location: v.string(),
    currency: v.string(),
    raw: v.any(),
    updatedAt: v.number()
  })
    .index("by_key", ["key"])
    .index("by_app_state", ["appStateKey"]),

  customers: defineTable({
    ...operationalRecordFields,
    phone: v.optional(v.string()),
    email: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_phone", ["phone"])
    .index("by_email", ["email"]),

  orders: defineTable({
    ...operationalRecordFields,
    number: v.optional(v.number()),
    channel: v.optional(v.string()),
    fulfillment: v.optional(v.string()),
    tableId: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    customerId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    requestedTime: v.optional(v.string()),
    waiterPickupStatus: v.optional(v.string()),
    waiterNotifiedAtMs: v.optional(v.number()),
    waiterPickedUpAtMs: v.optional(v.number()),
    servedAtMs: v.optional(v.number()),
    servedByName: v.optional(v.string()),
    totalCents: v.optional(v.number()),
    createdAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_number", ["appStateKey", "number"])
    .index("by_status", ["appStateKey", "status"])
    .index("by_payment_status", ["appStateKey", "paymentStatus"])
    .index("by_created", ["appStateKey", "createdAtMs"]),

  orderItems: defineTable({
    ...operationalRecordFields,
    orderId: v.string(),
    productId: v.string(),
    quantity: v.number(),
    lineTotalCents: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_order", ["appStateKey", "orderId"]),

  payments: defineTable({
    ...operationalRecordFields,
    kind: v.string(),
    provider: v.string(),
    currency: v.string(),
    amountCents: v.number(),
    orderId: v.optional(v.string()),
    reservationId: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    terminalReaderId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    paidAtMs: v.optional(v.number()),
    failedAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_order", ["appStateKey", "orderId"])
    .index("by_reservation", ["appStateKey", "reservationId"])
    .index("by_provider_payment", ["provider", "providerPaymentId"])
    .index("by_checkout_session", ["checkoutSessionId"])
    .index("by_payment_intent", ["paymentIntentId"])
    .index("by_status", ["appStateKey", "status"]),

  reservations: defineTable({
    ...operationalRecordFields,
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    tableId: v.optional(v.string()),
    guests: v.optional(v.number()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    source: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_date_time", ["appStateKey", "date", "time"])
    .index("by_status", ["appStateKey", "status"])
    .index("by_table_date", ["appStateKey", "tableId", "date"]),

  reservationBlocks: defineTable({
    ...operationalRecordFields,
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    active: v.optional(v.boolean())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_date", ["appStateKey", "date"]),

  reservationCapacityRules: defineTable({
    ...operationalRecordFields,
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    maxGuests: v.optional(v.number()),
    maxReservations: v.optional(v.number()),
    active: v.optional(v.boolean())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_date", ["appStateKey", "date"]),

  diningTables: defineTable({
    ...operationalRecordFields,
    capacity: v.optional(v.number()),
    zone: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_zone", ["appStateKey", "zone"]),

  tableQrCodes: defineTable({
    ...operationalRecordFields,
    tableId: v.optional(v.string()),
    token: v.optional(v.string()),
    area: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_token", ["token"])
    .index("by_table", ["appStateKey", "tableId"]),

  teamMembers: defineTable({
    ...operationalRecordFields,
    email: v.optional(v.string()),
    role: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_email", ["email"])
    .index("by_role", ["appStateKey", "role"]),

  staffProfiles: defineTable({
    ...operationalRecordFields,
    role: v.optional(v.string()),
    planned: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_role", ["appStateKey", "role"]),

  staffShifts: defineTable({
    ...operationalRecordFields,
    staffId: v.optional(v.string()),
    staffName: v.optional(v.string()),
    date: v.optional(v.string()),
    startsAt: v.optional(v.string()),
    endsAt: v.optional(v.string()),
    role: v.optional(v.string()),
    station: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_staff_date", ["appStateKey", "staffId", "date"])
    .index("by_date", ["appStateKey", "date"]),

  rolePermissions: defineTable({
    ...operationalRecordFields,
    role: v.string(),
    label: v.string(),
    permissions: v.any(),
    views: v.any()
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_role", ["appStateKey", "role"]),

  drivers: defineTable({
    ...operationalRecordFields,
    orderId: v.optional(v.string()),
    location: v.optional(v.string()),
    eta: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_status", ["appStateKey", "status"]),

  products: defineTable({
    ...operationalRecordFields,
    category: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    active: v.optional(v.boolean())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_category", ["appStateKey", "category"])
    .index("by_active", ["appStateKey", "active"]),

  productRecipes: defineTable({
    ...operationalRecordFields,
    productId: v.string(),
    ingredientId: v.string()
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_product", ["appStateKey", "productId"])
    .index("by_ingredient", ["appStateKey", "ingredientId"]),

  ingredients: defineTable({
    ...operationalRecordFields,
    unit: v.optional(v.string()),
    unitType: v.optional(v.string()),
    stock: v.optional(v.number()),
    active: v.optional(v.boolean()),
    supplierId: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_active", ["appStateKey", "active"])
    .index("by_supplier", ["appStateKey", "supplierId"]),

  inventoryMovements: defineTable({
    ...operationalRecordFields,
    ingredientId: v.optional(v.string()),
    action: v.optional(v.string()),
    quantity: v.optional(v.number()),
    location: v.optional(v.string()),
    staffId: v.optional(v.string()),
    atMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_ingredient", ["appStateKey", "ingredientId"])
    .index("by_action", ["appStateKey", "action"])
    .index("by_at", ["appStateKey", "atMs"]),

  wasteRecords: defineTable({
    ...operationalRecordFields,
    ingredientId: v.optional(v.string()),
    quantity: v.optional(v.number()),
    reason: v.optional(v.string()),
    staffId: v.optional(v.string()),
    atMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_ingredient", ["appStateKey", "ingredientId"])
    .index("by_at", ["appStateKey", "atMs"]),

  suppliers: defineTable({
    ...operationalRecordFields,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    integrationMethod: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_integration", ["appStateKey", "integrationMethod"]),

  supplierOrders: defineTable({
    ...operationalRecordFields,
    supplierId: v.optional(v.string()),
    totalCents: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_supplier", ["appStateKey", "supplierId"])
    .index("by_status", ["appStateKey", "status"]),

  externalPlatforms: defineTable({
    ...operationalRecordFields,
    integrationMethod: v.optional(v.string()),
    commissionRate: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_status", ["appStateKey", "status"]),

  externalProductMappings: defineTable({
    ...operationalRecordFields,
    platformId: v.optional(v.string()),
    productId: v.optional(v.string()),
    externalCode: v.optional(v.string()),
    active: v.optional(v.boolean())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_platform", ["appStateKey", "platformId"])
    .index("by_product", ["appStateKey", "productId"]),

  externalOrderImports: defineTable({
    ...operationalRecordFields,
    platformId: v.optional(v.string()),
    externalOrderId: v.optional(v.string()),
    orderId: v.optional(v.string()),
    importedAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_platform_order", ["appStateKey", "platformId", "externalOrderId"]),

  kitchenTickets: defineTable({
    ...operationalRecordFields,
    orderId: v.optional(v.string()),
    productId: v.optional(v.string()),
    station: v.optional(v.string()),
    quantity: v.optional(v.number()),
    createdAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_order", ["appStateKey", "orderId"])
    .index("by_station_status", ["appStateKey", "station", "status"]),

  procedures: defineTable({
    ...operationalRecordFields,
    frequency: v.optional(v.string()),
    station: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_station", ["appStateKey", "station"]),

  procedureCompletions: defineTable({
    ...operationalRecordFields,
    procedureId: v.optional(v.string()),
    completedById: v.optional(v.string()),
    completedAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_procedure", ["appStateKey", "procedureId"])
    .index("by_completed_at", ["appStateKey", "completedAtMs"]),

  productionLog: defineTable({
    ...operationalRecordFields,
    productId: v.optional(v.string()),
    batchId: v.optional(v.string()),
    producedAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_product", ["appStateKey", "productId"])
    .index("by_produced_at", ["appStateKey", "producedAtMs"]),

  productionBatches: defineTable({
    ...operationalRecordFields,
    productId: v.optional(v.string()),
    producedAtMs: v.optional(v.number())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_product", ["appStateKey", "productId"]),

  terminalDevices: defineTable({
    ...operationalRecordFields,
    provider: v.string(),
    readerId: v.string(),
    locationId: v.optional(v.string()),
    deviceType: v.optional(v.string())
  })
    .index("by_app_external", ["appStateKey", "externalId"])
    .index("by_provider_reader", ["provider", "readerId"])
    .index("by_status", ["appStateKey", "status"])
});

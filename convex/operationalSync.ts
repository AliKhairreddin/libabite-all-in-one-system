const ROLE_PERMISSIONS = [
  {
    role: "owner_admin",
    label: "Owner/Admin",
    views: ["dashboard", "orders", "kitchen", "inventory", "procedures", "team", "settings", "reservations"],
    permissions: {
      canCreateUsers: true,
      canEditSettings: true,
      canResetDemo: true,
      canCreateOrders: true,
      canAdvanceTickets: true,
      canManageInventory: true,
      canRecordWaste: true,
      canManageProducts: true,
      canManageProcedures: true,
      canCreateProcedures: true,
      canReviewProcedures: true,
      canCompleteProcedures: true,
      canManageReservations: true,
      canManageSchedule: true
    }
  },
  {
    role: "manager",
    label: "Manager",
    views: ["dashboard", "orders", "kitchen", "inventory", "procedures", "team", "settings", "reservations"],
    permissions: {
      canEditSettings: true,
      canCreateOrders: true,
      canAdvanceTickets: true,
      canManageInventory: true,
      canRecordWaste: true,
      canManageProducts: true,
      canManageProcedures: true,
      canReviewProcedures: true,
      canCompleteProcedures: true,
      canManageReservations: true,
      canManageSchedule: true
    }
  },
  {
    role: "waiter_cashier",
    label: "Waiter/Cashier",
    views: ["orders", "procedures", "team", "reservations"],
    permissions: {
      canCreateOrders: true,
      canRecordWaste: true,
      canCompleteProcedures: true,
      canManageReservations: true
    }
  },
  {
    role: "kitchen_staff",
    label: "Kitchen staff",
    views: ["kitchen", "procedures", "team"],
    permissions: {
      canAdvanceTickets: true,
      canRecordWaste: true,
      canManageProcedures: true,
      canCompleteProcedures: true
    }
  },
  {
    role: "driver",
    label: "Driver",
    views: ["procedures", "team"],
    permissions: {
      canCompleteProcedures: true
    }
  }
];

function asArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function optionalText(value: any) {
  const text = cleanText(value);
  return text ? text : undefined;
}

function optionalNumber(value: any) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function cents(value: any) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : undefined;
}

function optionalTimestamp(value: any) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function normalizeRaw(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => normalizeRaw(item));
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entryValue]) => [key, normalizeRaw(entryValue)])
  );
}

function recordHash(value: any) {
  return JSON.stringify(normalizeRaw(value));
}

function productMap(state: any) {
  return new Map(asArray(state?.products).map((product: any) => [product.id, product]));
}

function orderLineTotalCents(item: any, productsById: Map<string, any>) {
  const quantity = Math.floor(Number(item?.quantity) || 0);
  const unitPriceCents = Number(item?.unitPriceCents);
  const lineTotalCents = Number(item?.lineTotalCents);
  if (
    quantity > 0
    && Number.isSafeInteger(unitPriceCents)
    && unitPriceCents >= 0
    && Number.isSafeInteger(lineTotalCents)
    && lineTotalCents >= 0
    && lineTotalCents === unitPriceCents * quantity
  ) return lineTotalCents;

  const productPrice = Number(productsById.get(item?.productId)?.price);
  if (quantity < 1 || !Number.isFinite(productPrice) || productPrice < 0) return 0;
  const fallbackTotalCents = Math.round(productPrice * 100) * quantity;
  return Number.isSafeInteger(fallbackTotalCents) ? fallbackTotalCents : 0;
}

function orderTotalCents(order: any, productsById: Map<string, any>) {
  return asArray(order?.items).reduce((sum: number, item: any) => {
    return sum + orderLineTotalCents(item, productsById);
  }, 0);
}

async function upsertOperational(ctx: any, tableName: string, appStateKey: string, externalId: string, patch: any) {
  const cleanExternalId = cleanText(externalId);
  if (!cleanExternalId) return null;

  const raw = normalizeRaw(patch.raw ?? {});
  const nextRecord = {
    ...patch,
    appStateKey,
    externalId: cleanExternalId,
    raw,
    recordHash: patch.recordHash || recordHash({ ...patch, raw }),
    updatedAt: patch.updatedAt || Date.now()
  };

  const existing = await ctx.db
    .query(tableName)
    .withIndex("by_app_external", (query: any) => query.eq("appStateKey", appStateKey).eq("externalId", cleanExternalId))
    .first();

  if (existing) {
    if (existing.recordHash !== nextRecord.recordHash) {
      await ctx.db.patch(existing._id, nextRecord);
    }
    return existing._id;
  }

  return await ctx.db.insert(tableName, nextRecord);
}

async function upsertRestaurantProfile(ctx: any, appStateKey: string, state: any, now: number) {
  const settings = state?.restaurantSettings || {};
  const key = `${appStateKey}:primary`;
  const patch = {
    key,
    appStateKey,
    restaurantName: cleanText(settings.restaurantName) || "Libabite",
    location: cleanText(settings.location),
    currency: cleanText(settings.currency) || "EUR",
    raw: normalizeRaw(settings),
    updatedAt: now
  };
  const existing = await ctx.db
    .query("restaurantProfiles")
    .withIndex("by_key", (query: any) => query.eq("key", key))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }
  return await ctx.db.insert("restaurantProfiles", patch);
}

async function mirrorRoles(ctx: any, appStateKey: string, now: number) {
  for (const role of ROLE_PERMISSIONS) {
    await upsertOperational(ctx, "rolePermissions", appStateKey, role.role, {
      name: role.label,
      status: "Active",
      role: role.role,
      label: role.label,
      permissions: role.permissions,
      views: role.views,
      raw: role,
      updatedAt: now
    });
  }
}

async function mirrorOrders(ctx: any, appStateKey: string, state: any, now: number) {
  const productsById = productMap(state);
  for (const order of asArray(state?.orders)) {
    const totalCents = orderTotalCents(order, productsById);
    await upsertOperational(ctx, "orders", appStateKey, order.id, {
      name: `Order ${order.number || order.id}`,
      status: optionalText(order.status),
      number: optionalNumber(order.number),
      channel: optionalText(order.channel || order.orderType),
      fulfillment: optionalText(order.fulfillment),
      tableId: optionalText(order.tableId),
      paymentStatus: optionalText(order.paymentStatus),
      paymentMethod: optionalText(order.paymentMethod),
      paymentId: optionalText(order.paymentReference || order.stripePaymentIntentId || order.stripeCheckoutSessionId),
      customerId: optionalText(order.customerId),
      customerName: optionalText(order.customerName || order.customer),
      customerPhone: optionalText(order.customerPhone),
      requestedTime: optionalText(order.requestedTime),
      waiterPickupStatus: optionalText(order.waiterPickupStatus),
      waiterNotifiedAtMs: optionalTimestamp(order.waiterNotifiedAtMs),
      waiterPickedUpAtMs: optionalTimestamp(order.waiterPickedUpAtMs),
      servedAtMs: optionalTimestamp(order.servedAtMs),
      servedByName: optionalText(order.servedByName),
      totalCents,
      createdAtMs: optionalTimestamp(order.createdAtMs),
      raw: order,
      updatedAt: now
    });

    for (const [index, item] of asArray(order.items).entries()) {
      const product = productsById.get(item.productId);
      const quantity = Number(item.quantity) || 0;
      await upsertOperational(ctx, "orderItems", appStateKey, `${order.id}:${index + 1}`, {
        name: cleanText(item.productName) || cleanText(product?.name) || item.productId,
        status: optionalText(order.status),
        orderId: cleanText(order.id),
        productId: cleanText(item.productId),
        quantity,
        lineTotalCents: orderLineTotalCents(item, productsById),
        raw: item,
        updatedAt: now
      });
    }

    if (order.paymentReference || order.stripeCheckoutSessionId || order.stripePaymentIntentId || order.paymentStatus === "Paid") {
      await upsertOperational(ctx, "payments", appStateKey, `order-summary:${order.id}`, {
        name: `Order ${order.number || order.id} payment`,
        status: order.paymentStatus === "Paid" ? "paid" : "recorded",
        kind: "online_order",
        provider: cleanText(order.paymentProcessor) || "Stripe",
        currency: "eur",
        amountCents: totalCents,
        orderId: cleanText(order.id),
        paymentMethod: optionalText(order.paymentMethod),
        providerPaymentId: optionalText(order.paymentReference),
        checkoutSessionId: optionalText(order.stripeCheckoutSessionId),
        paymentIntentId: optionalText(order.stripePaymentIntentId),
        customerName: optionalText(order.customerName || order.customer),
        customerEmail: optionalText(order.customerEmail),
        paidAtMs: optionalTimestamp(order.paidAtMs),
        raw: order,
        updatedAt: now
      });
    }
  }
}

async function mirrorPayments(ctx: any, appStateKey: string, state: any, now: number) {
  for (const payment of asArray(state?.payments)) {
    const externalId = cleanText(payment.externalId || payment.id || payment.providerPaymentId || payment.checkoutSessionId);
    if (!externalId) continue;
    await upsertOperational(ctx, "payments", appStateKey, externalId, {
      name: optionalText(payment.name || `${payment.providerLabel || payment.provider || "Payment"} ${payment.orderId || payment.reservationId || externalId}`),
      status: optionalText(payment.status),
      kind: optionalText(payment.kind || "order"),
      provider: optionalText(payment.providerLabel || payment.provider),
      currency: cleanText(payment.currency || "eur"),
      amountCents: Math.max(0, Math.round(Number(payment.amountCents) || (Number(payment.amount) || 0) * 100)),
      orderId: optionalText(payment.orderId),
      reservationId: optionalText(payment.reservationId),
      paymentMethod: optionalText(payment.paymentMethod),
      providerPaymentId: optionalText(payment.providerPaymentId),
      checkoutSessionId: optionalText(payment.checkoutSessionId),
      paymentIntentId: optionalText(payment.paymentIntentId),
      terminalReaderId: optionalText(payment.terminalReaderId),
      customerName: optionalText(payment.customerName),
      customerEmail: optionalText(payment.customerEmail),
      paidAtMs: optionalTimestamp(payment.paidAtMs),
      failedAtMs: optionalTimestamp(payment.failedAtMs),
      raw: payment,
      updatedAt: optionalTimestamp(payment.updatedAtMs) || now
    });
  }
}

async function mirrorProducts(ctx: any, appStateKey: string, state: any, now: number) {
  for (const product of asArray(state?.products)) {
    await upsertOperational(ctx, "products", appStateKey, product.id, {
      name: cleanText(product.name),
      status: product.active === false ? "Inactive" : "Active",
      category: optionalText(product.category),
      priceCents: cents(product.price),
      active: product.active !== false,
      raw: product,
      updatedAt: now
    });

    for (const [index, line] of asArray(product.recipe).entries()) {
      await upsertOperational(ctx, "productRecipes", appStateKey, `${product.id}:${line.ingredientId}:${index + 1}`, {
        name: `${product.name || product.id} recipe line`,
        status: product.active === false ? "Inactive" : "Active",
        productId: cleanText(product.id),
        ingredientId: cleanText(line.ingredientId),
        raw: line,
        updatedAt: now
      });
    }
  }
}

async function mirrorSimpleCollections(ctx: any, appStateKey: string, state: any, now: number) {
  const collections = [
    {
      source: "customers",
      table: "customers",
      fields: (item: any) => ({ phone: optionalText(item.phone), email: optionalText(item.email) })
    },
    {
      source: "reservations",
      table: "reservations",
      fields: (item: any) => ({
        date: optionalText(item.date),
        time: optionalText(item.time),
        tableId: optionalText(item.tableId),
        guests: optionalNumber(item.guests),
        phone: optionalText(item.phone),
        email: optionalText(item.email),
        source: optionalText(item.source)
      })
    },
    {
      source: "reservationBlocks",
      table: "reservationBlocks",
      fields: (item: any) => ({
        date: optionalText(item.date),
        startTime: optionalText(item.startTime),
        endTime: optionalText(item.endTime),
        active: item.active !== false
      })
    },
    {
      source: "reservationCapacityRules",
      table: "reservationCapacityRules",
      fields: (item: any) => ({
        date: optionalText(item.date),
        startTime: optionalText(item.startTime),
        endTime: optionalText(item.endTime),
        maxGuests: optionalNumber(item.maxGuests),
        maxReservations: optionalNumber(item.maxReservations),
        active: item.active !== false
      })
    },
    {
      source: "tables",
      table: "diningTables",
      fields: (item: any) => ({ capacity: optionalNumber(item.capacity), zone: optionalText(item.zone) })
    },
    {
      source: "tableQrCodes",
      table: "tableQrCodes",
      fields: (item: any) => ({ tableId: optionalText(item.tableId), token: optionalText(item.token), area: optionalText(item.area) })
    },
    {
      source: "users",
      table: "teamMembers",
      fields: (item: any) => ({ email: optionalText(item.email), role: optionalText(item.role) })
    },
    {
      source: "staff",
      table: "staffProfiles",
      fields: (item: any) => ({ role: optionalText(item.role), planned: optionalText(item.planned) })
    },
    {
      source: "staffShifts",
      table: "staffShifts",
      fields: (item: any) => ({
        staffId: optionalText(item.staffId),
        staffName: optionalText(item.staffName),
        date: optionalText(item.date),
        startsAt: optionalText(item.startsAt || item.startTime),
        endsAt: optionalText(item.endsAt || item.endTime),
        role: optionalText(item.role),
        station: optionalText(item.station)
      })
    },
    {
      source: "drivers",
      table: "drivers",
      fields: (item: any) => ({ orderId: optionalText(item.orderId), location: optionalText(item.location), eta: optionalText(item.eta) })
    },
    {
      source: "ingredients",
      table: "ingredients",
      fields: (item: any) => ({
        unit: optionalText(item.unit),
        unitType: optionalText(item.unitType),
        stock: optionalNumber(item.stock),
        active: item.active !== false,
        supplierId: optionalText(item.supplierId)
      })
    },
    {
      source: "inventoryHistory",
      table: "inventoryMovements",
      fields: (item: any) => ({
        ingredientId: optionalText(item.ingredientId),
        action: optionalText(item.action),
        quantity: optionalNumber(item.quantity),
        location: optionalText(item.location || item.toLocation || item.fromLocation),
        staffId: optionalText(item.staffId),
        atMs: optionalTimestamp(item.atMs || item.createdAtMs)
      })
    },
    {
      source: "wasteRecords",
      table: "wasteRecords",
      fields: (item: any) => ({
        ingredientId: optionalText(item.ingredientId),
        quantity: optionalNumber(item.quantity),
        reason: optionalText(item.reason),
        staffId: optionalText(item.staffId),
        atMs: optionalTimestamp(item.atMs || item.createdAtMs)
      })
    },
    {
      source: "suppliers",
      table: "suppliers",
      fields: (item: any) => ({ email: optionalText(item.email), phone: optionalText(item.phone), integrationMethod: optionalText(item.integrationMethod) })
    },
    {
      source: "supplierOrders",
      table: "supplierOrders",
      fields: (item: any) => ({ supplierId: optionalText(item.supplierId), totalCents: cents(item.total || item.totalAmount) })
    },
    {
      source: "externalPlatforms",
      table: "externalPlatforms",
      fields: (item: any) => ({ integrationMethod: optionalText(item.integrationMethod), commissionRate: optionalNumber(item.commissionRate) })
    },
    {
      source: "externalProductMappings",
      table: "externalProductMappings",
      fields: (item: any) => ({
        platformId: optionalText(item.platformId),
        productId: optionalText(item.productId),
        externalCode: optionalText(item.externalCode),
        active: item.active !== false
      })
    },
    {
      source: "externalOrderImports",
      table: "externalOrderImports",
      fields: (item: any) => ({
        platformId: optionalText(item.platformId),
        externalOrderId: optionalText(item.externalOrderId),
        orderId: optionalText(item.orderId),
        importedAtMs: optionalTimestamp(item.importedAtMs)
      })
    },
    {
      source: "tickets",
      table: "kitchenTickets",
      fields: (item: any) => ({
        orderId: optionalText(item.orderId),
        productId: optionalText(item.productId),
        station: optionalText(item.station),
        quantity: optionalNumber(item.quantity),
        createdAtMs: optionalTimestamp(item.createdAtMs)
      })
    },
    {
      source: "procedures",
      table: "procedures",
      fields: (item: any) => ({ frequency: optionalText(item.frequency), station: optionalText(item.station) })
    },
    {
      source: "procedureCompletions",
      table: "procedureCompletions",
      fields: (item: any) => ({
        procedureId: optionalText(item.procedureId),
        completedById: optionalText(item.completedById || item.completedByUserId),
        completedAtMs: optionalTimestamp(item.completedAtMs)
      })
    },
    {
      source: "productionLog",
      table: "productionLog",
      fields: (item: any) => ({
        productId: optionalText(item.productId),
        batchId: optionalText(item.batchId),
        producedAtMs: optionalTimestamp(item.producedAtMs || item.createdAtMs)
      })
    },
    {
      source: "productionBatches",
      table: "productionBatches",
      fields: (item: any) => ({
        productId: optionalText(item.productId),
        producedAtMs: optionalTimestamp(item.producedAtMs || item.createdAtMs)
      })
    }
  ];

  for (const collection of collections) {
    for (const [index, item] of asArray(state?.[collection.source]).entries()) {
      const externalId = item.id || `${collection.source}:${index + 1}`;
      await upsertOperational(ctx, collection.table, appStateKey, externalId, {
        name: optionalText(item.name || item.title || item.label || externalId),
        status: optionalText(item.status),
        ...collection.fields(item),
        raw: item,
        updatedAt: now
      });
    }
  }
}

export async function mirrorOperationalTables(ctx: any, appStateKey: string, state: any, now = Date.now()) {
  if (!state || typeof state !== "object") return;
  await upsertRestaurantProfile(ctx, appStateKey, state, now);
  await mirrorRoles(ctx, appStateKey, now);
  await mirrorProducts(ctx, appStateKey, state, now);
  await mirrorOrders(ctx, appStateKey, state, now);
  await mirrorPayments(ctx, appStateKey, state, now);
  await mirrorSimpleCollections(ctx, appStateKey, state, now);
}

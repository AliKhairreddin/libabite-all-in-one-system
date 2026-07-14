import {
  CUSTOMER_QR_CHANNEL,
  DRIVER_IDLE_STATUS,
  EXTERNAL_DELIVERY_ORDER_CHANNEL,
  PHONE_MESSAGE_ORDER_CHANNEL,
  RESERVATION_ACTIVE_STATUSES,
  WEBSITE_ORDER_CHANNEL
} from "../shared/constants.js";
import {
  deliveryIsLate,
  getDeliveryStatus,
  isActiveDelivery,
  isDeliveryOrder
} from "../domain/delivery.js";
import {
  formatShiftHours,
  getShiftMetrics,
  toDateInputString
} from "../domain/scheduling.js";
import { getOrderLineReportingValues, normalizeOrderType } from "../domain/orders.js";
import { state } from "./state.js";
import {
  customerById,
  ingredientById,
  productById,
  supplierById,
  tableById
} from "./entities.js";
import {
  getOrderTotal,
  isOrderPaid,
  normalizeOrderItems
} from "./order-selectors.js";
import {
  getKitchenSlaSummary,
  getOpenTickets,
  getTicketAgeMinutes,
  getTicketSla
} from "./kitchen-selectors.js";
import {
  getIngredientStatus,
  getLowStockIngredients,
  getStockRequirementsForItems,
  getSupplierOrderDrafts,
  getSupplierOrderTotal
} from "./inventory-selectors.js";
import {
  getProductCost,
  getProductMarginProfile
} from "./recipe-selectors.js";

const ORDER_TYPE_BUCKETS = [
  { id: "dineIn", label: "Dine-in" },
  { id: "qr", label: "QR" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
  { id: "website", label: "Website" },
  { id: "externalApps", label: "External apps" }
];

function roundMoney(value) {
  return Math.max(0, Number((Number(value) || 0).toFixed(2)));
}

function roundPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(1)) : 0;
}

function todayDateKey() {
  return toDateInputString();
}

function timestampDateKey(timestamp) {
  const value = Number(timestamp);
  return Number.isFinite(value) && value > 0 ? toDateInputString(new Date(value)) : "";
}

function isTodayTimestamp(timestamp) {
  return timestampDateKey(timestamp) === todayDateKey();
}

function orderContext(order) {
  return {
    channel: order.channel || order.orderType || "Dine-in",
    fulfillment: order.fulfillment || "Kitchen"
  };
}

function reportableOrders(orders = state.orders) {
  return orders.filter((order) => order.status !== "Cancelled");
}

function paidOrClosedOrders(orders = reportableOrders()) {
  return orders.filter((order) => isOrderPaid(order) || ["Served", "Paid"].includes(order.status));
}

function orderTypeBucket(order) {
  const channel = normalizeOrderType(order.channel || order.orderType);
  if (channel === "Dine-in") return "dineIn";
  if (channel === CUSTOMER_QR_CHANNEL) return "qr";
  if (channel === "Takeaway") return "takeaway";
  if (channel === "Delivery") return "delivery";
  if (channel === WEBSITE_ORDER_CHANNEL) return "website";
  if (channel === EXTERNAL_DELIVERY_ORDER_CHANNEL) return "externalApps";
  if (channel === PHONE_MESSAGE_ORDER_CHANNEL && order.fulfillment === "Delivery") return "delivery";
  return "takeaway";
}

function orderTypeLabelFromBucket(bucketId) {
  return ORDER_TYPE_BUCKETS.find((bucket) => bucket.id === bucketId)?.label || "Other";
}

function getTodayOrders() {
  return reportableOrders().filter((order) => isTodayTimestamp(order.createdAtMs));
}

function getOrderCost(order) {
  return normalizeOrderItems(order.items || []).reduce((sum, item) => {
    const product = productById(item.productId);
    return sum + (product ? getProductCost(product, orderContext(order)) * item.quantity : 0);
  }, 0);
}

function getSalesSummary(orders) {
  const revenue = roundMoney(orders.reduce((sum, order) => sum + getOrderTotal(order), 0));
  const paidRevenue = roundMoney(orders.filter(isOrderPaid).reduce((sum, order) => sum + getOrderTotal(order), 0));
  const foodCost = roundMoney(orders.reduce((sum, order) => sum + getOrderCost(order), 0));
  const grossProfit = roundMoney(Math.max(0, revenue - foodCost));
  const itemCount = orders.reduce((sum, order) => {
    return sum + normalizeOrderItems(order.items || []).reduce((lineSum, item) => lineSum + item.quantity, 0);
  }, 0);
  return {
    orderCount: orders.length,
    paidOrderCount: orders.filter(isOrderPaid).length,
    revenue,
    paidRevenue,
    openRevenue: roundMoney(Math.max(0, revenue - paidRevenue)),
    foodCost,
    grossProfit,
    marginPercent: revenue > 0 ? roundPercent((grossProfit / revenue) * 100) : 0,
    averageTicket: orders.length ? roundMoney(revenue / orders.length) : 0,
    itemCount
  };
}

function getOrderTypeBreakdown(orders) {
  const totalRevenue = orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const buckets = new Map(ORDER_TYPE_BUCKETS.map((bucket) => [
    bucket.id,
    {
      ...bucket,
      orders: 0,
      revenue: 0,
      items: 0,
      percent: 0
    }
  ]));

  orders.forEach((order) => {
    const bucket = buckets.get(orderTypeBucket(order));
    if (!bucket) return;
    bucket.orders += 1;
    bucket.revenue = roundMoney(bucket.revenue + getOrderTotal(order));
    bucket.items += normalizeOrderItems(order.items || []).reduce((sum, item) => sum + item.quantity, 0);
  });

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    percent: totalRevenue > 0 ? roundPercent((bucket.revenue / totalRevenue) * 100) : 0
  }));
}

function getProductPerformanceRows(orders = reportableOrders()) {
  const rows = new Map();

  orders.forEach((order) => {
    const productsCountedForOrder = new Set();
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const product = productById(item.productId);
      const historical = getOrderLineReportingValues(item, product);
      if (!historical) return;
      const current = rows.get(historical.productId) || {
        productId: historical.productId,
        name: historical.productName,
        category: product?.category || "Archived product",
        station: product?.station || "Unknown station",
        quantity: 0,
        orderCount: 0,
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        marginPercent: 0
      };
      if (historical.usesSnapshot) current.name = historical.productName;
      const lineRevenue = historical.lineRevenueCents / 100;
      const lineCost = product ? getProductCost(product, orderContext(order)) * historical.quantity : 0;
      current.quantity += historical.quantity;
      if (!productsCountedForOrder.has(historical.productId)) current.orderCount += 1;
      productsCountedForOrder.add(historical.productId);
      current.revenue = roundMoney(current.revenue + lineRevenue);
      current.cost = roundMoney(current.cost + lineCost);
      current.grossProfit = roundMoney(current.revenue - current.cost);
      current.marginPercent = current.revenue > 0 ? roundPercent((current.grossProfit / current.revenue) * 100) : 0;
      rows.set(historical.productId, current);
    });
  });

  return [...rows.values()].sort((first, second) => {
    return second.quantity - first.quantity || second.revenue - first.revenue || first.name.localeCompare(second.name);
  });
}

function getProductMarginRows() {
  const soldByProduct = new Map(getProductPerformanceRows(reportableOrders()).map((row) => [row.productId, row]));
  return state.products
    .filter((product) => product.active && Number(product.price) > 0)
    .map((product) => {
      const profile = getProductMarginProfile(product);
      const sold = soldByProduct.get(product.id);
      return {
        productId: product.id,
        name: product.name || "Product",
        price: Number(product.price) || 0,
        cost: roundMoney(getProductCost(product)),
        marginPercent: roundPercent(profile.margin),
        baseMarginPercent: roundPercent(profile.baseMargin),
        takeawayMarginPercent: roundPercent(profile.takeawayMargin),
        targetMargin: roundPercent(product.targetMargin),
        minMargin: roundPercent(product.minMargin),
        className: profile.className,
        label: profile.label,
        soldQuantity: sold?.quantity || 0,
        revenue: sold?.revenue || 0,
        grossProfit: sold?.grossProfit || 0
      };
    })
    .sort((first, second) => {
      const riskOrder = { danger: 0, warning: 1, ok: 2 };
      return (riskOrder[first.className] ?? 3) - (riskOrder[second.className] ?? 3)
        || first.marginPercent - second.marginPercent
        || second.revenue - first.revenue
        || first.name.localeCompare(second.name);
    });
}

function getIngredientUsageRows(orders = reportableOrders()) {
  const rows = new Map();

  orders.forEach((order) => {
    getStockRequirementsForItems(order.items || [], orderContext(order)).forEach((quantity, ingredientId) => {
      const ingredient = ingredientById(ingredientId);
      if (!ingredient) return;
      const current = rows.get(ingredientId) || {
        ingredientId,
        name: ingredient.name || "Purchased product",
        unit: ingredient.unit || "",
        quantity: 0,
        cost: 0,
        orderCount: 0
      };
      current.quantity += Number(quantity) || 0;
      current.cost = roundMoney(current.cost + (Number(quantity) || 0) * (Number(ingredient.purchasePrice) || 0));
      current.orderCount += 1;
      rows.set(ingredientId, current);
    });
  });

  return [...rows.values()]
    .map((row) => ({ ...row, quantity: Number(row.quantity.toFixed(3)) }))
    .sort((first, second) => second.cost - first.cost || second.quantity - first.quantity || first.name.localeCompare(second.name));
}

function getInventoryValueRows() {
  return state.ingredients
    .filter((ingredient) => ingredient.active !== false)
    .map((ingredient) => ({
      ingredientId: ingredient.id,
      name: ingredient.name || "Purchased product",
      stock: Number(ingredient.stock) || 0,
      unit: ingredient.unit || "",
      value: roundMoney((Number(ingredient.stock) || 0) * (Number(ingredient.purchasePrice) || 0)),
      purchasePrice: Number(ingredient.purchasePrice) || 0,
      status: getIngredientStatus(ingredient),
      supplier: ingredient.supplier || "Supplier",
      location: ingredient.location || "Storage"
    }))
    .sort((first, second) => second.value - first.value || first.name.localeCompare(second.name));
}

function getWasteRows(records = state.wasteRecords) {
  const rows = new Map();
  records.forEach((record) => {
    const key = `${record.ingredientId}|${record.reason}`;
    const current = rows.get(key) || {
      ingredientId: record.ingredientId,
      name: record.ingredientName || ingredientById(record.ingredientId)?.name || "Purchased product",
      reason: record.reason || "Other",
      unit: record.stockUnit || ingredientById(record.ingredientId)?.unit || "",
      quantity: 0,
      cost: 0,
      count: 0,
      lastAtMs: 0
    };
    current.quantity += Number(record.stockQuantity) || 0;
    current.cost = roundMoney(current.cost + (Number(record.cost) || 0));
    current.count += 1;
    current.lastAtMs = Math.max(current.lastAtMs, Number(record.occurredAtMs) || 0);
    rows.set(key, current);
  });

  return [...rows.values()]
    .map((row) => ({ ...row, quantity: Number(row.quantity.toFixed(3)) }))
    .sort((first, second) => second.cost - first.cost || second.count - first.count || first.name.localeCompare(second.name));
}

function getWasteSummary() {
  const todayRecords = state.wasteRecords.filter((record) => isTodayTimestamp(record.occurredAtMs));
  const allRows = getWasteRows();
  return {
    todayCost: roundMoney(todayRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0)),
    todayCount: todayRecords.length,
    totalCost: roundMoney(state.wasteRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0)),
    count: state.wasteRecords.length,
    topRows: allRows.slice(0, 5)
  };
}

function getStaffCurrentlyWorking() {
  const workers = new Map();
  const staffIdsRequiringReview = new Set();
  state.staffShifts
    .filter((shift) => shift.clockInAtMs && !shift.clockOutAtMs)
    .forEach((shift) => {
      const metrics = getShiftMetrics(shift);
      const staffId = shift.staffId || shift.id;
      if (metrics.requiresReview) {
        staffIdsRequiringReview.add(staffId);
        return;
      }
      workers.set(staffId, {
        id: staffId,
        name: shift.staffName || "Staff",
        role: shift.role || "Staff",
        station: shift.station || "",
        status: metrics.attendanceStatus,
        detail: `${formatShiftHours(metrics.actualMinutes)} worked`
      });
    });

  (state.staff || [])
    .filter((staff) => String(staff.status || "").toLowerCase() === "on shift")
    .forEach((staff) => {
      if (workers.has(staff.id) || staffIdsRequiringReview.has(staff.id)) return;
      workers.set(staff.id, {
        id: staff.id,
        name: staff.name || "Staff",
        role: staff.role || "Staff",
        station: staff.planned || "",
        status: staff.status,
        detail: staff.clocked && staff.clocked !== "-" ? `Clocked ${staff.clocked}` : "Team status"
      });
    });

  return [...workers.values()].sort((first, second) => first.role.localeCompare(second.role) || first.name.localeCompare(second.name));
}

function getStaffHourRows() {
  const rows = new Map();
  state.staffShifts.forEach((shift) => {
    const metrics = getShiftMetrics(shift);
    const key = shift.staffId || shift.staffName || shift.id;
    const current = rows.get(key) || {
      staffId: shift.staffId || "",
      name: shift.staffName || "Staff",
      role: shift.role || "Staff",
      shifts: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      missed: 0
    };
    current.shifts += 1;
    current.plannedMinutes += metrics.plannedMinutes;
    current.actualMinutes += metrics.actualMinutes;
    current.breakMinutes += metrics.breakMinutes;
    current.lateMinutes += metrics.lateMinutes;
    current.overtimeMinutes += metrics.overtimeMinutes;
    if (metrics.missed) current.missed += 1;
    rows.set(key, current);
  });

  return [...rows.values()].sort((first, second) => second.actualMinutes - first.actualMinutes || first.name.localeCompare(second.name));
}

function getActiveDriverRows() {
  const activeOrderCounts = new Map();
  state.orders.filter(isActiveDelivery).forEach((order) => {
    activeOrderCounts.set(order.assignedDriver, (activeOrderCounts.get(order.assignedDriver) || 0) + 1);
  });

  return state.drivers
    .filter((driver) => driver.status !== DRIVER_IDLE_STATUS || activeOrderCounts.has(driver.id))
    .map((driver) => ({
      driverId: driver.id,
      name: driver.name || "Driver",
      status: driver.status || DRIVER_IDLE_STATUS,
      eta: driver.eta || "-",
      location: driver.location || "Restaurant",
      activeOrders: activeOrderCounts.get(driver.id) || 0
    }))
    .sort((first, second) => second.activeOrders - first.activeOrders || first.name.localeCompare(second.name));
}

function getDeliveryPerformance() {
  const deliveryOrders = reportableOrders().filter(isDeliveryOrder);
  const deliveredOrders = deliveryOrders.filter((order) => getDeliveryStatus(order) === "Delivered");
  const exceptionOrders = deliveryOrders.filter((order) => ["Failed delivery", "Returned"].includes(getDeliveryStatus(order)));
  const lateOrders = deliveryOrders.filter((order) => order.deliveryWasLate || deliveryIsLate(order));
  const deliveredMinutes = deliveredOrders
    .map((order) => {
      const start = Number(order.deliveryAssignedAtMs) || Number(order.sentAtMs) || Number(order.createdAtMs) || 0;
      const end = Number(order.deliveredAtMs) || 0;
      return start && end && end > start ? Math.round((end - start) / 60000) : 0;
    })
    .filter((minutes) => minutes > 0);
  const driverRows = state.drivers.map((driver) => {
    const driverOrders = deliveryOrders.filter((order) => order.assignedDriver === driver.id);
    const delivered = driverOrders.filter((order) => getDeliveryStatus(order) === "Delivered").length;
    const exceptions = driverOrders.filter((order) => ["Failed delivery", "Returned"].includes(getDeliveryStatus(order))).length;
    return {
      driverId: driver.id,
      name: driver.name || "Driver",
      active: driverOrders.filter(isActiveDelivery).length,
      delivered,
      late: driverOrders.filter((order) => order.deliveryWasLate || deliveryIsLate(order)).length,
      exceptions,
      successRate: delivered + exceptions ? roundPercent((delivered / (delivered + exceptions)) * 100) : 100
    };
  });

  return {
    orders: deliveryOrders.length,
    active: deliveryOrders.filter(isActiveDelivery).length,
    delivered: deliveredOrders.length,
    late: lateOrders.length,
    exceptions: exceptionOrders.length,
    cashCollected: deliveryOrders.filter((order) => order.cashCollected).length,
    averageDeliveryMinutes: deliveredMinutes.length
      ? Math.round(deliveredMinutes.reduce((sum, minutes) => sum + minutes, 0) / deliveredMinutes.length)
      : 0,
    driverRows
  };
}

function getLateOrderRows() {
  const ticketReasons = new Map();
  getOpenTickets().forEach((ticket) => {
    const sla = getTicketSla(ticket);
    if (!["warning", "escalated", "delayed"].includes(sla.state)) return;
    const reasons = ticketReasons.get(ticket.orderId) || [];
    reasons.push(`${ticket.station}: ${sla.label}`);
    ticketReasons.set(ticket.orderId, reasons);
  });

  return reportableOrders()
    .filter((order) => {
      return order.status === "Delayed" || deliveryIsLate(order) || ticketReasons.has(order.id);
    })
    .map((order) => ({
      orderId: order.id,
      number: order.number,
      customer: order.customerName || order.customer || "Customer",
      type: orderTypeLabelFromBucket(orderTypeBucket(order)),
      status: order.status,
      total: getOrderTotal(order),
      reasons: [
        order.status === "Delayed" ? "Order delayed" : "",
        deliveryIsLate(order) ? "Delivery late" : "",
        ...(ticketReasons.get(order.id) || [])
      ].filter(Boolean)
    }))
    .sort((first, second) => second.reasons.length - first.reasons.length || Number(second.number) - Number(first.number));
}

function getKitchenDelayRows() {
  const severity = { delayed: 0, escalated: 1, warning: 2, aging: 3, ready: 4 };
  return getOpenTickets()
    .map((ticket) => {
      const order = state.orders.find((item) => item.id === ticket.orderId);
      const product = productById(ticket.productId);
      const sla = getTicketSla(ticket);
      return {
        ticketId: ticket.id,
        orderId: ticket.orderId,
        orderNumber: order?.number || "",
        station: ticket.station || "Kitchen",
        productName: ticket.productName || product?.name || "Product",
        status: ticket.status || "Queued",
        slaState: sla.state,
        slaLabel: sla.label,
        detail: sla.detail,
        ageMinutes: getTicketAgeMinutes(ticket),
        targetMinutes: sla.targetMinutes
      };
    })
    .filter((row) => ["warning", "escalated", "delayed"].includes(row.slaState))
    .sort((first, second) => {
      return (severity[first.slaState] ?? 9) - (severity[second.slaState] ?? 9)
        || second.ageMinutes - first.ageMinutes
        || String(first.orderNumber).localeCompare(String(second.orderNumber));
    });
}

function getSupplierOrderRows() {
  return getSupplierOrderDrafts()
    .map((order) => {
      const supplier = supplierById(order.supplierId) || state.suppliers.find((item) => item.name === order.supplier);
      return {
        orderId: order.id,
        supplierId: order.supplierId,
        supplier: order.supplier || supplier?.name || "Supplier",
        status: order.status || "Draft",
        itemCount: (order.items || []).length,
        total: getSupplierOrderTotal(order),
        integrationMethod: order.integrationMethod || supplier?.integrationMethod || "manual",
        createdAt: order.createdAt || "",
        sentAt: order.sentAt || "",
        receivedAt: order.receivedAt || ""
      };
    })
    .sort((first, second) => {
      const statusOrder = { Draft: 0, Approved: 1, Sent: 2, Ordered: 3, Received: 4 };
      return (statusOrder[first.status] ?? 9) - (statusOrder[second.status] ?? 9)
        || first.supplier.localeCompare(second.supplier);
    });
}

function getReservationRows() {
  return state.reservations
    .map((reservation) => ({
      reservationId: reservation.id,
      date: reservation.date,
      time: reservation.time,
      name: reservation.name || "Guest",
      guests: Number(reservation.guests) || 0,
      table: tableById(reservation.tableId)?.name || "Unassigned",
      source: reservation.source || "Staff entry",
      status: reservation.status || "Pending"
    }))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)) || String(first.time).localeCompare(String(second.time)));
}

function getCustomerOrderRows() {
  const rows = new Map();
  reportableOrders().forEach((order) => {
    const customer = customerById(order.customerId);
    const key = order.customerId || order.customerPhone || order.customerName || order.customer || "Walk-in";
    const current = rows.get(key) || {
      customerId: order.customerId || "",
      name: customer?.name || order.customerName || order.customer || "Walk-in",
      phone: customer?.phone || order.customerPhone || "",
      orderCount: 0,
      revenue: 0,
      deliveryOrders: 0,
      lastOrderAtMs: 0,
      favoriteProduct: "",
      productCounts: new Map()
    };
    current.orderCount += 1;
    current.revenue = roundMoney(current.revenue + getOrderTotal(order));
    if (order.fulfillment === "Delivery") current.deliveryOrders += 1;
    current.lastOrderAtMs = Math.max(current.lastOrderAtMs, Number(order.createdAtMs) || 0);
    normalizeOrderItems(order.items || []).forEach((item) => {
      current.productCounts.set(item.productId, (current.productCounts.get(item.productId) || 0) + item.quantity);
    });
    rows.set(key, current);
  });

  return [...rows.values()].map((row) => {
    const favoriteProductId = [...row.productCounts.entries()]
      .sort((first, second) => second[1] - first[1])[0]?.[0];
    return {
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      orderCount: row.orderCount,
      revenue: row.revenue,
      deliveryOrders: row.deliveryOrders,
      lastOrderAtMs: row.lastOrderAtMs,
      favoriteProduct: productById(favoriteProductId)?.name || "No favorite yet"
    };
  }).sort((first, second) => second.revenue - first.revenue || first.name.localeCompare(second.name));
}

function getReservationSummary(reservations) {
  const active = reservations.filter((reservation) => RESERVATION_ACTIVE_STATUSES.includes(reservation.status));
  return {
    count: reservations.length,
    activeCount: active.length,
    guests: active.reduce((sum, reservation) => sum + (Number(reservation.guests) || 0), 0),
    pending: reservations.filter((reservation) => reservation.status === "Pending").length,
    confirmed: reservations.filter((reservation) => reservation.status === "Confirmed").length,
    arrived: reservations.filter((reservation) => reservation.status === "Arrived").length
  };
}

export function getManagementDashboardData() {
  const todayOrders = getTodayOrders();
  const allOrders = reportableOrders();
  const closedOrders = paidOrClosedOrders(allOrders);
  const todayReservations = getReservationRows().filter((reservation) => reservation.date === todayDateKey());
  const allReservationRows = getReservationRows();
  const waste = getWasteSummary();
  const kitchenSla = getKitchenSlaSummary();
  const kitchenDelays = getKitchenDelayRows();
  const lateOrders = getLateOrderRows();
  const lowStockProducts = getLowStockIngredients();
  const supplierOrders = getSupplierOrderRows();
  const activeDrivers = getActiveDriverRows();
  const staffWorking = getStaffCurrentlyWorking();
  const deliveryPerformance = getDeliveryPerformance();
  const sales = getSalesSummary(todayOrders);
  const allSales = getSalesSummary(allOrders);

  return {
    date: todayDateKey(),
    sales,
    allSales,
    orderTypes: getOrderTypeBreakdown(todayOrders),
    allOrderTypes: getOrderTypeBreakdown(allOrders),
    bestSellingProducts: getProductPerformanceRows(todayOrders),
    productPerformance: getProductPerformanceRows(allOrders),
    productMargins: getProductMarginRows(),
    lowStockProducts,
    inventoryValue: getInventoryValueRows(),
    ingredientUsage: getIngredientUsageRows(closedOrders.length ? closedOrders : allOrders),
    waste,
    wasteRows: getWasteRows(),
    staffWorking,
    staffHours: getStaffHourRows(),
    activeDrivers,
    deliveryPerformance,
    lateOrders,
    kitchenDelays,
    kitchenSla,
    supplierOrders,
    reservationsToday: todayReservations,
    reservationSummary: getReservationSummary(allReservationRows),
    reservationTodaySummary: getReservationSummary(todayReservations),
    reservations: allReservationRows,
    customerOrders: getCustomerOrderRows(),
    totals: {
      activeDrivers: activeDrivers.length,
      staffWorking: staffWorking.length,
      supplierOrders: supplierOrders.filter((order) => order.status !== "Received").length,
      reservationsToday: todayReservations.length,
      kitchenDelays: kitchenDelays.length,
      lateOrders: lateOrders.length,
      lowStock: lowStockProducts.length,
      wasteCostToday: waste.todayCost
    }
  };
}

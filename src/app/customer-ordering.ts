import {
  CUSTOMER_QR_CHANNEL,
  CUSTOMER_QR_ORDER_CONTEXT,
  UNPAID_PAYMENT_METHOD,
  WEBSITE_ORDER_CHANNEL,
  WEBSITE_PAYMENT_PROCESSOR
} from "../shared/constants.js";
import { getPaymentStatusForMethod } from "../domain/payments.js";
import { normalizeWebsiteFulfillment, productCanBeOrderedForOrderContext } from "../domain/orders.js";
import { isReservationTime } from "../domain/reservations.js";
import { saveState, state } from "./state.js";
import { timeNow } from "../shared/dates.js";

export function createCustomerOrderingRuntime(deps) {
  const {
    getCustomerOrderingSession,
    getCustomerQrSession,
    getWebsiteOrderSession,
    getProductAvailability,
    getStockShortages,
    getItemsTotal,
    normalizeOrderItems,
    productById,
    render,
    renderCustomerQrScreen,
    renderWebsiteOrderScreen,
    sendOrderToKitchen,
    showToast,
    upsertCustomerFromOrderDetails,
    validateOrderForKitchen
  } = deps;

  function getCustomerModeFromContext(orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
    return orderContext.channel === WEBSITE_ORDER_CHANNEL ? "website" : "qr";
  }

  function getCustomerCartStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
    return mode === "website" ? "websiteCart" : "customerCart";
  }

  function getCustomerLastOrderStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
    return mode === "website" ? "websiteLastOrderId" : "customerLastOrderId";
  }

  function getCustomerOrderContext(mode = getCustomerOrderingSession()?.mode || "qr") {
    if (mode === "website") {
      return {
        channel: WEBSITE_ORDER_CHANNEL,
        fulfillment: normalizeWebsiteFulfillment(state.websiteFulfillment)
      };
    }
    return CUSTOMER_QR_ORDER_CONTEXT;
  }

  function getCustomerCartItems(orderContext = getCustomerOrderContext()) {
    const key = getCustomerCartStateKey(getCustomerModeFromContext(orderContext));
    state[key] = normalizeOrderItems(state[key] || [])
      .filter((item) => productCanBeOrderedForOrderContext(productById(item.productId), orderContext));
    return state[key];
  }

  function getCustomerCartTotal(orderContext = getCustomerOrderContext()) {
    return getItemsTotal(getCustomerCartItems(orderContext));
  }

  function addCustomerCartItem(productId) {
    const session = getCustomerOrderingSession();
    if (!session || session.error) return;
    const orderContext = getCustomerOrderContext(session.mode);
    const product = productById(productId);
    if (!product || !productCanBeOrderedForOrderContext(product, orderContext)) {
      showToast("That item is not available for this order type.");
      return;
    }

    const cartItems = getCustomerCartItems(orderContext);
    const availability = getProductAvailability(product, cartItems, orderContext);
    if (availability.maxQuantity < 1) {
      showToast(`${product.name} is not available with current stock.`);
      render();
      return;
    }

    state[getCustomerCartStateKey(session.mode)] = normalizeOrderItems([...cartItems, { productId: product.id, quantity: 1, note: "", modifiers: [] }]);
    state[getCustomerLastOrderStateKey(session.mode)] = "";
    saveState();
    render();
    showToast(`${product.name} added.`);
  }

  function adjustCustomerCartItem(index, delta) {
    const session = getCustomerOrderingSession();
    const orderContext = getCustomerOrderContext(session?.mode || "qr");
    const cartItems = getCustomerCartItems(orderContext);
    const item = cartItems[Number(index)];
    if (!item) return;
    const product = productById(item.productId);
    if (!product) return;

    if (delta > 0) {
      const otherItems = cartItems.filter((_, itemIndex) => itemIndex !== Number(index));
      const availability = getProductAvailability(product, otherItems, orderContext);
      if (item.quantity + 1 > availability.maxQuantity) {
        showToast(`Only ${availability.maxQuantity} ${product.name} can be ordered with current stock.`);
        return;
      }
    }

    item.quantity += delta;
    state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = normalizeOrderItems(cartItems.filter((line) => line.quantity > 0));
    saveState();
    render();
  }

  function removeCustomerCartItem(index) {
    const session = getCustomerOrderingSession();
    const orderContext = getCustomerOrderContext(session?.mode || "qr");
    state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = getCustomerCartItems(orderContext).filter((_, itemIndex) => itemIndex !== Number(index));
    saveState();
    render();
  }

  function startNewCustomerOrder() {
    const session = getCustomerOrderingSession();
    const mode = session?.mode || "qr";
    state[getCustomerCartStateKey(mode)] = [];
    state[getCustomerLastOrderStateKey(mode)] = "";
    saveState();
    render();
  }

  function setWebsiteFulfillment(value) {
    state.websiteFulfillment = normalizeWebsiteFulfillment(value);
    state.websiteCart = getCustomerCartItems(getCustomerOrderContext("website"));
    state.websiteLastOrderId = "";
    saveState();
    render();
  }

  function submitCustomerQrOrder(formData) {
    const session = getCustomerQrSession();
    if (!session || session.error || !session.table) {
      showToast("Ask staff for an active table QR code.");
      renderCustomerQrScreen();
      return;
    }

    const items = getCustomerCartItems(CUSTOMER_QR_ORDER_CONTEXT);
    if (!items.length) {
      showToast("Add an item before placing the order.");
      return;
    }

    const paymentOption = String(formData.get("paymentOption") || "online");
    const paymentMethod = paymentOption === "later" ? UNPAID_PAYMENT_METHOD : "Online payment";
    const paymentStatus = getPaymentStatusForMethod(paymentMethod);
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order: any = {
      id: orderId,
      number,
      channel: CUSTOMER_QR_CHANNEL,
      orderType: CUSTOMER_QR_CHANNEL,
      tableId: session.table.id,
      customer: session.table.name,
      paymentStatus,
      paymentMethod,
      fulfillment: "Kitchen",
      status: "New",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: paymentStatus === "Paid" ? createdAt : "",
      paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
      staffId: "",
      staffName: "QR guest",
      paidByUserId: "",
      paidByName: paymentStatus === "Paid" ? "QR online checkout" : "",
      inventoryDeducted: false,
      notes: String(formData.get("notes") || "").trim(),
      qrCodeId: session.code?.id || "",
      items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderCustomerQrScreen();
      return;
    }

    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.customerCart = [];
    state.customerLastOrderId = order.id;
    state.receiptOrderId = order.id;
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    showToast(`Order #${number} sent to the kitchen.`);
  }

  function normalizeCardDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function processWebsiteOnlinePayment(formData, amount) {
    const cardName = String(formData.get("cardName") || "").trim();
    const cardNumber = normalizeCardDigits(formData.get("cardNumber"));
    const expiry = String(formData.get("cardExpiry") || "").replace(/\s+/g, "").trim();
    const cvc = normalizeCardDigits(formData.get("cardCvc"));

    if (amount <= 0) return { ok: false, message: "Add a paid item before checkout." };
    if (cardName.length < 2) return { ok: false, message: "Enter the cardholder name." };
    if (cardNumber.length < 12 || cardNumber.length > 19) return { ok: false, message: "Enter a valid card number." };
    if (!/^\d{2}\/?\d{2}$/.test(expiry)) return { ok: false, message: "Enter the card expiry as MM/YY." };
    if (cvc.length < 3 || cvc.length > 4) return { ok: false, message: "Enter a valid CVC." };

    return {
      ok: true,
      reference: `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      processor: WEBSITE_PAYMENT_PROCESSOR
    };
  }

  function submitWebsiteOrder(formData) {
    if (!getWebsiteOrderSession()) return;

    const fulfillment = normalizeWebsiteFulfillment(formData.get("fulfillment") || state.websiteFulfillment);
    state.websiteFulfillment = fulfillment;
    const orderContext = getCustomerOrderContext("website");
    const items = getCustomerCartItems(orderContext);
    if (!items.length) {
      showToast("Add an item before checkout.");
      return;
    }

    const customerName = String(formData.get("customerName") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim();
    const requestedTime = String(formData.get("requestedTime") || "").trim();
    const deliveryAddress = fulfillment === "Delivery" ? String(formData.get("deliveryAddress") || "").trim() : "";

    if (!customerName || !customerPhone) {
      showToast("Enter your name and phone number.");
      return;
    }
    if (!isReservationTime(requestedTime)) {
      showToast("Choose a valid pickup or delivery time.");
      return;
    }
    if (fulfillment === "Delivery" && !deliveryAddress) {
      showToast("Enter a delivery address.");
      return;
    }

    const payment = processWebsiteOnlinePayment(formData, getItemsTotal(items));
    if (!payment.ok) {
      showToast(payment.message);
      return;
    }

    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order: any = {
      id: orderId,
      number,
      channel: WEBSITE_ORDER_CHANNEL,
      orderType: WEBSITE_ORDER_CHANNEL,
      tableId: "",
      customer: customerName,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      requestedTime,
      paymentStatus: "Paid",
      paymentMethod: "Online payment",
      paymentReference: payment.reference,
      paymentProcessor: payment.processor,
      fulfillment,
      status: "New",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: createdAt,
      paidAtMs: createdAtMs,
      staffId: "",
      staffName: "Website checkout",
      paidByUserId: "",
      paidByName: "Website checkout",
      inventoryDeducted: false,
      assignedDriver: "",
      pickupStatus: "",
      deliveryStatus: "",
      deliveryAssignedAtMs: "",
      deliveryStatusUpdatedAtMs: "",
      deliveredAt: "",
      deliveredAtMs: "",
      failedAt: "",
      failedAtMs: "",
      returnedAt: "",
      returnedAtMs: "",
      deliveryWasLate: false,
      deliveryNotes: [],
      deliveryProofPhotoName: "",
      deliveryProofAtMs: "",
      deliveryProofByName: "",
      cashCollected: false,
      cashCollectedAt: "",
      cashCollectedAtMs: "",
      cashCollectedByName: "",
      notes: String(formData.get("notes") || "").trim(),
      items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderWebsiteOrderScreen();
      return;
    }

    const customerRecord = upsertCustomerFromOrderDetails({
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      deliveryAddress
    });
    if (customerRecord) order.customerId = customerRecord.id;
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.websiteCart = [];
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    showToast(`Order #${number} confirmed.`);
  }

  return {
    addCustomerCartItem,
    adjustCustomerCartItem,
    getCustomerCartItems,
    getCustomerCartTotal,
    getCustomerOrderContext,
    removeCustomerCartItem,
    setWebsiteFulfillment,
    startNewCustomerOrder,
    submitCustomerQrOrder,
    submitWebsiteOrder
  };
}

import { customerPhoneKey, normalizeAddressHistory, normalizeCustomerPhone } from "../data/normalize.js";
import { timeNow } from "../shared/dates.js";
import { uniqueRecordId } from "../shared/ids.js";
import { isPhoneMessageOrder } from "./orders.js";

export function getCustomerPrimaryAddress(customer) {
  return customer?.addresses?.[0] || "";
}

export function getCustomerOptionLabel(customer) {
  const address = getCustomerPrimaryAddress(customer);
  return [customer.name, customer.phone, address].filter(Boolean).join(" - ");
}

export function findCustomerByPhone(customers, phone) {
  const key = customerPhoneKey(phone);
  return key ? customers.find((customer) => customerPhoneKey(customer.phone) === key) : null;
}

export function findCustomerBySearchValue(customers, value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return null;
  return customers.find((customer) => getCustomerOptionLabel(customer).toLowerCase() === query)
    || customers.find((customer) => customerPhoneKey(customer.phone) && customerPhoneKey(customer.phone) === customerPhoneKey(value))
    || null;
}

export function getOrdersForCustomer(customer, orders) {
  if (!customer) return [];
  const phoneKey = customerPhoneKey(customer.phone);
  return orders
    .filter((order) => {
      if (order.customerId && order.customerId === customer.id) return true;
      if (phoneKey && customerPhoneKey(order.customerPhone) === phoneKey) return true;
      return !phoneKey && customer.name && String(order.customerName || order.customer || "").toLowerCase() === customer.name.toLowerCase();
    })
    .slice()
    .sort((first, second) => (second.createdAtMs || 0) - (first.createdAtMs || 0));
}

export function getFavoriteItemsForCustomer(customer, orders, productById, normalizeOrderItems) {
  const counts = new Map();
  getOrdersForCustomer(customer, orders).forEach((order) => {
    normalizeOrderItems(order.items || []).forEach((item) => {
      counts.set(item.productId, (counts.get(item.productId) || 0) + item.quantity);
    });
  });
  return [...counts.entries()]
    .map(([productId, quantity]) => ({ product: productById(productId), quantity }))
    .filter((item) => item.product)
    .sort((first, second) => second.quantity - first.quantity || first.product.name.localeCompare(second.product.name))
    .slice(0, 3);
}

export function getAddressHistoryForCustomer(customer, orders) {
  const addresses = [
    ...(customer?.addresses || []),
    ...getOrdersForCustomer(customer, orders).map((order) => order.deliveryAddress).filter(Boolean)
  ];
  return normalizeAddressHistory(addresses);
}

export function getManualOrderCustomerDetails(formData, channel, customerById) {
  if (!isPhoneMessageOrder(channel)) return null;
  const selectedCustomer = customerById(String(formData.get("customerId") || "").trim());
  const name = String(formData.get("customerName") || formData.get("customer") || selectedCustomer?.name || "").replace(/\s+/g, " ").trim();
  const phone = normalizeCustomerPhone(formData.get("customerPhone") || selectedCustomer?.phone || "");
  const deliveryAddress = String(formData.get("deliveryAddress") || getCustomerPrimaryAddress(selectedCustomer) || "").replace(/\s+/g, " ").trim();
  const notes = String(formData.get("customerNotes") || selectedCustomer?.notes || "").trim();
  return {
    customerId: selectedCustomer?.id || "",
    name,
    phone,
    email: String(formData.get("customerEmail") || selectedCustomer?.email || "").trim(),
    deliveryAddress,
    notes
  };
}

export function upsertCustomerFromOrderDetails(customers, details) {
  const name = String(details?.name || "").replace(/\s+/g, " ").trim();
  const phone = normalizeCustomerPhone(details?.phone);
  const email = String(details?.email || "").trim();
  const deliveryAddress = String(details?.deliveryAddress || "").replace(/\s+/g, " ").trim();
  const notes = String(details?.notes || "").trim();
  if (!name && !phone && !email && !deliveryAddress && !notes) return null;

  let customer = customers.find((item) => item.id === details?.customerId) || findCustomerByPhone(customers, phone);
  if (!customer) {
    customer = {
      id: uniqueRecordId(name || phone || "customer", [customers]),
      name: name || phone || "Customer",
      phone,
      email,
      addresses: [],
      notes: "",
      createdAt: timeNow(),
      updatedAt: timeNow()
    };
    customers.push(customer);
  }

  if (name) customer.name = name;
  if (phone) customer.phone = phone;
  if (email) customer.email = email;
  if (deliveryAddress) customer.addresses = normalizeAddressHistory([deliveryAddress, ...(customer.addresses || [])]);
  if (notes) customer.notes = notes;
  customer.updatedAt = timeNow();
  return customer;
}

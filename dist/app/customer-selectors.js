import { state } from "./state.js";
import { customerById, productById } from "./entities.js";
import { normalizeOrderItems } from "./order-selectors.js";
import { findCustomerByPhone as findCustomerByPhoneInList, findCustomerBySearchValue as findCustomerBySearchValueInList, getAddressHistoryForCustomer as getAddressHistoryForCustomerFromOrders, getCustomerOptionLabel as getCustomerOptionLabelFromRecord, getCustomerPrimaryAddress as getCustomerPrimaryAddressFromRecord, getFavoriteItemsForCustomer as getFavoriteItemsForCustomerFromOrders, getManualOrderCustomerDetails as getManualOrderCustomerDetailsFromForm, getOrdersForCustomer as getOrdersForCustomerFromList, upsertCustomerFromOrderDetails as upsertCustomerRecordFromOrderDetails } from "../domain/customers.js";
export function findCustomerByPhone(phone) {
    return findCustomerByPhoneInList(state.customers, phone);
}
export function getCustomerPrimaryAddress(customer) {
    return getCustomerPrimaryAddressFromRecord(customer);
}
export function getCustomerOptionLabel(customer) {
    return getCustomerOptionLabelFromRecord(customer);
}
export function findCustomerBySearchValue(value) {
    return findCustomerBySearchValueInList(state.customers, value);
}
export function getOrdersForCustomer(customer) {
    return getOrdersForCustomerFromList(customer, state.orders);
}
export function getFavoriteItemsForCustomer(customer) {
    return getFavoriteItemsForCustomerFromOrders(customer, state.orders, productById, normalizeOrderItems);
}
export function getAddressHistoryForCustomer(customer) {
    return getAddressHistoryForCustomerFromOrders(customer, state.orders);
}
export function getManualOrderCustomerDetails(formData, channel) {
    return getManualOrderCustomerDetailsFromForm(formData, channel, customerById);
}
export function upsertCustomerFromOrderDetails(details) {
    return upsertCustomerRecordFromOrderDetails(state.customers, details);
}
//# sourceMappingURL=customer-selectors.js.map
import { state } from "./state.js";
import { formatMoney } from "../shared/money.js";
export function money(value) {
    return formatMoney(value, state?.restaurantSettings?.currency || "EUR");
}
export function productById(id) {
    return state.products.find((product) => product.id === id);
}
export function ingredientById(id) {
    return state.ingredients.find((ingredient) => ingredient.id === id);
}
export function orderById(id) {
    return state.orders.find((order) => order.id === id);
}
export function customerById(id) {
    return state.customers.find((customer) => customer.id === id);
}
export function tableById(id) {
    return state.tables.find((table) => table.id === id);
}
export function supplierById(id) {
    return state.suppliers.find((supplier) => supplier.id === id);
}
export function driverById(id) {
    return state.drivers.find((driver) => driver.id === id);
}
export function userNameById(userId) {
    return state.users.find((user) => user.id === userId)?.name || "";
}
//# sourceMappingURL=entities.js.map
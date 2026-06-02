import { formatStockAmount } from "../shared/formatters.js";
import { productById } from "./entities.js";
import { getIngredientStatus } from "./inventory-selectors.js";
import { getProductMargin } from "./recipe-selectors.js";

export function getOrderCompletionToast(number, stations, stockChanges, items, orderContext) {
  const stationText = stations.length === 1 ? stations[0] : `${stations.length} stations`;
  const product = items.length === 1 ? productById(items[0].productId) : null;
  const primaryChange = stockChanges.length === 1 ? stockChanges[0] : null;
  let message = `Order #${number} sent to ${stationText}; inventory updated automatically.`;

  if (product && primaryChange) {
    message = `Order #${number} sent to ${stationText}; ${primaryChange.ingredient.name} stock is now ${formatStockAmount(primaryChange.resultingStock, primaryChange.ingredient.unit)}. ${product.name} margin ${getProductMargin(product, orderContext).toFixed(1)}%.`;
  }

  const lowStockChanges = stockChanges.filter((change) => getIngredientStatus(change.ingredient) === "danger");
  if (lowStockChanges.length) {
    const lowStockText = lowStockChanges
      .map((change) => `${change.ingredient.name} ${formatStockAmount(change.resultingStock, change.ingredient.unit)}`)
      .join(", ");
    message += ` Low-stock alert: ${lowStockText}.`;
  }

  return message;
}

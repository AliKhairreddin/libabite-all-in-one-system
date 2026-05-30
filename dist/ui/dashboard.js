import { state } from "../app/state.js";
import { DEFAULT_RECIPE_ORDER_CONTEXT } from "../shared/constants.js";
import { escapeHtml } from "../shared/html.js";
export function createDashboardUi(deps) {
    const { alertCard, emptyState, formatStockAmount, getIngredientStatus, getKitchenSlaSummary, getLowStockIngredients, getOpenTickets, getOrderTotal, getProductCost, getProductMarginProfile, getRecipeUsageLabel, getSlaSummaryLabel, getStationNames, getStockRequirementsForItems, ingredientById, isActiveDelivery, money, normalizeOrderItems, normalizeStockQuantity, orderCard, productById } = deps;
    function renderMetrics() {
        const revenue = state.orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
        const activeDrivers = state.orders.filter(isActiveDelivery).length;
        const kitchenSla = getKitchenSlaSummary();
        const metrics = [
            { label: "Today orders", value: state.orders.length, note: "Across POS, QR, web, phone" },
            { label: "Kitchen tickets", value: getOpenTickets().length, note: getSlaSummaryLabel(kitchenSla) },
            { label: "Revenue", value: money(revenue), note: "Demo day total" },
            { label: "Low stock", value: getLowStockIngredients().length, note: `${activeDrivers} driver on route` }
        ];
        document.querySelector("#metricGrid").innerHTML = metrics
            .map((metric) => `
        <article class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.note)}</small>
        </article>
      `)
            .join("");
    }
    function renderDashboard() {
        renderKeftaLoopProof();
        const recentOrders = state.orders.slice(-4).reverse();
        document.querySelector("#dashboardOrderStream").innerHTML = recentOrders.length
            ? recentOrders.map(orderCard).join("")
            : emptyState("No orders yet.");
        const stationStats = getStationNames().filter((station) => station !== "All").map((station) => {
            const stationTickets = state.tickets.filter((ticket) => ticket.station === station);
            const openTickets = stationTickets.filter((ticket) => ticket.status !== "Done");
            const open = openTickets.length;
            const slaSummary = getKitchenSlaSummary(openTickets);
            const load = Math.min(100, open * 34);
            const stationState = slaSummary.delayed || slaSummary.escalated ? "sla-escalated" : slaSummary.warning ? "sla-warning" : "";
            const pillClass = slaSummary.delayed || slaSummary.escalated ? "danger" : slaSummary.warning ? "warning" : open ? "info" : "ok";
            const pillText = slaSummary.delayed
                ? `${slaSummary.delayed} delayed`
                : slaSummary.escalated
                    ? `${slaSummary.escalated} late`
                    : slaSummary.warning
                        ? `${slaSummary.warning} warn`
                        : `${open} open`;
            return `
        <article class="station-card ${stationState}">
          <div class="card-title">
            <strong>${escapeHtml(station)}</strong>
            <span class="pill ${pillClass}">${escapeHtml(pillText)}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="--value: ${load}%"></div></div>
        </article>
      `;
        });
        document.querySelector("#dashboardStations").innerHTML = stationStats.join("");
        const alerts = getLowStockIngredients();
        document.querySelector("#dashboardAlerts").innerHTML = alerts.length
            ? alerts.map(alertCard).join("")
            : emptyState("No reorder alerts.");
    }
    function getOrderQuantityForProduct(order, productId) {
        return normalizeOrderItems(order.items || [])
            .filter((item) => item.productId === productId)
            .reduce((sum, item) => sum + item.quantity, 0);
    }
    function getLatestOrderForProduct(productId) {
        return state.orders
            .slice()
            .reverse()
            .find((order) => getOrderQuantityForProduct(order, productId) > 0);
    }
    function renderKeftaLoopProof() {
        const container = document.querySelector("#keftaLoopProof");
        if (!container)
            return;
        const ingredient = ingredientById("kefta");
        const product = productById("kefta-plate");
        if (!ingredient || !product) {
            container.innerHTML = emptyState("Kefta loop is waiting for setup.");
            return;
        }
        const demoQuantity = 10;
        const orderContext = DEFAULT_RECIPE_ORDER_CONTEXT;
        const demoUsage = normalizeStockQuantity(getStockRequirementsForItems([{ productId: product.id, quantity: demoQuantity }], orderContext).get(ingredient.id) || 0);
        const latestOrder = getLatestOrderForProduct(product.id);
        const latestQuantity = latestOrder ? getOrderQuantityForProduct(latestOrder, product.id) : 0;
        const latestUsage = latestOrder
            ? normalizeStockQuantity(getStockRequirementsForItems(latestOrder.items, {
                channel: latestOrder.channel,
                fulfillment: latestOrder.fulfillment
            }).get(ingredient.id) || 0)
            : 0;
        const previousStock = latestOrder ? normalizeStockQuantity(ingredient.stock + latestUsage) : ingredient.stock;
        const projectedStock = normalizeStockQuantity(ingredient.stock - demoUsage);
        const recipeLine = product.recipe.find((line) => line.ingredientId === ingredient.id);
        const marginProfile = getProductMarginProfile(product);
        const stockStatus = getIngredientStatus(ingredient);
        const stockClass = stockStatus === "danger" ? "danger" : stockStatus === "warning" ? "warning" : "ok";
        const stockLabel = stockStatus === "danger" ? "Low stock" : stockStatus === "warning" ? "Watch" : "Healthy";
        const proofText = latestOrder
            ? `Order #${latestOrder.number}: ${latestQuantity} Kefta Plates used ${formatStockAmount(latestUsage, ingredient.unit)}.`
            : `${demoQuantity} Kefta Plates use ${formatStockAmount(demoUsage, ingredient.unit)}.`;
        const stockTrail = latestOrder
            ? `${formatStockAmount(previousStock, ingredient.unit)} -> ${formatStockAmount(ingredient.stock, ingredient.unit)}`
            : `${formatStockAmount(ingredient.stock, ingredient.unit)} -> ${formatStockAmount(projectedStock, ingredient.unit)}`;
        container.className = `phase-loop-card ${stockClass === "danger" ? "danger" : ""}`;
        container.innerHTML = `
      <header>
        <div>
          <p class="eyebrow">Phase 5 test product</p>
          <h3>Kefta Plate loop</h3>
        </div>
        <div class="ticket-pills">
          <span class="pill ${stockClass}">${escapeHtml(stockLabel)}</span>
          <span class="pill ${marginProfile.className}">${marginProfile.margin.toFixed(1)}% margin</span>
        </div>
      </header>
      <p>${escapeHtml(proofText)}</p>
      <div class="phase-loop-grid">
        <div class="phase-loop-metric">
          <span>Purchased product</span>
          <strong>${escapeHtml(ingredient.name)}</strong>
          <small>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} in ${escapeHtml(ingredient.location)}</small>
        </div>
        <div class="phase-loop-metric">
          <span>Recipe</span>
          <strong>${escapeHtml(recipeLine ? getRecipeUsageLabel(recipeLine) : "No recipe")}</strong>
          <small>per Kefta Plate</small>
        </div>
        <div class="phase-loop-metric">
          <span>10-plate stock move</span>
          <strong>${escapeHtml(formatStockAmount(demoUsage, ingredient.unit))}</strong>
          <small>${escapeHtml(stockTrail)}</small>
        </div>
        <div class="phase-loop-metric">
          <span>Cost and margin</span>
          <strong>${escapeHtml(money(getProductCost(product, orderContext)))}</strong>
          <small>${marginProfile.baseMargin.toFixed(1)}% at ${escapeHtml(money(product.price))}</small>
        </div>
      </div>
    `;
    }
    return {
        renderDashboard,
        renderMetrics
    };
}
//# sourceMappingURL=dashboard.js.map
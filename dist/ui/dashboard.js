import { state } from "../app/state.js";
import { DEFAULT_RECIPE_ORDER_CONTEXT } from "../shared/constants.js";
import { escapeHtml } from "../shared/html.js";
export function createDashboardUi(deps) {
    const { alertCard, emptyState, formatStockAmount, formatDateTime, getIngredientStatus, getKitchenSlaSummary, getLowStockIngredients, getManagementDashboardData, getOpenTickets, getOrderTotal, getProductCost, getProductMarginProfile, getRecipeUsageLabel, getSlaSummaryLabel, getStationNames, getStockRequirementsForItems, ingredientById, isActiveDelivery, money, normalizeOrderItems, normalizeStockQuantity, orderCard, productById } = deps;
    function percentLabel(value) {
        return `${Number(value || 0).toFixed(1)}%`;
    }
    function hoursLabel(minutes) {
        const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
        const hours = safeMinutes / 60;
        return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`;
    }
    function compactMoney(value) {
        return money(Number(value) || 0);
    }
    function safePillClass(className) {
        return ["ok", "info", "warning", "danger"].includes(className) ? className : "info";
    }
    function renderRows(rows, renderer, emptyMessage) {
        return rows.length ? rows.map(renderer).join("") : emptyState(emptyMessage);
    }
    function renderDashboardRow({ title, detail = "", value = "", className = "info", progress = null }) {
        const progressHtml = progress === null || progress === undefined
            ? ""
            : `<div class="progress-track compact"><div class="progress-bar" style="--value: ${Math.max(0, Math.min(100, Number(progress) || 0))}%"></div></div>`;
        return `
      <div class="dashboard-data-row">
        <span>
          <strong>${escapeHtml(title)}</strong>
          ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
          ${progressHtml}
        </span>
        ${value ? `<span class="pill ${safePillClass(className)}">${escapeHtml(value)}</span>` : ""}
      </div>
    `;
    }
    function renderSignalGrid(data) {
        const container = document.querySelector("#dashboardSituationGrid");
        if (!container)
            return;
        const topType = data.orderTypes
            .slice()
            .sort((first, second) => second.orders - first.orders || second.revenue - first.revenue)[0];
        const nextReservation = data.reservationsToday.find((reservation) => ["Pending", "Confirmed", "Arrived"].includes(reservation.status));
        const cards = [
            {
                label: "Today's sales",
                value: compactMoney(data.sales.revenue),
                note: `${data.sales.orderCount} orders, ${compactMoney(data.sales.openRevenue)} open`
            },
            {
                label: "Orders by type",
                value: data.sales.orderCount,
                note: topType?.orders ? `${topType.label} leads with ${topType.orders}` : "No orders today"
            },
            {
                label: "Best sellers",
                value: data.bestSellingProducts[0]?.name || "-",
                note: data.bestSellingProducts[0] ? `${data.bestSellingProducts[0].quantity} sold today` : "Waiting for sales"
            },
            {
                label: "Product margins",
                value: data.productMargins.filter((row) => row.className !== "ok").length,
                note: "products below target"
            },
            {
                label: "Low stock",
                value: data.lowStockProducts.length,
                note: data.lowStockProducts[0]?.name || "No reorder risk"
            },
            {
                label: "Waste cost",
                value: compactMoney(data.waste.todayCost),
                note: `${data.waste.todayCount} records today`
            },
            {
                label: "Staff working",
                value: data.staffWorking.length,
                note: data.staffWorking.map((staff) => staff.name).slice(0, 2).join(", ") || "No live punches"
            },
            {
                label: "Active drivers",
                value: data.activeDrivers.length,
                note: data.activeDrivers[0]?.name || "No driver on route"
            },
            {
                label: "Late orders",
                value: data.lateOrders.length,
                note: data.lateOrders[0] ? `#${data.lateOrders[0].number} needs attention` : "No late orders"
            },
            {
                label: "Kitchen delays",
                value: data.kitchenDelays.length,
                note: getSlaSummaryLabel(data.kitchenSla)
            },
            {
                label: "Supplier orders",
                value: data.totals.supplierOrders,
                note: data.supplierOrders[0]?.supplier || "No active purchase orders"
            },
            {
                label: "Reservations today",
                value: data.reservationTodaySummary.activeCount,
                note: nextReservation ? `${nextReservation.time} ${nextReservation.name}` : "No active bookings"
            }
        ];
        container.innerHTML = cards.map((card) => `
      <article class="management-signal-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small>${escapeHtml(card.note)}</small>
      </article>
    `).join("");
    }
    function renderOrderTypeMix(data) {
        const container = document.querySelector("#dashboardOrderTypeMix");
        if (!container)
            return;
        const maxOrders = Math.max(1, ...data.orderTypes.map((row) => row.orders));
        container.innerHTML = data.orderTypes.map((row) => renderDashboardRow({
            title: row.label,
            detail: `${compactMoney(row.revenue)} revenue | ${row.items} items`,
            value: `${row.orders}`,
            className: row.orders ? "info" : "ok",
            progress: (row.orders / maxOrders) * 100
        })).join("");
    }
    function renderBestSellers(data) {
        const container = document.querySelector("#dashboardBestSellers");
        if (!container)
            return;
        const rows = data.bestSellingProducts.length ? data.bestSellingProducts : data.productPerformance.slice(0, 5);
        container.innerHTML = renderRows(rows.slice(0, 5), (row) => renderDashboardRow({
            title: row.name,
            detail: `${row.quantity} sold | ${compactMoney(row.revenue)} revenue`,
            value: percentLabel(row.marginPercent),
            className: row.marginPercent < 55 ? "danger" : row.marginPercent < 65 ? "warning" : "ok"
        }), "No product sales yet.");
    }
    function renderProductMargins(data) {
        const container = document.querySelector("#dashboardProductMargins");
        if (!container)
            return;
        container.innerHTML = renderRows(data.productMargins.slice(0, 5), (row) => renderDashboardRow({
            title: row.name,
            detail: `${compactMoney(row.cost)} cost on ${compactMoney(row.price)} price | target ${percentLabel(row.targetMargin)}`,
            value: `${percentLabel(row.marginPercent)} ${row.label}`,
            className: row.className
        }), "No sellable products with margin settings.");
    }
    function renderInventoryRisk(data) {
        const container = document.querySelector("#dashboardInventoryRisk");
        if (!container)
            return;
        const lowStockHtml = renderRows(data.lowStockProducts.slice(0, 5), (ingredient) => renderDashboardRow({
            title: ingredient.name,
            detail: `${formatStockAmount(ingredient.stock, ingredient.unit)} on hand | min ${formatStockAmount(ingredient.min, ingredient.unit)}`,
            value: "Low",
            className: "danger"
        }), "No low-stock products.");
        const wasteHtml = renderRows(data.waste.topRows.slice(0, 3), (row) => renderDashboardRow({
            title: `${row.name} waste`,
            detail: `${formatStockAmount(row.quantity, row.unit)} | ${row.reason}`,
            value: compactMoney(row.cost),
            className: "warning"
        }), "No waste recorded.");
        container.innerHTML = `
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Low-stock products</span>
        ${lowStockHtml}
      </div>
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Waste cost</span>
        ${wasteHtml}
      </div>
    `;
    }
    function renderTeamOps(data) {
        const container = document.querySelector("#dashboardTeamOps");
        if (!container)
            return;
        const staffHtml = renderRows(data.staffWorking.slice(0, 5), (staff) => renderDashboardRow({
            title: staff.name,
            detail: `${staff.role}${staff.station ? ` | ${staff.station}` : ""}`,
            value: staff.status,
            className: staff.status === "On shift" ? "ok" : "info"
        }), "No staff currently working.");
        const driverHtml = renderRows(data.activeDrivers.slice(0, 5), (driver) => renderDashboardRow({
            title: driver.name,
            detail: `${driver.location} | ${driver.eta}`,
            value: `${driver.activeOrders} active`,
            className: driver.activeOrders ? "info" : "ok"
        }), "No active drivers.");
        container.innerHTML = `
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Staff currently working</span>
        ${staffHtml}
      </div>
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Active drivers</span>
        ${driverHtml}
      </div>
    `;
    }
    function renderKitchenRisk(data) {
        const container = document.querySelector("#dashboardKitchenRisk");
        if (!container)
            return;
        const lateHtml = renderRows(data.lateOrders.slice(0, 5), (order) => renderDashboardRow({
            title: `Order #${order.number}`,
            detail: `${order.customer} | ${order.reasons.join(", ")}`,
            value: compactMoney(order.total),
            className: "danger"
        }), "No late orders.");
        const delayHtml = renderRows(data.kitchenDelays.slice(0, 5), (ticket) => renderDashboardRow({
            title: `${ticket.station} | #${ticket.orderNumber || "-"}`,
            detail: `${ticket.productName} | ${ticket.detail}`,
            value: ticket.slaLabel,
            className: ticket.slaState === "warning" ? "warning" : "danger"
        }), "No kitchen delays.");
        container.innerHTML = `
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Late orders</span>
        ${lateHtml}
      </div>
      <div class="dashboard-subsection">
        <span class="dashboard-subtitle">Kitchen delays</span>
        ${delayHtml}
      </div>
    `;
    }
    function renderSupplierOrders(data) {
        const container = document.querySelector("#dashboardSupplierOrders");
        if (!container)
            return;
        container.innerHTML = renderRows(data.supplierOrders.slice(0, 6), (order) => renderDashboardRow({
            title: order.supplier,
            detail: `${order.itemCount} products | ${order.integrationMethod}`,
            value: `${order.status} ${compactMoney(order.total)}`,
            className: order.status === "Received" ? "ok" : order.status === "Draft" ? "warning" : "info"
        }), "No supplier orders.");
    }
    function renderReservationsToday(data) {
        const container = document.querySelector("#dashboardReservationsToday");
        if (!container)
            return;
        container.innerHTML = renderRows(data.reservationsToday, (reservation) => renderDashboardRow({
            title: `${reservation.time} ${reservation.name}`,
            detail: `${reservation.guests} guests | ${reservation.table} | ${reservation.source}`,
            value: reservation.status,
            className: reservation.status === "Pending" ? "warning" : reservation.status === "Confirmed" || reservation.status === "Arrived" ? "ok" : "info"
        }), "No reservations today.");
    }
    function reportCardHtml(report) {
        const rowsHtml = report.rows.length
            ? report.rows.map((row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>
      `).join("")
            : `<tr><td colspan="${report.columns.length}">${escapeHtml(report.emptyMessage)}</td></tr>`;
        return `
      <article class="report-card">
        <header>
          <div>
            <span>${escapeHtml(report.kicker)}</span>
            <strong>${escapeHtml(report.title)}</strong>
          </div>
          <small>${escapeHtml(report.summary)}</small>
        </header>
        <div class="mini-report-table-wrap">
          <table class="mini-report-table">
            <thead>
              <tr>${report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </article>
    `;
    }
    function renderManagementReports(data) {
        const container = document.querySelector("#managementReports");
        if (!container)
            return;
        const inventoryTotal = data.inventoryValue.reduce((sum, row) => sum + row.value, 0);
        const staffActualMinutes = data.staffHours.reduce((sum, row) => sum + row.actualMinutes, 0);
        const supplierTotal = data.supplierOrders.reduce((sum, row) => sum + row.total, 0);
        const reports = [
            {
                kicker: "Orders",
                title: "Sales",
                summary: `${compactMoney(data.allSales.revenue)} total | ${compactMoney(data.sales.revenue)} today`,
                columns: ["Type", "Orders", "Revenue"],
                rows: data.allOrderTypes.map((row) => [row.label, String(row.orders), compactMoney(row.revenue)]),
                emptyMessage: "No sales yet."
            },
            {
                kicker: "Menu",
                title: "Product performance",
                summary: `${data.productPerformance.length} products sold`,
                columns: ["Product", "Sold", "Revenue"],
                rows: data.productPerformance.slice(0, 5).map((row) => [row.name, String(row.quantity), compactMoney(row.revenue)]),
                emptyMessage: "No product sales yet."
            },
            {
                kicker: "Recipes",
                title: "Ingredient usage",
                summary: `${data.ingredientUsage.length} ingredients used`,
                columns: ["Ingredient", "Used", "Cost"],
                rows: data.ingredientUsage.slice(0, 5).map((row) => [row.name, formatStockAmount(row.quantity, row.unit), compactMoney(row.cost)]),
                emptyMessage: "No ingredient usage yet."
            },
            {
                kicker: "Stock",
                title: "Inventory value",
                summary: `${compactMoney(inventoryTotal)} on hand`,
                columns: ["Product", "Stock", "Value"],
                rows: data.inventoryValue.slice(0, 5).map((row) => [row.name, formatStockAmount(row.stock, row.unit), compactMoney(row.value)]),
                emptyMessage: "No inventory products."
            },
            {
                kicker: "Loss",
                title: "Waste",
                summary: `${compactMoney(data.waste.totalCost)} total waste`,
                columns: ["Product", "Reason", "Cost"],
                rows: data.wasteRows.slice(0, 5).map((row) => [row.name, row.reason, compactMoney(row.cost)]),
                emptyMessage: "No waste recorded."
            },
            {
                kicker: "Profit",
                title: "Margins",
                summary: `${data.productMargins.filter((row) => row.className !== "ok").length} below target`,
                columns: ["Product", "Margin", "Target"],
                rows: data.productMargins.slice(0, 5).map((row) => [row.name, percentLabel(row.marginPercent), percentLabel(row.targetMargin)]),
                emptyMessage: "No margin data."
            },
            {
                kicker: "Labor",
                title: "Staff hours",
                summary: `${hoursLabel(staffActualMinutes)} actual`,
                columns: ["Staff", "Actual", "Late"],
                rows: data.staffHours.slice(0, 5).map((row) => [row.name, hoursLabel(row.actualMinutes), `${row.lateMinutes}m`]),
                emptyMessage: "No shifts scheduled."
            },
            {
                kicker: "Drivers",
                title: "Delivery performance",
                summary: `${data.deliveryPerformance.active} active | ${data.deliveryPerformance.late} late`,
                columns: ["Driver", "Delivered", "Success"],
                rows: data.deliveryPerformance.driverRows.slice(0, 5).map((row) => [row.name, String(row.delivered), percentLabel(row.successRate)]),
                emptyMessage: "No delivery orders."
            },
            {
                kicker: "Purchasing",
                title: "Supplier purchase history",
                summary: `${compactMoney(supplierTotal)} active value`,
                columns: ["Supplier", "Status", "Total"],
                rows: data.supplierOrders.slice(0, 5).map((row) => [row.supplier, row.status, compactMoney(row.total)]),
                emptyMessage: "No supplier orders."
            },
            {
                kicker: "Bookings",
                title: "Reservations",
                summary: `${data.reservationSummary.activeCount} active | ${data.reservationSummary.guests} guests`,
                columns: ["Guest", "Date", "Status"],
                rows: data.reservations.slice(0, 5).map((row) => [row.name, `${row.date} ${row.time}`, row.status]),
                emptyMessage: "No reservations."
            },
            {
                kicker: "Guests",
                title: "Customer orders",
                summary: `${data.customerOrders.length} customer records`,
                columns: ["Customer", "Orders", "Revenue"],
                rows: data.customerOrders.slice(0, 5).map((row) => [row.name, String(row.orderCount), compactMoney(row.revenue)]),
                emptyMessage: "No customer orders."
            }
        ];
        container.innerHTML = reports.map(reportCardHtml).join("");
    }
    function renderMetrics() {
        const data = getManagementDashboardData();
        const issueCount = data.totals.lateOrders + data.totals.kitchenDelays + data.totals.lowStock;
        const metrics = [
            { label: "Today's sales", value: compactMoney(data.sales.revenue), note: `${data.sales.orderCount} orders | ${compactMoney(data.sales.paidRevenue)} paid` },
            { label: "Orders by type", value: data.sales.orderCount, note: data.orderTypes.map((row) => `${row.label}: ${row.orders}`).join(" | ") },
            { label: "Gross margin", value: percentLabel(data.sales.marginPercent), note: `${compactMoney(data.sales.grossProfit)} after product cost` },
            { label: "Open issues", value: issueCount, note: `${data.totals.lateOrders} late, ${data.totals.kitchenDelays} kitchen, ${data.totals.lowStock} stock` }
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
        const data = getManagementDashboardData();
        renderSignalGrid(data);
        renderOrderTypeMix(data);
        renderBestSellers(data);
        renderProductMargins(data);
        renderInventoryRisk(data);
        renderTeamOps(data);
        renderKitchenRisk(data);
        renderSupplierOrders(data);
        renderReservationsToday(data);
        renderManagementReports(data);
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
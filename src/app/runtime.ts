import { createAppRenderer } from "./render.js";
import { createQrRuntime } from "./qr.js";
import { createCustomerOrderingRuntime } from "./customer-ordering.js";
import { createWebsiteCheckoutSession, handleWebsitePaymentReturn } from "./payment-actions.js";
import { createStaffOrderRuntime } from "./staff-orders.js";
import { createDeliveryRuntime } from "./delivery-actions.js";
import { createExternalDeliveryRuntime } from "./external-delivery-actions.js";
import { createProductActionsRuntime } from "./product-actions.js";
import { createProcedureActionsRuntime } from "./procedure-actions.js";
import { createReservationActionsRuntime } from "./reservation-actions.js";
import { createInventoryActionsRuntime } from "./inventory-actions.js";
import { createScanningRuntime } from "./scanning-actions.js";
import { createAdminActionsRuntime } from "./admin-actions.js";
import { createSessionActionsRuntime } from "./session-actions.js";
import { createSchedulingRuntime } from "./scheduling-actions.js";
import { createPublicOrderingUi } from "../ui/public-ordering.js";
import { createProceduresUi } from "../ui/procedures.js";
import { createTeamUi } from "../ui/team.js";
import { createSettingsUi } from "../ui/settings.js";
import { createOrdersUi } from "../ui/orders.js";
import { createKitchenUi } from "../ui/kitchen.js";
import { createInventoryUi } from "../ui/inventory.js";
import { createDashboardUi } from "../ui/dashboard.js";
import { createOrderBuilderUi } from "../ui/order-builder.js";
import { createOrderCardsUi } from "../ui/order-cards.js";
import { createExternalDeliveryUi } from "../ui/external-delivery.js";
import { isActiveDelivery } from "../domain/delivery.js";
import { orderTypeDefinition } from "../domain/orders.js";
import {
  getProductionFieldName,
  getProductionOutputDefault,
  roundMoneyValue
} from "../domain/production.js";
import { getReservationWindowLabel } from "../domain/reservations.js";
import {
  convertWasteQuantityToStockUnits,
  getIngredientPrimaryLocation,
  getWasteCost,
  getWasteUnitOptionsForIngredient,
  normalizeInventoryLocationName,
  normalizeKitchenStation,
  normalizeMarginPercent,
  normalizeRecipeAppliesTo,
  normalizeStockQuantity,
  normalizeWasteReason,
  normalizeWasteUnitType,
  unitTypeDefinition
} from "../data/normalize.js";
import { formatDateTime, formatDateTimeLocalInput } from "../shared/dates.js";
import { formatActualUsageLabel, formatSignedAmount, formatStockAmount } from "../shared/formatters.js";
import { createNode, emptyState, showToast } from "./dom.js";
import {
  can,
  canView,
  currentRole,
  currentRoleKey,
  currentUser,
  ensureActiveViewAccess,
  roleDefinition,
  visibleViews
} from "./permissions.js";
import {
  customerById,
  ingredientById,
  money,
  orderById,
  productById,
  supplierById,
  tableById
} from "./entities.js";
import {
  findCustomerByPhone,
  findCustomerBySearchValue,
  getAddressHistoryForCustomer,
  getCustomerOptionLabel,
  getCustomerPrimaryAddress,
  getFavoriteItemsForCustomer,
  getManualOrderCustomerDetails,
  getOrdersForCustomer,
  upsertCustomerFromOrderDetails
} from "./customer-selectors.js";
import {
  getAvailableReservationTable,
  getReservationIssues,
  getReservationRequestValidation,
  getReservationValidation
} from "./reservation-selectors.js";
import {
  convertActualUsageToStockUnits,
  convertRecipeLineToStockUnits,
  getLineCost,
  getProductCost,
  getProductGrossMargin,
  getProductMargin,
  getProductMarginProfile,
  getRecipeLineQuantity,
  getRecipeLineWasteMultiplier,
  getRecipeMeasure,
  getRecipeMeasureOptionsForIngredient,
  getRecipeUsageLabel,
  productAvailabilityLabel,
  productHasConditionalRecipeLines,
  recipeLineAppliesToOrder
} from "./recipe-selectors.js";
import {
  getDefaultProductionProductId,
  getProductionExecutionDraft,
  getProductionOutputUnitType,
  getProductionProducts,
  getProductionReadiness
} from "./production-selectors.js";
import {
  formatLocationOptionLabel,
  formatWasteQuantity,
  getActiveSupplierOrder,
  getAllInventoryLocations,
  getIngredientLocationRows,
  getIngredientStatus,
  getLowStockIngredients,
  getOverStockIngredients,
  getProductAvailability,
  getStockRequirementsForItems,
  getStockShortages,
  getSupplierKey,
  getSupplierMinimumOrderGap,
  getSupplierOrderDrafts,
  getSupplierOrderPayload,
  getSupplierOrderQuantity,
  getSupplierOrderTotal,
  getWasteReportSummary,
  inventoryActionLabel,
  supplierForIngredient,
  wasteUnitLabel
} from "./inventory-selectors.js";
import {
  getKitchenSlaSummary,
  getOpenTickets,
  getSlaSummaryLabel,
  getStationNames,
  getTicketOrderAgeMinutes,
  getTicketPriority,
  getTicketSla,
  getTicketStatusLabel,
  ticketStatusClass
} from "./kitchen-selectors.js";
import {
  fulfillmentLabel,
  getCurrentOrderContext,
  getItemCount,
  getItemsTotal,
  getKitchenOrderProgressSummary,
  getOrderFulfillmentMeta,
  getOrderPaidByName,
  getOrderPaymentSummary,
  getOrderStaffName,
  getOrderSubtotalExcludingVat,
  getOrderTotal,
  getOrderVatBreakdown,
  getOrderableProductsForContext,
  getVatLabel,
  isOrderPaid,
  normalizeOrderItems,
  orderLocationLabel,
  orderStatusClass,
  orderTypeLabel
} from "./order-selectors.js";
import { getOrderCompletionToast } from "./order-toasts.js";
import { getManagementDashboardData } from "./reporting-selectors.js";

const {
  assignQrCode,
  createTableQrCode,
  getCustomerOrderingSession,
  getCustomerQrSession,
  getQrOrderUrl,
  getStaffUrl,
  getWebsiteOrderSession,
  getWebsiteOrderingUrl,
  getWebsiteReservationSession,
  getWebsiteReservationUrl,
  openQrCustomerUrl,
  regenerateQrCode,
  toggleQrCode
} = createQrRuntime({
  can,
  render: () => render(),
  showToast,
  tableById
});

const {
  addDeliveryNote,
  assignDeliveryOrderToDriver,
  assignDriverToDeliveryOrder,
  canManageDeliveryOperations,
  currentDriverRecord,
  currentUserCanUpdateDelivery,
  driverById,
  markDeliveryCashCollected,
  updateDeliveryStatus,
  uploadDeliveryProof
} = createDeliveryRuntime({
  currentRoleKey,
  currentUser,
  isOrderPaid,
  orderById,
  render: () => render(),
  showToast
});

const {
  canManageSchedule,
  cancelStaffShiftEdit,
  clockInShift,
  clockOutShift,
  createStaffShift,
  endShiftBreak,
  moveScheduleWeek,
  notifyStaffShift,
  selectStaffShiftForEdit,
  startShiftBreak
} = createSchedulingRuntime({
  can,
  currentRoleKey,
  currentUser,
  render: () => render(),
  roleDefinition,
  showToast
});

const {
  approveSupplierOrder,
  applyInventoryAction,
  clearSupplierForm,
  deductInventoryForItems,
  getSelectedInventoryLocation,
  logWaste,
  markSupplierOrderOrdered,
  pushInventoryHistory,
  receiveSupplierOrder,
  recordProduction,
  recordWaste,
  rememberInventoryLocation,
  saveSupplierRecord,
  selectSupplierForEdit,
  sendSupplierOrder
} = createInventoryActionsRuntime({
  can,
  currentUser,
  formatActualUsageLabel,
  formatDateTimeLocalInput,
  formatSignedAmount,
  formatStockAmount,
  formatWasteQuantity,
  getActiveSupplierOrder,
  getIngredientLocationRows,
  getIngredientPrimaryLocation,
  getIngredientStatus,
  getProductionExecutionDraft,
  getProductionReadiness,
  getStockRequirementsForItems,
  getSupplierKey,
  getSupplierOrderDrafts,
  getSupplierOrderQuantity,
  ingredientById,
  money,
  productById,
  render: () => render(),
  renderProductionRecipeFields: (options) => renderProductionRecipeFields(options),
  showToast,
  supplierById,
  supplierForIngredient,
  updateProductionCostPreview: () => updateProductionCostPreview()
});

const {
  addOrderDraftLine,
  addTicketIssueNote,
  advanceOrder,
  advanceTicket,
  cancelOrder,
  clearOrderDraft,
  createOrder,
  getSelectedLineModifiers,
  markOrderPaid,
  markOrderServed,
  markTicketDelayed,
  printOrderReceipt,
  removeOrderDraftLine,
  sendOrderToKitchen,
  showOrderReceipt,
  updateTicketStatus,
  validateOrderForKitchen
} = createStaffOrderRuntime({
  assignDriverToDeliveryOrder,
  can,
  canView,
  currentUser,
  deductInventoryForItems,
  formatStockAmount,
  getManualOrderCustomerDetails,
  getOrderCompletionToast,
  getOrderFulfillmentMeta,
  getOrderTotal,
  getProductAvailability,
  getStockShortages,
  getTicketStatusLabel,
  ingredientById,
  isOrderPaid,
  normalizeOrderItems,
  orderById,
  productById,
  recipeLineAppliesToOrder,
  render: () => render(),
  renderManualOrderControls: () => renderManualOrderControls(),
  renderOrderBuilder: () => renderOrderBuilder(),
  showToast,
  tableById,
  upsertCustomerFromOrderDetails
});

let renderCustomerOrderingSurfaces = () => false;

const {
  addCustomerCartItem,
  adjustCustomerCartItem,
  closeCustomerUpsell,
  getCustomerCartItems,
  getCustomerCartTotal,
  getCustomerOrderContext,
  removeCustomerCartItem,
  setCustomerCartOpen,
  setWebsiteFulfillment,
  startNewCustomerOrder,
  submitCustomerQrOrder,
  submitWebsiteOrder
} = createCustomerOrderingRuntime({
  createWebsiteCheckoutSession,
  getCustomerOrderingSession,
  getCustomerQrSession,
  getItemsTotal,
  getProductAvailability,
  getStockShortages,
  getWebsiteOrderSession,
  normalizeOrderItems,
  productById,
  render: () => render(),
  renderCustomerQrScreen: () => renderCustomerQrScreen(),
  renderCustomerOrderingSurfaces: () => renderCustomerOrderingSurfaces(),
  renderWebsiteOrderScreen: () => renderWebsiteOrderScreen(),
  sendOrderToKitchen,
  showToast,
  upsertCustomerFromOrderDetails,
  validateOrderForKitchen
});

const {
  importExternalOrder,
  pushExternalOrderStatus,
  pushMenuToExternalPlatform,
  saveExternalPlatformRecord,
  saveExternalProductMapping,
  toggleExternalProductMapping
} = createExternalDeliveryRuntime({
  can,
  currentUser,
  getOrderTotal,
  normalizeOrderItems,
  productById,
  render: () => render(),
  sendOrderToKitchen,
  showToast,
  upsertCustomerFromOrderDetails,
  validateOrderForKitchen
});

const publicOrderingUi = createPublicOrderingUi({
  emptyState,
  fulfillmentLabel,
  formatStockAmount,
  getCustomerCartItems,
  getCustomerOrderContext,
  getItemCount,
  getItemsTotal,
  getAvailableReservationTable,
  getOrderPaymentSummary,
  getOrderTotal,
  getOrderableProductsForContext,
  getProductAvailability,
  getReservationValidation,
  getStaffUrl,
  getWebsiteOrderingUrl,
  getStockShortages,
  getCustomerQrSession,
  getWebsiteOrderSession,
  getWebsiteReservationSession,
  getWebsiteReservationUrl,
  money,
  orderById,
  orderLocationLabel,
  productById
});
const { renderCustomerQrScreen, renderPublicHomeScreen, renderWebsiteOrderScreen, renderWebsiteReservationScreen } = publicOrderingUi;
renderCustomerOrderingSurfaces = publicOrderingUi.renderCustomerOrderingSurfaces;

const {
  alertCard,
  getSelectedPaymentMethodFromAction,
  orderCard,
  orderItemDetailText,
  paymentCaptureHtml
} = createOrderCardsUi({
  can,
  formatStockAmount,
  fulfillmentLabel,
  getActiveSupplierOrder,
  getOrderProgressSummary: getKitchenOrderProgressSummary,
  getOrderFulfillmentMeta,
  getOrderPaymentSummary,
  getOrderStaffName,
  getOrderTotal,
  getSupplierOrderQuantity,
  money,
  orderLocationLabel,
  orderStatusClass,
  orderTypeLabel,
  productById
});

const { renderDashboard, renderMetrics } = createDashboardUi({
  alertCard,
  emptyState,
  formatStockAmount,
  formatDateTime,
  getIngredientStatus,
  getKitchenSlaSummary,
  getLowStockIngredients,
  getManagementDashboardData,
  getOpenTickets,
  getOrderTotal,
  getProductCost,
  getProductMarginProfile,
  getRecipeUsageLabel,
  getSlaSummaryLabel,
  getStationNames,
  getStockRequirementsForItems,
  ingredientById,
  isActiveDelivery,
  money,
  normalizeOrderItems,
  normalizeStockQuantity,
  orderCard,
  productById
});

const { renderOrders, renderReceipt } = createOrdersUi({
  can,
  emptyState,
  formatDateTime,
  fulfillmentLabel,
  getOrderFulfillmentMeta,
  getOrderPaidByName,
  getOrderPaymentSummary,
  getOrderStaffName,
  getOrderSubtotalExcludingVat,
  getOrderTotal,
  getOrderVatBreakdown,
  getVatLabel,
  isOrderPaid,
  money,
  orderById,
  orderCard,
  orderItemDetailText,
  orderLocationLabel,
  orderStatusClass,
  orderTypeDefinition,
  orderTypeLabel,
  paymentCaptureHtml,
  productById
});

const { renderKitchen, renderKitchenOrderProgress } = createKitchenUi({
  can,
  emptyState,
  getKitchenSlaSummary,
  getOpenTickets,
  getStationNames,
  getTicketOrderAgeMinutes,
  getTicketPriority,
  getTicketSla,
  getTicketStatusLabel,
  orderById,
  orderLocationLabel,
  orderTypeLabel,
  productById,
  ticketStatusClass
});

const {
  renderInventory,
  renderInventoryActionForm,
  renderProductManagement,
  renderPurchasedProductForm,
  renderSellableProductForm,
  renderSellableRecipeCostPreview,
  renderWasteForms,
  renderWasteReport,
  renderWasteTracking
} = createInventoryUi({
  can,
  alertCard,
  convertActualUsageToStockUnits,
  convertRecipeLineToStockUnits,
  convertWasteQuantityToStockUnits,
  emptyState,
  formatLocationOptionLabel,
  formatDateTimeLocalInput,
  formatSignedAmount,
  formatStockAmount,
  formatWasteQuantity,
  getActiveSupplierOrder,
  getAllInventoryLocations,
  getDefaultProductionProductId,
  getIngredientLocationRows,
  getIngredientPrimaryLocation,
  getIngredientStatus,
  getItemsTotal,
  getLineCost,
  getLowStockIngredients,
  getOverStockIngredients,
  getProductCost,
  getProductGrossMargin,
  getProductMargin,
  getProductMarginProfile,
  getRecipeMeasure,
  getRecipeMeasureOptionsForIngredient,
  getRecipeUsageLabel,
  getSupplierOrderDrafts,
  getSupplierMinimumOrderGap,
  getSupplierOrderPayload,
  getSupplierOrderQuantity,
  getSupplierOrderTotal,
  getWasteCost,
  getWasteReportSummary,
  getWasteUnitOptionsForIngredient,
  ingredientById,
  inventoryActionLabel,
  money,
  currentUser,
  normalizeInventoryLocationName,
  normalizeKitchenStation,
  normalizeMarginPercent,
  normalizeRecipeAppliesTo,
  normalizeWasteReason,
  normalizeWasteUnitType,
  normalizeStockQuantity,
  productAvailabilityLabel,
  productById,
  productHasConditionalRecipeLines,
  roundMoneyValue,
  supplierById,
  supplierForIngredient,
  unitTypeDefinition,
  wasteUnitLabel
});

const {
  addSellableRecipeLine,
  createPurchasedProduct,
  createSellableProduct,
  removeSellableRecipeLine,
  togglePurchasedProduct,
  toggleSellableProduct,
  updateIngredientPurchasePrice
} = createProductActionsRuntime({
  can,
  getRecipeLineQuantity,
  getRecipeMeasure,
  getSelectedInventoryLocation,
  ingredientById,
  productById,
  pushInventoryHistory,
  rememberInventoryLocation,
  render: () => render(),
  showToast
});

const {
  getCurrentUserProcedures,
  getProcedureStepProgress,
  procedureAssignedToUser,
  procedureById,
  procedurePeriodStatus,
  procedureStepsComplete,
  renderProcedureFormControls,
  renderProcedures,
  renderProductionRecipeFields,
  updateProductionCostPreview
} = createProceduresUi({
  can,
  currentRole,
  currentUser,
  emptyState,
  formatActualUsageLabel,
  formatSignedAmount,
  formatStockAmount,
  getAllInventoryLocations,
  getDefaultProductionProductId,
  getLineCost,
  getProductMargin,
  getProductionExecutionDraft,
  getProductionFieldName,
  getProductionOutputDefault,
  getProductionOutputUnitType,
  getProductionProducts,
  getProductionReadiness,
  getRecipeLineQuantity,
  getRecipeLineWasteMultiplier,
  getRecipeMeasure,
  getRecipeUsageLabel,
  getWasteUnitOptionsForIngredient,
  ingredientById,
  money,
  productById,
  roleDefinition,
  unitTypeDefinition
});

const {
  createProcedure,
  promptAndRecordProcedureStatus,
  recordProcedureCompletion,
  setProcedureStepProgress
} = createProcedureActionsRuntime({
  can,
  currentUser,
  getProcedureStepProgress,
  procedureAssignedToUser,
  procedureById,
  procedureStepsComplete,
  render: () => render(),
  roleDefinition,
  showToast
});

const {
  loadCustomerIntoManualOrder,
  renderManualOrderControls,
  renderOrderBuilder,
  renderProductsInSelects
} = createOrderBuilderUi({
  can,
  customerById,
  emptyState,
  findCustomerByPhone,
  findCustomerBySearchValue,
  formatStockAmount,
  fulfillmentLabel,
  getAddressHistoryForCustomer,
  getCurrentOrderContext,
  getCustomerOptionLabel,
  getCustomerPrimaryAddress,
  getDefaultProductionProductId,
  getFavoriteItemsForCustomer,
  getItemCount,
  getItemsTotal,
  getOrderTotal,
  getOrderableProductsForContext,
  getOrdersForCustomer,
  getProductAvailability,
  getProductionProducts,
  getStockShortages,
  money,
  normalizeOrderItems,
  productById,
  renderProductionRecipeFields
});

const {
  applyScannedInventoryAction,
  scanCode
} = createScanningRuntime({
  can,
  canView,
  getAllInventoryLocations,
  ingredientById,
  productById,
  render: () => render(),
  renderInventoryActionForm,
  renderOrderBuilder,
  renderProductsInSelects,
  renderWasteForms,
  showToast,
  tableById
});

const {
  getCurrentDriverDeliveryOrders,
  getDeliveryOrders,
  getDriverDeliveryOrders,
  renderDeliveryManager,
  renderDriverApp,
  renderTeam
} = createTeamUi({
  can,
  canManageDeliveryOperations,
  canManageSchedule,
  currentDriverRecord,
  currentRoleKey,
  currentUser,
  currentUserCanUpdateDelivery,
  driverById,
  emptyState,
  getOrderPaymentSummary,
  orderById,
  orderItemDetailText,
  productById,
  roleDefinition
});

const {
  renderQrCodeManagement,
  renderReservationPlanner,
  renderReservations,
  renderSettings
} = createSettingsUi({
  can,
  emptyState,
  getAvailableReservationTable,
  getQrOrderUrl,
  getReservationIssues,
  getReservationValidation,
  getReservationWindowLabel,
  getWebsiteReservationUrl,
  tableById
});

const { renderExternalDeliveryIntegrations } = createExternalDeliveryUi({
  can,
  emptyState,
  formatDateTime,
  getOrderTotal,
  money,
  orderById,
  productById
});

const {
  addReservation,
  addReservationBlock,
  cancelReservationEdit,
  deleteReservationBlock,
  deleteReservationCapacityRule,
  saveReservationCapacityRule,
  selectReservationForEdit,
  submitWebsiteReservation,
  updateReservationStatus
} = createReservationActionsRuntime({
  can,
  getAvailableReservationTable,
  getReservationRequestValidation,
  getReservationValidation,
  render: () => render(),
  renderReservationPlanner,
  renderWebsiteReservationScreen: () => renderWebsiteReservationScreen(),
  showToast,
  tableById
});

const {
  createStaffUser,
  saveRestaurantSettings
} = createAdminActionsRuntime({
  can,
  render: () => render(),
  roleDefinition,
  showToast
});

const {
  login,
  logout,
  setView
} = createSessionActionsRuntime({
  canView,
  render: () => render(),
  roleDefinition,
  showToast
});

const { render, renderNav, updateView } = createAppRenderer({
  can,
  createNode,
  currentUser,
  ensureActiveViewAccess,
  getCurrentUserProcedures,
  getCustomerOrderingSession,
  getWebsiteOrderingUrl,
  getWebsiteReservationUrl,
  getLowStockIngredients,
  getOpenTickets,
  isActiveDelivery,
  procedurePeriodStatus,
  renderCustomerQrScreen,
  renderDashboard,
  renderInventory,
  renderKitchen,
  renderMetrics,
  renderOrderBuilder,
  renderOrders,
  renderProductManagement,
  renderProductsInSelects,
  renderProcedures,
  renderPublicHomeScreen,
  renderReservationPlanner,
  renderReservations,
  renderSettings,
  renderExternalDeliveryIntegrations,
  renderTeam,
  renderWasteTracking,
  renderWebsiteOrderScreen,
  renderWebsiteReservationScreen,
  roleDefinition,
  visibleViews
});

function renderTimingSurfaces() {
  const customerSession = getCustomerOrderingSession();
  if (customerSession?.mode === "qr") {
    renderCustomerQrScreen();
    return;
  }
  if (customerSession?.mode === "website") {
    renderWebsiteOrderScreen();
    return;
  }
  if (customerSession?.mode === "reservation") {
    renderWebsiteReservationScreen();
    return;
  }
  if (!currentUser()) return;
  ensureActiveViewAccess();
  renderNav();
  renderMetrics();
  renderDashboard();
  renderKitchen();
  renderProcedures();
  renderTeam();
}

export function createAppRuntime() {
  return {
    handlers: {
      addCustomerCartItem,
      addDeliveryNote,
      addOrderDraftLine,
      addReservation,
      addReservationBlock,
      addSellableRecipeLine,
      adjustCustomerCartItem,
      advanceOrder,
      advanceTicket,
      addTicketIssueNote,
      applyScannedInventoryAction,
      approveSupplierOrder,
      applyInventoryAction,
      assignDeliveryOrderToDriver,
      assignQrCode,
      cancelOrder,
      cancelReservationEdit,
      can,
      clearSupplierForm,
      clearOrderDraft,
      clockInShift,
      clockOutShift,
      createOrder,
      createProcedure,
      createPurchasedProduct,
      createSellableProduct,
      createStaffShift,
      createStaffUser,
      createTableQrCode,
      closeCustomerUpsell,
      deleteReservationBlock,
      deleteReservationCapacityRule,
      findCustomerBySearchValue,
      getCustomerOrderingSession,
      getSelectedLineModifiers,
      getSelectedPaymentMethodFromAction,
      loadCustomerIntoManualOrder,
      logWaste,
      login,
      logout,
      importExternalOrder,
      markDeliveryCashCollected,
      markOrderPaid,
      markOrderServed,
      markSupplierOrderOrdered,
      markTicketDelayed,
      moveScheduleWeek,
      notifyStaffShift,
      openQrCustomerUrl,
      printOrderReceipt,
      promptAndRecordProcedureStatus,
      receiveSupplierOrder,
      recordProcedureCompletion,
      recordProduction,
      recordWaste,
      regenerateQrCode,
      removeCustomerCartItem,
      removeOrderDraftLine,
      removeSellableRecipeLine,
      render,
      renderInventoryActionForm,
      renderManualOrderControls,
      renderOrderBuilder,
      renderProcedureFormControls,
      renderProductionRecipeFields,
      renderProductsInSelects,
      renderReservationPlanner,
      renderSellableProductForm,
      renderSellableRecipeCostPreview,
      renderWasteForms,
      saveExternalPlatformRecord,
      saveExternalProductMapping,
      saveReservationCapacityRule,
      saveRestaurantSettings,
      saveSupplierRecord,
      scanCode,
      sendOrderToKitchen,
      sendSupplierOrder,
      selectStaffShiftForEdit,
      selectReservationForEdit,
      selectSupplierForEdit,
      setCustomerCartOpen,
      setProcedureStepProgress,
      setView,
      setWebsiteFulfillment,
      showOrderReceipt,
      showToast,
      startNewCustomerOrder,
      startShiftBreak,
      submitCustomerQrOrder,
      submitWebsiteReservation,
      submitWebsiteOrder,
      tableById,
      pushExternalOrderStatus,
      pushMenuToExternalPlatform,
      togglePurchasedProduct,
      toggleExternalProductMapping,
      toggleQrCode,
      toggleSellableProduct,
      updateDeliveryStatus,
      updateIngredientPurchasePrice,
      updateReservationStatus,
      updateProductionCostPreview,
      updateTicketStatus,
      uploadDeliveryProof,
      cancelStaffShiftEdit,
      endShiftBreak
    },
    handleWebsitePaymentReturn: () => handleWebsitePaymentReturn({
      render,
      sendOrderToKitchen,
      showToast
    }),
    render,
    renderTimingSurfaces
  };
}

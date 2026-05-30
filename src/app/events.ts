import { resetState, saveState, state } from "./state.js";

export function bindAppEvents(handlers) {
  const document: any = window.document;
  const {
    addCustomerCartItem,
    addDeliveryNote,
    addOrderDraftLine,
    addReservation,
    addSellableRecipeLine,
    adjustCustomerCartItem,
    advanceOrder,
    advanceTicket,
    addTicketIssueNote,
    applyInventoryAction,
    assignDeliveryOrderToDriver,
    assignQrCode,
    cancelOrder,
    can,
    clearOrderDraft,
    createOrder,
    createProcedure,
    createPurchasedProduct,
    createSellableProduct,
    createStaffUser,
    createTableQrCode,
    findCustomerBySearchValue,
    getCustomerOrderingSession,
    getSelectedLineModifiers,
    getSelectedPaymentMethodFromAction,
    loadCustomerIntoManualOrder,
    logWaste,
    login,
    logout,
    markDeliveryCashCollected,
    markOrderPaid,
    markOrderServed,
    markSupplierOrderOrdered,
    markTicketDelayed,
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
    saveRestaurantSettings,
    sendOrderToKitchen,
    setProcedureStepProgress,
    setView,
    setWebsiteFulfillment,
    showOrderReceipt,
    showToast,
    startNewCustomerOrder,
    submitCustomerQrOrder,
    submitWebsiteOrder,
    tableById,
    togglePurchasedProduct,
    toggleQrCode,
    toggleSellableProduct,
    updateDeliveryStatus,
    updateIngredientPurchasePrice,
    updateProductionCostPreview,
    updateTicketStatus,
    uploadDeliveryProof
  } = handlers;
  document.addEventListener("click", (event: any) => {
    const demoLogin = event.target.closest("[data-demo-login]");
    if (demoLogin) {
      const loginForm = document.querySelector("#loginForm");
      loginForm.elements.email.value = demoLogin.dataset.demoLogin;
      loginForm.elements.password.value = demoLogin.dataset.demoPassword;
      return;
    }
  
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) setView(viewButton.dataset.view);
  
    const viewLink = event.target.closest("[data-view-link]");
    if (viewLink) setView(viewLink.dataset.viewLink);
  
    const stationButton = event.target.closest("[data-station]");
    if (stationButton) {
      state.activeStation = stationButton.dataset.station;
      saveState();
      render();
    }
  
    const orderFilter = event.target.closest("[data-order-filter]");
    if (orderFilter) {
      state.orderFilter = orderFilter.dataset.orderFilter;
      saveState();
      render();
    }
  
    const nextTicket = event.target.closest("[data-next-ticket]");
    if (nextTicket) advanceTicket(nextTicket.dataset.nextTicket);

    const ticketStatus = event.target.closest("[data-ticket-status][data-ticket-id]");
    if (ticketStatus) updateTicketStatus(ticketStatus.dataset.ticketId, ticketStatus.dataset.ticketStatus);

    const delayTicket = event.target.closest("[data-delay-ticket]");
    if (delayTicket) markTicketDelayed(delayTicket.dataset.delayTicket);

    const issueTicket = event.target.closest("[data-issue-ticket]");
    if (issueTicket) addTicketIssueNote(issueTicket.dataset.issueTicket);
  
    const nextOrder = event.target.closest("[data-next-order]");
    if (nextOrder) advanceOrder(nextOrder.dataset.nextOrder);
  
    const supplierOrdered = event.target.closest("[data-supplier-ordered]");
    if (supplierOrdered) markSupplierOrderOrdered(supplierOrdered.dataset.supplierOrdered);
  
    const supplierReceived = event.target.closest("[data-supplier-received]");
    if (supplierReceived) receiveSupplierOrder(supplierReceived.dataset.supplierReceived);
  
    const removeDraft = event.target.closest("[data-remove-draft-index]");
    if (removeDraft) removeOrderDraftLine(removeDraft.dataset.removeDraftIndex);

    const sendKitchen = event.target.closest("[data-send-kitchen]");
    if (sendKitchen) sendOrderToKitchen(sendKitchen.dataset.sendKitchen);

    const markServed = event.target.closest("[data-mark-served]");
    if (markServed) markOrderServed(markServed.dataset.markServed);

    const markPaid = event.target.closest("[data-mark-paid]");
    if (markPaid) markOrderPaid(markPaid.dataset.markPaid, getSelectedPaymentMethodFromAction(markPaid));

    const assignDeliveryDriver = event.target.closest("[data-assign-delivery-driver]");
    if (assignDeliveryDriver) assignDeliveryOrderToDriver(assignDeliveryDriver.dataset.assignDeliveryDriver);

    const deliveryStatus = event.target.closest("[data-delivery-status][data-delivery-order]");
    if (deliveryStatus) updateDeliveryStatus(deliveryStatus.dataset.deliveryOrder, deliveryStatus.dataset.deliveryStatus);

    const deliveryCash = event.target.closest("[data-delivery-cash]");
    if (deliveryCash) markDeliveryCashCollected(deliveryCash.dataset.deliveryCash);

    const deliveryNote = event.target.closest("[data-add-delivery-note]");
    if (deliveryNote) addDeliveryNote(deliveryNote.dataset.addDeliveryNote);

    const deliveryProof = event.target.closest("[data-upload-delivery-proof]");
    if (deliveryProof) uploadDeliveryProof(deliveryProof.dataset.uploadDeliveryProof);

    const cancelButton = event.target.closest("[data-cancel-order]");
    if (cancelButton) cancelOrder(cancelButton.dataset.cancelOrder);

    const showReceipt = event.target.closest("[data-show-receipt]");
    if (showReceipt) showOrderReceipt(showReceipt.dataset.showReceipt);

    const printReceipt = event.target.closest("[data-print-receipt]");
    if (printReceipt) printOrderReceipt(printReceipt.dataset.printReceipt);
  
    const removeRecipeLine = event.target.closest("[data-remove-recipe-line]");
    if (removeRecipeLine) removeSellableRecipeLine(removeRecipeLine.dataset.removeRecipeLine);
  
    const toggleSellable = event.target.closest("[data-toggle-sellable]");
    if (toggleSellable) toggleSellableProduct(toggleSellable.dataset.toggleSellable);
  
    const togglePurchased = event.target.closest("[data-toggle-purchased]");
    if (togglePurchased) togglePurchasedProduct(togglePurchased.dataset.togglePurchased);

    const updatePurchasePrice = event.target.closest("[data-update-purchase-price]");
    if (updatePurchasePrice) {
      const input = document.querySelector(`[data-purchase-price-input="${updatePurchasePrice.dataset.updatePurchasePrice}"]`);
      updateIngredientPurchasePrice(updatePurchasePrice.dataset.updatePurchasePrice, input?.value);
    }

    const procedureDone = event.target.closest("[data-procedure-done]");
    if (procedureDone) recordProcedureCompletion(procedureDone.dataset.procedureDone, "Done");

    const procedureProblem = event.target.closest("[data-procedure-problem]");
    if (procedureProblem) promptAndRecordProcedureStatus(procedureProblem.dataset.procedureProblem, "Problem");

    const procedureSkip = event.target.closest("[data-procedure-skip]");
    if (procedureSkip) promptAndRecordProcedureStatus(procedureSkip.dataset.procedureSkip, "Skipped");

    const openQr = event.target.closest("[data-open-qr]");
    if (openQr) openQrCustomerUrl(openQr.dataset.openQr);

    const assignQr = event.target.closest("[data-assign-qr]");
    if (assignQr) assignQrCode(assignQr.dataset.assignQr);

    const regenerateQr = event.target.closest("[data-regenerate-qr]");
    if (regenerateQr) regenerateQrCode(regenerateQr.dataset.regenerateQr);

    const toggleQr = event.target.closest("[data-toggle-qr]");
    if (toggleQr) toggleQrCode(toggleQr.dataset.toggleQr);

    const customerAdd = event.target.closest("[data-customer-add]");
    if (customerAdd) addCustomerCartItem(customerAdd.dataset.customerAdd);

    const customerIncrease = event.target.closest("[data-customer-increase]");
    if (customerIncrease) adjustCustomerCartItem(customerIncrease.dataset.customerIncrease, 1);

    const customerDecrease = event.target.closest("[data-customer-decrease]");
    if (customerDecrease) adjustCustomerCartItem(customerDecrease.dataset.customerDecrease, -1);

    const customerRemove = event.target.closest("[data-customer-remove]");
    if (customerRemove) removeCustomerCartItem(customerRemove.dataset.customerRemove);

    const websiteFulfillment = event.target.closest("[data-website-fulfillment]");
    if (websiteFulfillment) setWebsiteFulfillment(websiteFulfillment.dataset.websiteFulfillment);

    const customerNewOrder = event.target.closest("[data-customer-new-order]");
    if (customerNewOrder) startNewCustomerOrder();
  });
  
  document.addEventListener("change", (event: any) => {
    const productionProduct = event.target.closest("#productionProduct");
    if (productionProduct) {
      renderProductionRecipeFields({ reset: true });
      return;
    }

    const productionOutputIngredient = event.target.closest("#productionOutputIngredient");
    if (productionOutputIngredient) {
      renderProductionRecipeFields();
      return;
    }

    const productionForm = event.target.closest("#productionForm");
    if (productionForm) {
      updateProductionCostPreview();
      return;
    }

    const qrTableSelect = event.target.closest("#qrTableSelect");
    if (qrTableSelect) {
      const table = tableById(qrTableSelect.value);
      const areaInput = document.querySelector("#qrAreaInput");
      if (areaInput && table) areaInput.value = table.zone;
      return;
    }
  
    const sellableRecipeIngredient = event.target.closest("#sellableRecipeIngredient");
    if (sellableRecipeIngredient) {
      renderSellableProductForm();
      return;
    }
  
    const procedureStep = event.target.closest("[data-procedure-step]");
    if (!procedureStep) return;
    if (!can("canCompleteProcedures")) {
      procedureStep.checked = !procedureStep.checked;
      showToast("This role cannot update procedures.");
      return;
    }
    setProcedureStepProgress(procedureStep.dataset.procedureStep, procedureStep.dataset.stepIndex, procedureStep.checked);
  });
  
  document.querySelector("#loginForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    login(new FormData(event.currentTarget));
  });

  document.addEventListener("submit", (event: any) => {
    const customerOrderForm = event.target.closest("#customerOrderForm");
    if (!customerOrderForm) return;
    event.preventDefault();
    if (getCustomerOrderingSession()?.mode === "website") {
      submitWebsiteOrder(new FormData(customerOrderForm));
    } else {
      submitCustomerQrOrder(new FormData(customerOrderForm));
    }
  });
  
  document.querySelector("#orderForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createOrder(new FormData(event.currentTarget), event.submitter?.dataset.orderMode || "kitchen");
  });
  
  document.querySelector("#addOrderLineBtn").addEventListener("click", () => {
    addOrderDraftLine(
      document.querySelector("#productSelect").value,
      document.querySelector("#orderQuantity").value,
      document.querySelector("#orderLineNote")?.value,
      getSelectedLineModifiers()
    );
  });
  
  document.querySelector("#clearOrderDraftBtn").addEventListener("click", clearOrderDraft);
  document.querySelector("#productSelect").addEventListener("change", renderOrderBuilder);
  document.querySelector("#orderQuantity").addEventListener("input", renderOrderBuilder);
  document.querySelector("#orderForm").elements.channel.addEventListener("change", () => {
    renderProductsInSelects();
    renderOrderBuilder();
  });
  document.querySelector("#orderForm").elements.fulfillment?.addEventListener("change", () => {
    renderProductsInSelects();
    renderOrderBuilder();
  });
  document.querySelector("#customerSelect")?.addEventListener("change", (event: any) => {
    if (event.currentTarget.value) loadCustomerIntoManualOrder(event.currentTarget.value);
    else renderManualOrderControls();
  });
  document.querySelector("#customerSearch")?.addEventListener("change", (event: any) => {
    const customer = findCustomerBySearchValue(event.currentTarget.value);
    if (customer) loadCustomerIntoManualOrder(customer.id);
    else renderManualOrderControls();
  });
  document.querySelector("#customerSearch")?.addEventListener("input", renderManualOrderControls);
  ["#manualCustomerName", "#manualCustomerPhone", "#manualDeliveryAddress", "#manualCustomerNotes"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", renderManualOrderControls);
  });
  
  document.querySelector("#addRecipeLineBtn").addEventListener("click", () => {
    addSellableRecipeLine(
      document.querySelector("#sellableRecipeIngredient").value,
      document.querySelector("#sellableRecipeQuantity").value,
      document.querySelector("#sellableRecipeMeasure").value,
      document.querySelector("#sellableRecipeStation").value,
      document.querySelector("#sellableRecipeWaste").value,
      document.querySelector("#sellableRecipeAppliesTo").value,
      document.querySelector("#sellableRecipeNotes").value
    );
  });

  document.querySelector("#sellableProductForm").addEventListener("input", (event: any) => {
    if (event.target.closest("[name='price'], [name='targetMargin'], [name='minMargin']")) {
      renderSellableRecipeCostPreview();
    }
  });
  
  document.querySelector("#sellableProductForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createSellableProduct(new FormData(event.currentTarget));
  });
  
  document.querySelector("#purchasedProductForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createPurchasedProduct(new FormData(event.currentTarget));
  });
  
  document.querySelector("#inventoryActionForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    applyInventoryAction(new FormData(event.currentTarget));
  });
  document.querySelector("#inventoryActionForm").addEventListener("change", renderInventoryActionForm);

  document.querySelectorAll("[data-waste-form]").forEach((form) => {
    form.addEventListener("submit", (event: any) => {
      event.preventDefault();
      recordWaste(new FormData(event.currentTarget), event.currentTarget);
    });
    form.addEventListener("input", renderWasteForms);
    form.addEventListener("change", renderWasteForms);
  });

  document.querySelector("#procedureForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    if (createProcedure(new FormData(event.currentTarget))) {
      event.currentTarget.reset();
      renderProcedureFormControls();
    }
  });
  
  document.querySelector("#productionForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    recordProduction(event.currentTarget);
  });
  document.querySelector("#productionForm").addEventListener("input", updateProductionCostPreview);
  
  document.querySelector("#reservationForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    addReservation(new FormData(event.currentTarget));
  });
  document.querySelector("#reservationForm").addEventListener("input", renderReservationPlanner);
  document.querySelector("#reservationForm").addEventListener("change", renderReservationPlanner);
  
  document.querySelector("#staffUserForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createStaffUser(new FormData(event.currentTarget));
  });
  
  document.querySelector("#settingsForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveRestaurantSettings(new FormData(event.currentTarget));
  });

  document.querySelector("#qrCodeForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createTableQrCode(new FormData(event.currentTarget));
  });
  
  document.querySelector("#logoutBtn").addEventListener("click", logout);
  
  document.querySelector("#quickOrderBtn").addEventListener("click", () => {
    if (!can("canCreateOrders")) return;
    setView("orders");
    document.querySelector("#orderForm").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  
  document.querySelector("#resetDemoBtn").addEventListener("click", () => {
    if (!can("canResetDemo")) return;
    const previousUserId = state.currentUserId;
    const nextState = resetState();
    if (nextState.users.some((user) => user.id === previousUserId)) nextState.currentUserId = previousUserId;
    saveState();
    render();
    showToast("Demo data reset.");
  });
  
  document.querySelector("#wasteKeftaBtn")?.addEventListener("click", logWaste);
  }

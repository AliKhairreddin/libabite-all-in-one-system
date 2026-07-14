import { flushRemoteState, resetState, saveState, state } from "./state.js";

export function bindAppEvents(handlers) {
  const document: any = window.document;
  const {
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
    cancelStaffShiftEdit,
    can,
    chooseAddressSuggestion,
    clearSupplierForm,
    clearOrderDraft,
    clockInShift,
    clockOutShift,
    closeAddressSuggestions,
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
    handleAddressFocus,
    handleAddressFocusOut,
    handleAddressInput,
    handleAddressKeydown,
    importExternalOrder,
    loadCustomerIntoManualOrder,
    logWaste,
    login,
    logout,
    markDeliveryCashCollected,
    markOrderPaid,
    markOrderServed,
    markWaiterPickup,
    markSupplierOrderOrdered,
    markTicketDelayed,
    moveScheduleWeek,
    notifyStaffShift,
    openQrCustomerUrl,
    openOrderReceiptPdf,
    printOrderReceipt,
    promptAndRecordProcedureStatus,
    queueReceiptPrinterTest,
    receiveSupplierOrder,
    recordProcedureCompletion,
    recordProduction,
    recordWaste,
    regenerateQrCode,
    removeCustomerCartItem,
    resumeWebsitePayment,
    removeOrderDraftLine,
    removeSellableRecipeLine,
    render,
    renderInventoryActionForm,
    renderManualOrderControls,
    renderOrderBuilder,
    renderProcedureFormControls,
    renderProductionRecipeFields,
    renderProductsInSelects,
    refreshWebsiteReservationAvailability,
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
    setCustomerUpsellStep,
    setProcedureStepProgress,
    setView,
    setWebsiteFulfillment,
    showOrderReceipt,
    showToast,
    startNewCustomerOrder,
    startDeliveryTrip,
    startShiftBreak,
    submitCustomerQrOrder,
    submitWebsiteReservation,
    submitWebsiteOrder,
    tableById,
    pushExternalOrderStatus,
    pushMenuToExternalPlatform,
    toggleExternalProductMapping,
    togglePurchasedProduct,
    toggleQrCode,
    toggleSellableProduct,
    updateDeliveryStatus,
    updateIngredientPurchasePrice,
    updateReservationStatus,
    updateProductionCostPreview,
    updateTicketStatus,
    uploadDeliveryProof,
    endShiftBreak
  } = handlers;
  const runAsyncAction = (action: () => unknown, failureMessage: string) => {
    return Promise.resolve()
      .then(action)
      .catch((error) => {
        console.error(failureMessage, error);
        showToast(failureMessage);
      });
  };
  let customerUpsellReturnProductId = "";

  const focusCustomerUpsellDialog = () => {
    window.requestAnimationFrame(() => {
      const dialog: any = document.querySelector(".customer-upsell-flow-card[role='dialog']");
      dialog?.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
    });
  };

  const closeCustomerUpsellAndRestoreFocus = () => {
    const productId = customerUpsellReturnProductId;
    customerUpsellReturnProductId = "";
    closeCustomerUpsell();
    if (!productId) return;
    window.requestAnimationFrame(() => {
      const card: any = document.querySelector(`[data-customer-product-card="${CSS.escape(productId)}"]`);
      card?.querySelector("[data-customer-add]")?.focus({ preventScroll: true });
    });
  };

  document.addEventListener("keydown", (event: any) => {
    handleAddressKeydown(event);
    const dialog: any = document.querySelector(".customer-upsell-flow-card[role='dialog']");
    if (!dialog) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeCustomerUpsellAndRestoreFocus();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialog.querySelectorAll(
      "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter((element: any) => element.getClientRects().length > 0) as any[];
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  const handleAddressSuggestionPress = (event: any) => {
    const addressSuggestion = event.target.closest("[data-address-suggestion]");
    if (!addressSuggestion) return;
    event.preventDefault();
    chooseAddressSuggestion(addressSuggestion);
  };

  document.addEventListener("pointerdown", handleAddressSuggestionPress);
  document.addEventListener("mousedown", handleAddressSuggestionPress);

  document.addEventListener("click", (event: any) => {
    const addressSuggestion = event.target.closest("[data-address-suggestion]");
    if (addressSuggestion) {
      event.preventDefault();
      chooseAddressSuggestion(addressSuggestion);
      return;
    }

    if (!event.target.closest("[data-address-combobox]")) closeAddressSuggestions();

    const sidebarToggle = event.target.closest("#sidebarToggle");
    if (sidebarToggle) {
      const collapsed = !document.body.classList.contains("is-sidebar-collapsed");
      try {
        localStorage.setItem("libabite-sidebar-collapsed", collapsed ? "true" : "false");
      } catch {
        // Ignore storage failures; the visual state can still update for this render.
      }
      document.body.classList.toggle("is-sidebar-collapsed", collapsed);
      render();
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

    const editSupplier = event.target.closest("[data-edit-supplier]");
    if (editSupplier) selectSupplierForEdit(editSupplier.dataset.editSupplier);

    const clearSupplier = event.target.closest("[data-clear-supplier-form]");
    if (clearSupplier) clearSupplierForm();

    const supplierApprove = event.target.closest("[data-supplier-approve]");
    if (supplierApprove) approveSupplierOrder(supplierApprove.dataset.supplierApprove);

    const supplierSend = event.target.closest("[data-supplier-send]");
    if (supplierSend) sendSupplierOrder(supplierSend.dataset.supplierSend);
  
    const supplierOrdered = event.target.closest("[data-supplier-ordered]");
    if (supplierOrdered) markSupplierOrderOrdered(supplierOrdered.dataset.supplierOrdered);
  
    const supplierReceived = event.target.closest("[data-supplier-received]");
    if (supplierReceived) receiveSupplierOrder(supplierReceived.dataset.supplierReceived);

    const externalMenuPush = event.target.closest("[data-external-menu-push]");
    if (externalMenuPush) pushMenuToExternalPlatform(externalMenuPush.dataset.externalMenuPush);

    const externalMappingToggle = event.target.closest("[data-toggle-external-mapping]");
    if (externalMappingToggle) toggleExternalProductMapping(externalMappingToggle.dataset.toggleExternalMapping);

    const externalStatusPush = event.target.closest("[data-external-push-status]");
    if (externalStatusPush) pushExternalOrderStatus(externalStatusPush.dataset.externalPushStatus);
  
    const removeDraft = event.target.closest("[data-remove-draft-index]");
    if (removeDraft) removeOrderDraftLine(removeDraft.dataset.removeDraftIndex);

    const sendKitchen = event.target.closest("[data-send-kitchen]");
    if (sendKitchen) sendOrderToKitchen(sendKitchen.dataset.sendKitchen);

    const markServed = event.target.closest("[data-mark-served]");
    if (markServed) markOrderServed(markServed.dataset.markServed);

    const waiterPickup = event.target.closest("[data-waiter-pickup]");
    if (waiterPickup) markWaiterPickup(waiterPickup.dataset.waiterPickup);

    const markPaid = event.target.closest("[data-mark-paid]");
    if (markPaid) markOrderPaid(markPaid.dataset.markPaid, getSelectedPaymentMethodFromAction(markPaid));

    const assignDeliveryDriver = event.target.closest("[data-assign-delivery-driver]");
    if (assignDeliveryDriver) assignDeliveryOrderToDriver(assignDeliveryDriver.dataset.assignDeliveryDriver, assignDeliveryDriver);

    const deliveryStatus = event.target.closest("[data-delivery-status][data-delivery-order]");
    if (deliveryStatus) updateDeliveryStatus(deliveryStatus.dataset.deliveryOrder, deliveryStatus.dataset.deliveryStatus);

    const startTrip = event.target.closest("[data-start-delivery-trip]");
    if (startTrip) startDeliveryTrip(startTrip.dataset.startDeliveryTrip);

    const deliveryCash = event.target.closest("[data-delivery-cash]");
    if (deliveryCash) markDeliveryCashCollected(deliveryCash.dataset.deliveryCash);

    const deliveryNote = event.target.closest("[data-add-delivery-note]");
    if (deliveryNote) addDeliveryNote(deliveryNote.dataset.addDeliveryNote);

    const deliveryProof = event.target.closest("[data-upload-delivery-proof]");
    if (deliveryProof) uploadDeliveryProof(deliveryProof.dataset.uploadDeliveryProof);

    const scheduleWeek = event.target.closest("[data-schedule-week]");
    if (scheduleWeek) moveScheduleWeek(scheduleWeek.dataset.scheduleWeek);

    const editShift = event.target.closest("[data-edit-shift]");
    if (editShift) selectStaffShiftForEdit(editShift.dataset.editShift);

    const cancelShiftEdit = event.target.closest("[data-cancel-shift-edit]");
    if (cancelShiftEdit) cancelStaffShiftEdit();

    const notifyShift = event.target.closest("[data-notify-shift]");
    if (notifyShift) notifyStaffShift(notifyShift.dataset.notifyShift);

    const clockIn = event.target.closest("[data-clock-in-shift]");
    if (clockIn) clockInShift(clockIn.dataset.clockInShift);

    const clockOut = event.target.closest("[data-clock-out-shift]");
    if (clockOut) clockOutShift(clockOut.dataset.clockOutShift);

    const startBreak = event.target.closest("[data-start-break-shift]");
    if (startBreak) startShiftBreak(startBreak.dataset.startBreakShift);

    const endBreak = event.target.closest("[data-end-break-shift]");
    if (endBreak) endShiftBreak(endBreak.dataset.endBreakShift);

    const cancelButton = event.target.closest("[data-cancel-order]");
    if (cancelButton) cancelOrder(cancelButton.dataset.cancelOrder);

    const showReceipt = event.target.closest("[data-show-receipt]");
    if (showReceipt) showOrderReceipt(showReceipt.dataset.showReceipt);

    const printReceipt = event.target.closest("[data-print-receipt]");
    if (printReceipt) printOrderReceipt(printReceipt.dataset.printReceipt);

    const pdfReceipt = event.target.closest("[data-pdf-receipt]");
    if (pdfReceipt) openOrderReceiptPdf(pdfReceipt.dataset.pdfReceipt);
  
    const removeRecipeLine = event.target.closest("[data-remove-recipe-line]");
    if (removeRecipeLine) removeSellableRecipeLine(removeRecipeLine.dataset.removeRecipeLine);
  
    const toggleSellable = event.target.closest("[data-toggle-sellable]");
    if (toggleSellable) toggleSellableProduct(toggleSellable.dataset.toggleSellable);
  
    const togglePurchased = event.target.closest("[data-toggle-purchased]");
    if (togglePurchased) togglePurchasedProduct(togglePurchased.dataset.togglePurchased);

    const scanInventoryAction = event.target.closest("[data-scan-inventory-action]");
    if (scanInventoryAction) applyScannedInventoryAction(scanInventoryAction.dataset.scanInventoryAction);

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

    const reservationStatus = event.target.closest("[data-reservation-status][data-reservation-id]");
    if (reservationStatus) {
      runAsyncAction(
        () => updateReservationStatus(reservationStatus.dataset.reservationId, reservationStatus.dataset.reservationStatus),
        "Could not update the reservation."
      );
    }

    const editReservation = event.target.closest("[data-edit-reservation]");
    if (editReservation) selectReservationForEdit(editReservation.dataset.editReservation);

    const cancelReservation = event.target.closest("[data-cancel-reservation-edit]");
    if (cancelReservation) cancelReservationEdit();

    const reservationMapTable = event.target.closest("[data-reservation-map-table]");
    if (reservationMapTable) {
      if (reservationMapTable.disabled || reservationMapTable.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      const tableId = reservationMapTable.dataset.reservationMapTable;
      const reservationForm = reservationMapTable.closest("#reservationForm");
      const customerReservationForm = reservationMapTable.closest("#customerReservationForm");
      const tableControl: any = reservationForm?.querySelector("#reservationTable") || customerReservationForm?.querySelector("#customerReservationTable");
      if (tableControl) tableControl.value = tableId;

      const map = reservationMapTable.closest(".reservation-table-map");
      map?.querySelectorAll("[data-reservation-map-table]").forEach((button: any) => {
        const selected = button.dataset.reservationMapTable === tableId;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });

      if (customerReservationForm) refreshWebsiteReservationAvailability(customerReservationForm);
      else if (reservationForm) renderReservationPlanner();
      return;
    }

    const deleteReservationBlockButton = event.target.closest("[data-delete-reservation-block]");
    if (deleteReservationBlockButton) deleteReservationBlock(deleteReservationBlockButton.dataset.deleteReservationBlock);

    const deleteCapacityRuleButton = event.target.closest("[data-delete-capacity-rule]");
    if (deleteCapacityRuleButton) deleteReservationCapacityRule(deleteCapacityRuleButton.dataset.deleteCapacityRule);

    const customerAdd = event.target.closest("[data-customer-add]");
    if (customerAdd) {
      if (!customerAdd.closest(".customer-upsell-flow")) {
        customerUpsellReturnProductId = String(customerAdd.dataset.customerAdd || "");
      }
      addCustomerCartItem(customerAdd.dataset.customerAdd, {
        keepUpsellOpen: Boolean(customerAdd.closest(".customer-inline-upsell, .customer-upsell-flow"))
      });
      if (document.querySelector(".customer-upsell-flow-card[role='dialog']")) focusCustomerUpsellDialog();
    }

    const customerUpsellStep = event.target.closest("[data-customer-upsell-step]");
    if (customerUpsellStep) {
      setCustomerUpsellStep(customerUpsellStep.dataset.customerUpsellStep);
      focusCustomerUpsellDialog();
    }

    const customerUpsellClose = event.target.closest("[data-customer-upsell-close]");
    if (customerUpsellClose) closeCustomerUpsellAndRestoreFocus();

    const customerCartOpen = event.target.closest("[data-customer-cart-open]");
    if (customerCartOpen) setCustomerCartOpen(true);

    const customerCartClose = event.target.closest("[data-customer-cart-close]");
    if (customerCartClose) setCustomerCartOpen(false);

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

    const resumePayment = event.target.closest("[data-customer-resume-payment]");
    if (resumePayment) {
      resumePayment.disabled = true;
      void runAsyncAction(
        () => resumeWebsitePayment(resumePayment.dataset.customerResumePayment),
        "Could not restart secure payment."
      ).finally(() => {
        if (resumePayment.isConnected) resumePayment.disabled = false;
      });
    }
  });

  document.addEventListener("input", (event: any) => {
    const reservationScheduleField = event.target.closest("#customerReservationForm [name='date'], #customerReservationForm [name='time'], #customerReservationForm [name='guests']");
    if (reservationScheduleField) {
      refreshWebsiteReservationAvailability(reservationScheduleField.closest("#customerReservationForm"));
    }

    const addressInput = event.target.closest("[data-address-input]");
    if (addressInput) handleAddressInput(addressInput);
  });

  document.addEventListener("focusin", (event: any) => {
    const addressInput = event.target.closest("[data-address-input]");
    if (addressInput) handleAddressFocus(addressInput);
  });

  document.addEventListener("focusout", (event: any) => {
    const addressCombobox = event.target.closest("[data-address-combobox]");
    if (addressCombobox) handleAddressFocusOut(event.target);
  });
  
  document.addEventListener("change", (event: any) => {
    const reservationScheduleField = event.target.closest("#customerReservationForm [name='date'], #customerReservationForm [name='time'], #customerReservationForm [name='guests']");
    if (reservationScheduleField) {
      refreshWebsiteReservationAvailability(reservationScheduleField.closest("#customerReservationForm"));
      return;
    }

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

    const externalPlatformControl = event.target.closest("#externalPlatformType, #externalOrderPlatform");
    if (externalPlatformControl) {
      render();
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
    const scanForm = event.target.closest("[data-scan-form]");
    if (!scanForm) return;
    event.preventDefault();
    if (scanCode(new FormData(scanForm))) scanForm.reset();
  });

  document.addEventListener("submit", (event: any) => {
    const customerOrderForm = event.target.closest("#customerOrderForm");
    if (!customerOrderForm) return;
    event.preventDefault();
    if (getCustomerOrderingSession()?.mode === "website") {
      if (customerOrderForm.dataset.submitting === "true") return;
      customerOrderForm.dataset.submitting = "true";
      customerOrderForm.setAttribute("aria-busy", "true");
      const submitButton: any = customerOrderForm.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      const formData = new FormData(customerOrderForm);
      void runAsyncAction(
        () => submitWebsiteOrder(formData),
        "Could not start secure checkout."
      ).finally(() => {
        if (!customerOrderForm.isConnected) return;
        delete customerOrderForm.dataset.submitting;
        customerOrderForm.removeAttribute("aria-busy");
        if (submitButton) submitButton.disabled = false;
      });
    } else {
      submitCustomerQrOrder(new FormData(customerOrderForm));
    }
  });

  document.addEventListener("submit", (event: any) => {
    const customerReservationForm = event.target.closest("#customerReservationForm");
    if (!customerReservationForm) return;
    event.preventDefault();
    if (customerReservationForm.dataset.submitting === "true") return;
    customerReservationForm.dataset.submitting = "true";
    customerReservationForm.setAttribute("aria-busy", "true");
    const submitButton: any = customerReservationForm.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const formData = new FormData(customerReservationForm);
    void runAsyncAction(
      () => submitWebsiteReservation(formData),
      "Could not submit the reservation request."
    ).finally(() => {
      if (!customerReservationForm.isConnected) return;
      delete customerReservationForm.dataset.submitting;
      customerReservationForm.removeAttribute("aria-busy");
      refreshWebsiteReservationAvailability(customerReservationForm);
    });
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

  document.querySelector("#supplierForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveSupplierRecord(new FormData(event.currentTarget));
  });

  document.querySelector("#externalPlatformForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveExternalPlatformRecord(new FormData(event.currentTarget));
  });

  document.querySelector("#externalMappingForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveExternalProductMapping(new FormData(event.currentTarget));
  });

  document.querySelector("#externalOrderImportForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    importExternalOrder(new FormData(event.currentTarget));
  });

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
    runAsyncAction(
      () => addReservation(new FormData(event.currentTarget)),
      "Could not save the reservation."
    );
  });
  document.querySelector("#reservationForm").addEventListener("input", renderReservationPlanner);
  document.querySelector("#reservationForm").addEventListener("change", renderReservationPlanner);

  document.querySelector("#reservationBlockForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    addReservationBlock(new FormData(event.currentTarget));
  });

  document.querySelector("#reservationCapacityForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveReservationCapacityRule(new FormData(event.currentTarget));
  });

  document.addEventListener("change", (event: any) => {
    const stationSelect = event.target.closest("[data-station-select]");
    if (!stationSelect) return;
    state.activeStation = stationSelect.value;
    saveState();
    render();
  });
  
  document.querySelector("#staffUserForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    createStaffUser(new FormData(event.currentTarget));
  });

  document.querySelector("#shiftForm")?.addEventListener("submit", (event: any) => {
    event.preventDefault();
    createStaffShift(new FormData(event.currentTarget));
  });
  
  document.querySelector("#settingsForm").addEventListener("submit", (event: any) => {
    event.preventDefault();
    saveRestaurantSettings(new FormData(event.currentTarget));
  });

  document.querySelector("#testReceiptPrinterBtn")?.addEventListener("click", queueReceiptPrinterTest);

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
  
  document.querySelector("#resetDemoBtn").addEventListener("click", async () => {
    if (!can("canResetDemo")) return;
    const previousUserId = state.currentUserId;
    const nextState = resetState();
    if (nextState.users.some((user) => user.id === previousUserId)) nextState.currentUserId = previousUserId;
    nextState.reservations = [];
    nextState.reservationBlocks = [];
    nextState.reservationCapacityRules = [];
    nextState.websiteLastReservationId = "";
    nextState.reservationEditingId = "";
    saveState();
    await flushRemoteState();
    render();
    showToast("Demo data reset; bookings cleared.");
  });
  
  document.querySelector("#wasteKeftaBtn")?.addEventListener("click", logWaste);
  }

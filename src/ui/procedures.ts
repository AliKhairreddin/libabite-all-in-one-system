import { state } from "../app/state.js";
import {
  DEFAULT_RECIPE_ORDER_CONTEXT,
  LANGUAGE_OPTIONS,
  PROCEDURE_ASSIGNED_ROLES,
  PROCEDURE_COMPLETION_STATUSES,
  PROCEDURE_DEPARTMENTS,
  PROCEDURE_FREQUENCIES
} from "../shared/constants.js";
import {
  procedureAssignedToUser as procedureAssignedToUserByRole,
  procedureFrequencyWindowMs,
  procedureStatusClass
} from "../domain/procedures.js";
import { formatDateTime } from "../shared/dates.js";
import { escapeHtml } from "../shared/html.js";
import { slugify } from "../shared/ids.js";

export function createProceduresUi(deps) {
  const document: any = window.document;
  const {
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
  } = deps;

  function procedureById(id) {
    return state.procedures.find((procedure) => procedure.id === id);
  }
  
  function languageLabel(languageId) {
    return LANGUAGE_OPTIONS.find((language) => language.id === languageId)?.label || "Language";
  }
  
  function getProcedureCompletions(procedureId, statuses = PROCEDURE_COMPLETION_STATUSES) {
    return state.procedureCompletions
      .filter((completion) => completion.procedureId === procedureId && statuses.includes(completion.status))
      .slice()
      .sort((first, second) => (second.completedAtMs || 0) - (first.completedAtMs || 0));
  }
  
  function latestProcedureCompletion(procedure, statuses = PROCEDURE_COMPLETION_STATUSES) {
    return getProcedureCompletions(procedure.id, statuses)[0] || null;
  }
  
  function procedurePeriodStatus(procedure) {
    const cutoff = Date.now() - procedureFrequencyWindowMs(procedure.frequency);
    const recentDone = getProcedureCompletions(procedure.id, ["Done"]).find((completion) => completion.completedAtMs >= cutoff);
    if (recentDone) {
      return {
        status: "Completed",
        label: "Completed",
        className: "ok",
        detail: `${recentDone.completedByName} at ${formatDateTime(recentDone.completedAtMs, recentDone.completedAt)}`
      };
    }
  
    const recentIssue = getProcedureCompletions(procedure.id, ["Problem", "Skipped"]).find((completion) => completion.completedAtMs >= cutoff);
    if (recentIssue) {
      return {
        status: recentIssue.status,
        label: recentIssue.status,
        className: procedureStatusClass(recentIssue.status),
        detail: `${recentIssue.completedByName}: ${recentIssue.notes || "No note"}`
      };
    }
  
    return {
      status: "Missed",
      label: "Due now",
      className: "warning",
      detail: `${procedure.frequency} procedure has no completion in the current window.`
    };
  }
  
  function isSameLocalDay(timestamp) {
    return new Date(timestamp).toDateString() === new Date().toDateString();
  }
  
  function procedureAssignedToUser(procedure, user = currentUser()) {
    return procedureAssignedToUserByRole(procedure, user, {
      canReviewProcedures: can("canReviewProcedures"),
      roleDefinition
    });
  }
  
  function getCurrentUserProcedures() {
    const user = currentUser();
    return state.procedures
      .filter((procedure) => procedure.active && procedureAssignedToUser(procedure, user))
      .sort((first, second) => {
        const firstStatus = procedurePeriodStatus(first);
        const secondStatus = procedurePeriodStatus(second);
        const firstRank = firstStatus.status === "Completed" ? 1 : 0;
        const secondRank = secondStatus.status === "Completed" ? 1 : 0;
        return firstRank - secondRank || first.department.localeCompare(second.department) || first.title.localeCompare(second.title);
      });
  }
  
  function procedureProgressKey(procedureId, userId = currentUser()?.id || "") {
    return `${userId}:${procedureId}`;
  }
  
  function getProcedureStepProgress(procedureId, userId = currentUser()?.id || "") {
    const key = procedureProgressKey(procedureId, userId);
    return new Set(state.procedureProgress?.[key] || []);
  }
  
  function procedureStepsComplete(procedure, userId = currentUser()?.id || "") {
    if (!procedure.steps.length) return true;
    const checkedSteps = getProcedureStepProgress(procedure.id, userId);
    return procedure.steps.every((_, index) => checkedSteps.has(index));
  }
  
  function listText(items, fallback = "None") {
    return items?.length ? items.join(", ") : fallback;
  }
  
  function procedureRequirementHtml(label, items) {
    return `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(listText(items))}</strong>
      </div>
    `;
  }
  
  function procedureMediaHtml(media) {
    if (!media?.length) return "";
    return `
      <div class="procedure-media">
        ${media.map((url, index) => `
          <a class="mini-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Media ${index + 1}</a>
        `).join("")}
      </div>
    `;
  }
  
  function procedureSummaryCards(procedures) {
    const due = procedures.filter((procedure) => procedurePeriodStatus(procedure).status !== "Completed").length;
    const completedToday = state.procedureCompletions.filter((completion) => completion.status === "Done" && isSameLocalDay(completion.completedAtMs)).length;
    const issuesToday = state.procedureCompletions.filter((completion) => completion.status !== "Done" && isSameLocalDay(completion.completedAtMs)).length;
    const languages = new Set(procedures.map((procedure) => procedure.language)).size;
    return [
      { label: "Assigned", value: procedures.length, note: "Visible to this role", className: "info" },
      { label: "Due", value: due, note: "Needs staff action", className: due ? "warning" : "ok" },
      { label: "Completed today", value: completedToday, note: "All roles", className: "ok" },
      { label: "Issues today", value: issuesToday, note: "Problems and skips", className: issuesToday ? "danger" : "info" },
      { label: "Languages", value: languages, note: "Arabic, Dutch, Turkish, English supported", className: "info" }
    ].map((card) => `
      <article class="procedure-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  }
  
  function procedureCard(procedure) {
    const periodStatus = procedurePeriodStatus(procedure);
    const checkedSteps = getProcedureStepProgress(procedure.id);
    const canComplete = can("canCompleteProcedures") && procedureAssignedToUser(procedure);
    const doneDisabled = !canComplete || !procedureStepsComplete(procedure);
    const latestCompletion = latestProcedureCompletion(procedure);
    const progressText = `${checkedSteps.size}/${procedure.steps.length} steps checked`;
  
    return `
      <article class="procedure-card procedure-sop-card status-${escapeHtml(slugify(periodStatus.status))}">
        <header>
          <div>
            <span class="procedure-kicker">${escapeHtml(procedure.department)} · ${escapeHtml(languageLabel(procedure.language))}</span>
            <strong>${escapeHtml(procedure.title)}</strong>
            <p>${escapeHtml(procedure.frequency)} · Assigned to ${escapeHtml(procedure.assignedRole)} · ${escapeHtml(progressText)}</p>
          </div>
          <span class="pill ${escapeHtml(periodStatus.className)}">${escapeHtml(periodStatus.label)}</span>
        </header>
        <div class="procedure-step-list">
          ${procedure.steps.map((step, index) => `
            <label class="procedure-step">
              <input
                type="checkbox"
                ${checkedSteps.has(index) ? "checked" : ""}
                ${canComplete ? "" : "disabled"}
                data-procedure-step="${escapeHtml(procedure.id)}"
                data-step-index="${index}"
              >
              <span>${escapeHtml(step)}</span>
            </label>
          `).join("")}
        </div>
        <div class="procedure-detail-grid">
          ${procedureRequirementHtml("Tools", procedure.requiredTools)}
          ${procedureRequirementHtml("Products", procedure.requiredProducts)}
        </div>
        ${procedureMediaHtml(procedure.media)}
        ${latestCompletion ? `
          <p class="procedure-last-run">Last activity: ${escapeHtml(latestCompletion.status)} by ${escapeHtml(latestCompletion.completedByName)} at ${escapeHtml(formatDateTime(latestCompletion.completedAtMs, latestCompletion.completedAt))}</p>
        ` : `<p class="procedure-last-run">${escapeHtml(periodStatus.detail)}</p>`}
        <div class="mini-actions procedure-actions">
          <button class="mini-btn" type="button" ${doneDisabled ? "disabled" : ""} data-procedure-done="${escapeHtml(procedure.id)}">Done</button>
          <button class="mini-btn danger-action" type="button" ${canComplete ? "" : "disabled"} data-procedure-problem="${escapeHtml(procedure.id)}">Problem</button>
          <button class="mini-btn" type="button" ${canComplete ? "" : "disabled"} data-procedure-skip="${escapeHtml(procedure.id)}">Skip with reason</button>
        </div>
      </article>
    `;
  }
  
  function procedureHistoryCard(completion) {
    const procedure = procedureById(completion.procedureId);
    const stepCount = procedure?.steps?.length || 0;
    const checkedCount = completion.checkedSteps?.length || 0;
    return `
      <article class="log-card procedure-history-card">
        <div class="card-title">
          <strong>${escapeHtml(procedure?.title || "Procedure")}</strong>
          <span class="pill ${escapeHtml(procedureStatusClass(completion.status))}">${escapeHtml(completion.status)}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(completion.completedByName)}</span>
          <span>${escapeHtml(completion.assignedRole)}</span>
          <span>${escapeHtml(formatDateTime(completion.completedAtMs, completion.completedAt))}</span>
          <span>${checkedCount}/${stepCount} steps</span>
        </div>
        ${completion.notes ? `<p>${escapeHtml(completion.notes)}</p>` : ""}
      </article>
    `;
  }
  
  function productionBatchCard(batch) {
    const product = productById(batch.productId);
    const outputIngredient = ingredientById(batch.outputIngredientId);
    const costDeltaClass = batch.costDelta > 0 ? "warning" : batch.costDelta < 0 ? "ok" : "info";
    const marginClass = batch.marginDelta === null ? "info" : batch.marginDelta < -0.1 ? "danger" : batch.marginDelta < 0 ? "warning" : "ok";
    const marginText = batch.actualMargin === null
      ? (batch.outputUnitCost ? `${money(batch.outputUnitCost)} / ${outputIngredient?.unit || unitTypeDefinition(batch.outputUnitType).shortLabel}` : "No margin")
      : `${batch.actualMargin.toFixed(1)}% (${formatSignedAmount(batch.marginDelta, " pts")})`;
    return `
      <article class="log-card production-batch-card">
        <div class="card-title">
          <strong>${escapeHtml(batch.productName || product?.name || "Batch")}</strong>
          <span class="pill ${escapeHtml(batch.outputIngredientId ? "ok" : "info")}">${escapeHtml(batch.outputIngredientId ? "Prepared stock" : "Assembly")}</span>
        </div>
        <div class="recipe-cost-grid">
          <span>Actual cost</span><strong>${escapeHtml(money(batch.actualCost))}</strong>
          <span>Variance</span><strong><span class="inline-status ${escapeHtml(costDeltaClass)}">${escapeHtml(money(batch.costDelta))}</span></strong>
          <span>${batch.actualMargin === null ? "Unit cost" : "Margin impact"}</span><strong><span class="inline-status ${escapeHtml(marginClass)}">${escapeHtml(marginText)}</span></strong>
          ${outputIngredient ? `<span>Added to inventory</span><strong>${escapeHtml(formatStockAmount(batch.outputStockQuantity, outputIngredient.unit))} ${escapeHtml(outputIngredient.name)}</strong>` : ""}
        </div>
        <div class="production-usage-list">
          ${batch.lines.map((line) => `
            <div class="production-usage-row">
              <span>${escapeHtml(line.ingredientName || ingredientById(line.ingredientId)?.name || "Ingredient")}</span>
              <strong>${escapeHtml(formatActualUsageLabel(line.actualUsage, line.measure))} · ${escapeHtml(money(line.actualCost))}</strong>
            </div>
          `).join("")}
        </div>
        <p><strong>${escapeHtml(batch.completedAt)}</strong> ${escapeHtml(batch.completedByName)} saved this batch.</p>
      </article>
    `;
  }
  
  function missedProcedureCard(procedure) {
    const status = procedurePeriodStatus(procedure);
    const latestCompletion = latestProcedureCompletion(procedure);
    return `
      <article class="alert-card warning">
        <div class="card-title">
          <strong>${escapeHtml(procedure.title)}</strong>
          <span class="pill ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
        </div>
        <p>${escapeHtml(procedure.department)} · ${escapeHtml(procedure.frequency)} · Assigned to ${escapeHtml(procedure.assignedRole)}</p>
        <p>${escapeHtml(latestCompletion ? `Last activity ${latestCompletion.status} by ${latestCompletion.completedByName}` : "No completion recorded yet.")}</p>
      </article>
    `;
  }
  
  function renderProcedureFormControls() {
    const form = document.querySelector("#procedureForm");
    if (!form) return;
  
    const departmentSelect = document.querySelector("#procedureDepartment");
    const languageSelect = document.querySelector("#procedureLanguage");
    const frequencySelect = document.querySelector("#procedureFrequency");
    const assignedRoleSelect = document.querySelector("#procedureAssignedRole");
    const editable = can("canCreateProcedures");
  
    if (departmentSelect) {
      const selected = departmentSelect.value || "Front of house";
      departmentSelect.innerHTML = PROCEDURE_DEPARTMENTS
        .map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`)
        .join("");
      departmentSelect.value = PROCEDURE_DEPARTMENTS.includes(selected) ? selected : "Front of house";
    }
  
    if (languageSelect) {
      const selected = languageSelect.value || state.restaurantSettings.defaultLanguage;
      languageSelect.innerHTML = LANGUAGE_OPTIONS
        .map((language) => `<option value="${escapeHtml(language.id)}">${escapeHtml(language.label)}</option>`)
        .join("");
      languageSelect.value = LANGUAGE_OPTIONS.some((language) => language.id === selected) ? selected : state.restaurantSettings.defaultLanguage;
    }
  
    if (frequencySelect) {
      const selected = frequencySelect.value || "Daily";
      frequencySelect.innerHTML = PROCEDURE_FREQUENCIES
        .map((frequency) => `<option value="${escapeHtml(frequency)}">${escapeHtml(frequency)}</option>`)
        .join("");
      frequencySelect.value = PROCEDURE_FREQUENCIES.includes(selected) ? selected : "Daily";
    }
  
    if (assignedRoleSelect) {
      const selected = assignedRoleSelect.value || "Front";
      assignedRoleSelect.innerHTML = PROCEDURE_ASSIGNED_ROLES
        .map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`)
        .join("");
      assignedRoleSelect.value = PROCEDURE_ASSIGNED_ROLES.includes(selected) ? selected : "Front";
    }
  
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !editable;
    });
  }
  
  function renderProcedureManagerView() {
    const managerPanel = document.querySelector("#procedureManagerPanel");
    const managerSummary = document.querySelector("#procedureManagerSummary");
    const missedList = document.querySelector("#missedProcedureList");
    const history = document.querySelector("#procedureHistory");
    if (!managerPanel || !managerSummary || !missedList || !history) return;
  
    const canReview = can("canReviewProcedures");
    managerPanel.hidden = !canReview;
    if (!canReview) return;
  
    const completed = state.procedureCompletions.filter((completion) => completion.status === "Done");
    const issues = state.procedureCompletions.filter((completion) => completion.status !== "Done");
    const missed = state.procedures.filter((procedure) => procedure.active && procedurePeriodStatus(procedure).status !== "Completed");
  
    managerSummary.innerHTML = [
      { label: "Completed", value: completed.length, note: "All completion records", className: "ok" },
      { label: "Missed", value: missed.length, note: "No completion in current window", className: missed.length ? "warning" : "ok" },
      { label: "Notes/issues", value: issues.length, note: "Problems and skips", className: issues.length ? "danger" : "info" }
    ].map((card) => `
      <article class="procedure-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  
    missedList.innerHTML = missed.length
      ? missed.map(missedProcedureCard).join("")
      : emptyState("No missed procedures in the current window.");
  
    history.innerHTML = state.procedureCompletions.length
      ? state.procedureCompletions
        .slice()
        .sort((first, second) => (second.completedAtMs || 0) - (first.completedAtMs || 0))
        .slice(0, 30)
        .map(procedureHistoryCard)
        .join("")
      : emptyState("No procedure completion history yet.");
  }
  
  function renderProcedures() {
    document.querySelectorAll(".admin-procedure-only").forEach((panel) => {
      panel.hidden = !can("canCreateProcedures");
    });
    document.querySelectorAll(".manager-procedure-only").forEach((panel) => {
      panel.hidden = !can("canReviewProcedures");
    });
  
    renderProcedureFormControls();
  
    const visibleProcedures = getCurrentUserProcedures();
    const summaryGrid = document.querySelector("#procedureSummaryGrid");
    if (summaryGrid) summaryGrid.innerHTML = procedureSummaryCards(visibleProcedures);
  
    const procedureList = document.querySelector("#procedureList");
    if (procedureList) {
      procedureList.innerHTML = visibleProcedures.length
        ? visibleProcedures.map(procedureCard).join("")
        : emptyState("No procedures are assigned to this role.");
    }
  
    renderProcedureManagerView();
  
    const productionPanel = document.querySelector("#procedureProductionPanel");
    if (productionPanel) productionPanel.hidden = !can("canManageProcedures");
  
    const batchCards = state.productionBatches
      .slice()
      .reverse()
      .map(productionBatchCard);
    const productionLogCards = state.productionLog.slice().reverse().map((log) => `
        <article class="log-card">
          <p><strong>${escapeHtml(log.time)}</strong> ${escapeHtml(log.text)}</p>
        </article>
      `);
    document.querySelector("#productionLog").innerHTML = batchCards.length || productionLogCards.length
      ? [...batchCards, ...productionLogCards].join("")
      : emptyState("No production changes yet.");
  
    document.querySelectorAll("#productionForm input, #productionForm select, #productionForm button").forEach((element) => {
      if (!can("canManageProcedures")) element.disabled = true;
    });
    updateProductionCostPreview();
  }
  
  function renderProductionRecipeFields(options: any = {}) {
    const form = document.querySelector("#productionForm");
    const container = document.querySelector("#productionRecipeFields");
    const stepList = document.querySelector("#productionStepList");
    const productionProduct = document.querySelector("#productionProduct");
    const outputIngredientSelect = document.querySelector("#productionOutputIngredient");
    const outputQuantityInput = document.querySelector("#productionOutputQuantity");
    const outputUnitSelect = document.querySelector("#productionOutputUnit");
    const outputLocationSelect = document.querySelector("#productionOutputLocation");
    const product = productionProduct ? productById(productionProduct.value) : null;
  
    if (!container) return;
  
    const previousActuals = new Map(
      [...container.querySelectorAll("input[name^='actual-']")]
        .map((input) => [input.name, input.value])
    );
    const previousStepChecks = new Set(
      [...(stepList?.querySelectorAll("[data-production-step]") || [])]
        .filter((input) => input.checked)
        .map((input) => input.dataset.productionStep)
    );
  
    container.innerHTML = product?.recipe?.length
      ? product.recipe.map((line, index) => {
        const ingredient = ingredientById(line.ingredientId);
        if (!ingredient) return "";
        const measure = getRecipeMeasure(line);
        const plannedUsage = Number((getRecipeLineQuantity(line) * getRecipeLineWasteMultiplier(line)).toFixed(3));
        const fieldName = getProductionFieldName(line, index);
        const actualValue = options.reset ? plannedUsage : previousActuals.get(fieldName) ?? plannedUsage;
        const plannedCost = getLineCost(line);
        return `
          <label class="production-ingredient-line">
            <span>
              <strong>${escapeHtml(ingredient.name)}</strong>
              <small>Required ${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} on hand · planned ${escapeHtml(money(plannedCost))}</small>
            </span>
            <input
              name="${escapeHtml(fieldName)}"
              type="number"
              min="0"
              step="${measure.step}"
              value="${escapeHtml(actualValue)}"
              aria-label="Actual ${escapeHtml(ingredient.name)} used"
            >
          </label>
        `;
      }).join("")
      : emptyState("No recipe lines are attached to this product.");
  
    if (stepList) {
      stepList.innerHTML = product?.recipe?.length
        ? product.recipe.map((line, index) => {
          const ingredient = ingredientById(line.ingredientId);
          const note = String(line.notes || "").trim();
          const stepText = note || `Prepare ${getRecipeUsageLabel(line)} ${ingredient?.name || "ingredient"}.`;
          return `
            <label class="procedure-step production-step">
              <input type="checkbox" data-production-step="${index}" ${!options.reset && previousStepChecks.has(String(index)) ? "checked" : ""}>
              <span>${escapeHtml(stepText)}</span>
            </label>
          `;
        }).join("")
        : emptyState("No preparation steps are attached to this recipe.");
    }
  
    if (outputIngredientSelect && outputQuantityInput && outputUnitSelect && outputLocationSelect) {
      const outputDefault = getProductionOutputDefault(product);
      const selectedOutputIngredient = options.reset
        ? outputDefault.ingredientId || ""
        : outputIngredientSelect.value || outputDefault.ingredientId || "";
      outputIngredientSelect.innerHTML = [
        `<option value="">No inventory output</option>`,
        ...state.ingredients
          .filter((ingredient) => ingredient.active)
          .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
      ].join("");
      outputIngredientSelect.value = ingredientById(selectedOutputIngredient) ? selectedOutputIngredient : "";
  
      const outputIngredient = ingredientById(outputIngredientSelect.value);
      const outputQuantity = options.reset
        ? outputDefault.quantity || ""
        : outputQuantityInput.value || outputDefault.quantity || "";
      outputQuantityInput.value = outputQuantity;
      outputQuantityInput.disabled = !outputIngredient || !can("canManageProcedures");
  
      if (outputIngredient) {
        const allowedUnits = getWasteUnitOptionsForIngredient(outputIngredient);
        const selectedUnit = getProductionOutputUnitType(outputIngredient, options.reset ? outputDefault.unitType : outputUnitSelect.value, outputDefault.unitType);
        outputUnitSelect.innerHTML = allowedUnits
          .map((unit) => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.label)}</option>`)
          .join("");
        outputUnitSelect.value = selectedUnit;
      } else {
        outputUnitSelect.innerHTML = `<option value="">No output</option>`;
        outputUnitSelect.value = "";
      }
      outputUnitSelect.disabled = !outputIngredient || !can("canManageProcedures");
  
      const locations = getAllInventoryLocations();
      const selectedLocation = options.reset
        ? outputDefault.location || outputIngredient?.location || "Fridge"
        : outputLocationSelect.value || outputDefault.location || outputIngredient?.location || "Fridge";
      outputLocationSelect.innerHTML = locations
        .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`)
        .join("");
      outputLocationSelect.value = locations.includes(selectedLocation) ? selectedLocation : locations[0] || "Dry storage";
      outputLocationSelect.disabled = !outputIngredient || !can("canManageProcedures");
    }
  
    document.querySelectorAll("#productionForm input, #productionForm select").forEach((element) => {
      if (!can("canManageProcedures")) element.disabled = true;
    });
  
    updateProductionCostPreview();
  }
  
  function updateProductionCostPreview() {
    const form = document.querySelector("#productionForm");
    const preview = document.querySelector("#productionCostPreview");
    const submitButton = document.querySelector("#saveProductionBatchBtn");
    if (!form || !preview) return;
  
    const draft = getProductionExecutionDraft(form);
    const readiness = getProductionReadiness(draft, form);
    const costDeltaClass = draft.costDelta > 0 ? "warning" : draft.costDelta < 0 ? "ok" : "info";
    const marginClass = draft.marginDelta === null ? "info" : draft.marginDelta < -0.1 ? "danger" : draft.marginDelta < 0 ? "warning" : "ok";
  
    preview.innerHTML = draft.product ? `
      <div class="cost-preview-title">
        <strong>Batch result preview</strong>
        <span class="pill ${escapeHtml(readiness.className)}">${escapeHtml(readiness.label)}</span>
      </div>
      <div class="cost-grid">
        <span>Planned cost</span><strong>${escapeHtml(money(draft.plannedCost))}</strong>
        <span>Actual cost</span><strong>${escapeHtml(money(draft.actualCost))}</strong>
        <span>Cost variance</span><strong><span class="inline-status ${escapeHtml(costDeltaClass)}">${escapeHtml(money(draft.costDelta))}</span></strong>
        ${draft.actualMargin === null ? `
          <span>Batch unit cost</span><strong>${draft.outputIngredient ? `${escapeHtml(money(draft.outputUnitCost))} / ${escapeHtml(draft.outputIngredient.unit)}` : "Output not set"}</strong>
        ` : `
          <span>Actual margin</span><strong><span class="inline-status ${escapeHtml(marginClass)}">${draft.actualMargin.toFixed(1)}%</span></strong>
        `}
        ${draft.outputIngredient ? `
          <span>Prepared output</span><strong>${escapeHtml(formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit))}</strong>
        ` : ""}
      </div>
      <div class="production-usage-list">
        ${draft.lines.map((line) => {
          const lineClass = line.shortage > 0 ? "danger" : line.actualCost > line.plannedCost ? "warning" : "ok";
          return `
            <div class="production-usage-row ${lineClass}">
              <span>${escapeHtml(line.ingredient.name)}</span>
              <strong>${escapeHtml(formatActualUsageLabel(line.actualUsage, line.measure))} · ${escapeHtml(money(line.actualCost))}</strong>
            </div>
          `;
        }).join("")}
      </div>
      <p class="production-preview-note">${escapeHtml(readiness.detail)}</p>
    ` : emptyState("Select a recipe before saving a batch result.");
  
    if (submitButton) submitButton.disabled = !can("canManageProcedures") || !readiness.ok;
  }
  
  return {
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
  };
}

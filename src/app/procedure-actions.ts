import { PROCEDURE_COMPLETION_STATUSES } from "../shared/constants.js";
import {
  normalizeListInput,
  normalizeProcedureAssignedRole,
  normalizeProcedureDepartment,
  normalizeProcedureFrequency,
  normalizeProcedureLanguage,
  normalizeProcedureMedia,
  normalizeProcedureSteps
} from "../data/normalize.js";
import { timeNow } from "../shared/dates.js";
import { uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";

export function createProcedureActionsRuntime(deps) {
  const {
    can,
    currentUser,
    getProcedureStepProgress,
    procedureAssignedToUser,
    procedureById,
    procedureStepsComplete,
    render,
    roleDefinition,
    showToast
  } = deps;

  function createProcedure(formData) {
    if (!can("canCreateProcedures")) {
      showToast("Only Owner/Admin can create procedures.");
      return false;
    }

    const title = String(formData.get("title") || "").trim();
    const department = normalizeProcedureDepartment(formData.get("department"));
    const language = normalizeProcedureLanguage(formData.get("language"));
    const frequency = normalizeProcedureFrequency(formData.get("frequency"));
    const assignedRole = normalizeProcedureAssignedRole(formData.get("assignedRole"), department);
    const steps = normalizeProcedureSteps(String(formData.get("steps") || "").split(/\n/));
    const requiredTools = normalizeListInput(formData.get("requiredTools"));
    const requiredProducts = normalizeListInput(formData.get("requiredProducts"));
    const media = normalizeProcedureMedia(formData.get("media"));
    const user = currentUser();

    if (!title || !steps.length) {
      showToast("Add a procedure title and at least one step.");
      return false;
    }

    state.procedures.push({
      id: uniqueRecordId(title, [state.procedures]),
      title,
      department,
      language,
      steps,
      requiredTools,
      requiredProducts,
      media,
      frequency,
      assignedRole,
      active: true,
      createdById: user?.id || "",
      createdByName: user?.name || "",
      createdAtMs: Date.now()
    });

    saveState();
    render();
    showToast(`${title} procedure created.`);
    return true;
  }

  function procedureProgressKey(procedureId, userId = currentUser()?.id || "") {
    return `${userId}:${procedureId}`;
  }

  function setProcedureStepProgress(procedureId, stepIndex, checked) {
    const procedure = procedureById(procedureId);
    if (!procedure || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
      showToast("This role cannot update that procedure.");
      return;
    }

    const index = Math.floor(Number(stepIndex) || 0);
    if (index < 0 || index >= procedure.steps.length) return;

    state.procedureProgress = state.procedureProgress || {};
    const key = procedureProgressKey(procedure.id);
    const progress = getProcedureStepProgress(procedure.id);
    if (checked) progress.add(index);
    else progress.delete(index);

    const nextProgress = [...progress].map(Number).sort((first, second) => first - second);
    if (nextProgress.length) state.procedureProgress[key] = nextProgress;
    else delete state.procedureProgress[key];

    saveState();
    render();
  }

  function recordProcedureCompletion(procedureId, status = "Done", notes = "") {
    const procedure = procedureById(procedureId);
    const user = currentUser();
    if (!procedure || !user || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
      showToast("This role cannot complete that procedure.");
      return false;
    }

    const normalizedStatus = PROCEDURE_COMPLETION_STATUSES.includes(status) ? status : "Done";
    const normalizedNotes = String(notes || "").trim();
    if (normalizedStatus === "Done" && !procedureStepsComplete(procedure)) {
      showToast("Check each step before marking the procedure done.");
      return false;
    }
    if (normalizedStatus !== "Done" && !normalizedNotes) {
      showToast("Add a reason before saving this procedure status.");
      return false;
    }

    const checkedSteps = [...getProcedureStepProgress(procedure.id)].map(Number).sort((first, second) => first - second);
    const roleInfo = roleDefinition(user.role);
    state.procedureCompletions.push({
      id: `PROC-CMP-${Date.now()}-${state.procedureCompletions.length + 1}`,
      procedureId: procedure.id,
      status: normalizedStatus,
      completedById: user.id,
      completedByName: user.name,
      assignedRole: normalizeProcedureAssignedRole(procedure.assignedRole, roleInfo.operationalRole),
      completedAtMs: Date.now(),
      completedAt: timeNow(),
      checkedSteps,
      notes: normalizedNotes
    });
    state.procedureCompletions = state.procedureCompletions.slice(-180);
    delete state.procedureProgress?.[procedureProgressKey(procedure.id)];

    saveState();
    render();
    showToast(`${procedure.title} marked ${normalizedStatus.toLowerCase()}.`);
    return true;
  }

  function promptAndRecordProcedureStatus(procedureId, status) {
    const procedure = procedureById(procedureId);
    if (!procedure) return;
    const promptText = status === "Problem"
      ? `What problem happened with ${procedure.title}?`
      : `Why are you skipping ${procedure.title}?`;
    const note = window.prompt(promptText, "");
    if (note === null) return;
    recordProcedureCompletion(procedureId, status, note);
  }

  return {
    createProcedure,
    promptAndRecordProcedureStatus,
    recordProcedureCompletion,
    setProcedureStepProgress
  };
}

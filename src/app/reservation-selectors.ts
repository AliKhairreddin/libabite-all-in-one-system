import { state } from "./state.js";
import {
  getApplicableCapacityRules as getApplicableCapacityRulesFromList,
  getAvailableReservationTable as getAvailableReservationTableFromList,
  getReservationBlockConflicts as getReservationBlockConflictsFromList,
  getReservationCapacityIssue as getReservationCapacityIssueFromList,
  getReservationConflicts as getReservationConflictsFromList,
  getReservationIssues as getReservationIssuesFromList,
  getReservationRequestValidation as getReservationRequestValidationFromList,
  getReservationSeatingRecommendation as getReservationSeatingRecommendationFromList,
  getReservationValidation as getReservationValidationFromList
} from "../domain/reservations.js";
import { RESERVATION_TURNOVER_MINUTES } from "../shared/constants.js";

export function getReservationConflicts(candidate, reservations = state.reservations) {
  return getReservationConflictsFromList(candidate, reservations);
}

export function getAvailableReservationTable(candidate, tables = state.tables, reservations = state.reservations) {
  return getAvailableReservationTableFromList(candidate, tables, reservations);
}

export function getReservationSeatingRecommendation(candidate, tables = state.tables, reservations = state.reservations) {
  return getReservationSeatingRecommendationFromList(candidate, tables, reservations);
}

export function getReservationIssues(reservation) {
  return getReservationIssuesFromList(
    reservation,
    state.tables,
    state.reservations,
    RESERVATION_TURNOVER_MINUTES,
    state.reservationBlocks,
    state.reservationCapacityRules
  );
}

export function getReservationValidation(candidate) {
  return getReservationValidationFromList(
    candidate,
    state.tables,
    state.reservations,
    RESERVATION_TURNOVER_MINUTES,
    state.reservationBlocks,
    state.reservationCapacityRules
  );
}

export function getReservationRequestValidation(candidate) {
  return getReservationRequestValidationFromList(
    candidate,
    state.tables,
    state.reservations,
    state.reservationBlocks,
    state.reservationCapacityRules,
    RESERVATION_TURNOVER_MINUTES,
    state.restaurantSettings
  );
}

export function getReservationBlockConflicts(candidate) {
  return getReservationBlockConflictsFromList(candidate, state.reservationBlocks);
}

export function getReservationCapacityIssue(candidate) {
  return getReservationCapacityIssueFromList(candidate, state.reservations, state.reservationCapacityRules);
}

export function getApplicableCapacityRules(candidate) {
  return getApplicableCapacityRulesFromList(candidate, state.reservationCapacityRules);
}

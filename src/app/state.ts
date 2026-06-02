import { STORAGE_KEY } from "../shared/constants.js";
import { getFreshSeedState } from "../data/seed.js";
import { normalizeState } from "../data/normalize.js";
import { loadStoredState, saveStoredState } from "../data/storage.js";

export let state = loadStoredState(STORAGE_KEY, getFreshSeedState, normalizeState);

let remoteStateSaver: ((nextState: any) => void) | null = null;

export function registerRemoteStateSaver(saver: ((nextState: any) => void) | null) {
  remoteStateSaver = saver;
}

export function saveState(options: { syncRemote?: boolean } = {}) {
  state = normalizeState(state);
  saveStoredState(STORAGE_KEY, state);
  if (options.syncRemote === false) return;
  remoteStateSaver?.(state);
}

export function replaceState(nextState) {
  state = normalizeState(nextState);
  saveState({ syncRemote: false });
  return state;
}

export function resetState() {
  state = normalizeState(getFreshSeedState());
  return state;
}

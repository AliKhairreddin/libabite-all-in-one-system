import { STORAGE_KEY } from "../shared/constants.js";
import { getFreshSeedState } from "../data/seed.js";
import { normalizeState } from "../data/normalize.js";
import { loadStoredState, saveStoredState } from "../data/storage.js";
export let state = loadStoredState(STORAGE_KEY, getFreshSeedState, normalizeState);
export function saveState() {
    saveStoredState(STORAGE_KEY, state);
}
export function resetState() {
    state = normalizeState(getFreshSeedState());
    return state;
}
//# sourceMappingURL=state.js.map
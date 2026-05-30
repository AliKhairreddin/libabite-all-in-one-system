export function loadStoredState(storageKey, createDefaultState, normalizeState) {
  try {
    const stored = localStorage.getItem(storageKey);
    return normalizeState(stored ? JSON.parse(stored) : createDefaultState());
  } catch {
    return normalizeState(createDefaultState());
  }
}

export function saveStoredState(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The demo still runs in browser contexts where storage is disabled.
  }
}

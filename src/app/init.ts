import { createAppRuntime } from "./runtime.js";
import { bindAppEvents } from "./events.js";
import { createConvexStateSync } from "./convex-sync.js";
import { currentUser } from "./permissions.js";
import { registerRemoteStateFlusher, registerRemoteStateSaver, replaceState, state } from "./state.js";

export function initApp(): void {
  const runtime = createAppRuntime();
  const convexSync = createConvexStateSync({
    getState: () => state,
    replaceState,
    getActorId: () => currentUser()?.id || "",
    onRemoteApplied: () => runtime.render()
  });

  registerRemoteStateSaver((nextState) => convexSync.queueSave(nextState));
  registerRemoteStateFlusher(() => convexSync.flushNow());
  convexSync.start();
  document.querySelector("#convexSyncStatus")?.addEventListener("click", () => {
    void convexSync.refreshNow();
  });
  bindAppEvents(runtime.handlers);
  runtime.render();
  void runtime.handleWebsitePaymentReturn();
  window.setInterval(runtime.renderTimingSurfaces, 30 * 1000);
}

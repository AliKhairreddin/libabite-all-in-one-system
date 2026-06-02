import { createAppRuntime } from "./runtime.js";
import { bindAppEvents } from "./events.js";
export function initApp() {
    const runtime = createAppRuntime();
    bindAppEvents(runtime.handlers);
    runtime.render();
    window.setInterval(runtime.renderTimingSurfaces, 30 * 1000);
}
//# sourceMappingURL=init.js.map
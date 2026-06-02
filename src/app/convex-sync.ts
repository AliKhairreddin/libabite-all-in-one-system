import { anyApi } from "convex/server";
import {
  closeSharedConvexClient,
  getConvexStateKey,
  getSharedConvexClient,
  isConvexEnabled
} from "./convex-client.js";

type SyncState = "disabled" | "connecting" | "ready" | "syncing" | "error";

export interface ConvexSyncStatus {
  state: SyncState;
  label: string;
  detail: string;
  version: number;
  updatedAt: number;
  error?: string;
}

interface ConvexStateSyncOptions {
  getState: () => any;
  replaceState: (nextState: any) => void;
  getActorId?: () => string;
  onRemoteApplied?: () => void;
}

const CLIENT_ID_STORAGE_KEY = "libabite-convex-client-id";
const SAVE_DEBOUNCE_MS = 450;
const LOCAL_ONLY_STATE_KEYS = new Set([
  "currentUserId",
  "activeView",
  "activeScan",
  "activeStation",
  "orderFilter",
  "scheduleWeekStart",
  "orderDraft",
  "receiptOrderId",
  "customerCart",
  "customerLastOrderId",
  "websiteCart",
  "websiteLastOrderId",
  "websiteLastReservationId",
  "websiteFulfillment",
  "reservationEditingId",
  "supplierFormSupplierId",
  "productRecipeDraft",
  "procedureProgress"
]);

function createClientId() {
  try {
    const stored = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (stored) return stored;
    const nextId = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function toConvexValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toConvexValue(item));
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, toConvexValue(entryValue)])
  );
}

function createSharedStateSnapshot(state: any) {
  if (!state || typeof state !== "object") return {};
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => !LOCAL_ONLY_STATE_KEYS.has(key))
  );
}

function mergeRemoteSharedState(remoteState: any, localState: any) {
  const localOnlyEntries = Object.fromEntries(
    Object.entries(localState || {}).filter(([key]) => LOCAL_ONLY_STATE_KEYS.has(key))
  );
  return {
    ...(remoteState && typeof remoteState === "object" ? remoteState : {}),
    ...localOnlyEntries
  };
}

function stableJson(value: any) {
  return JSON.stringify(value);
}

function statusDetail(status: ConvexSyncStatus) {
  const version = status.version ? `Version ${status.version}. ` : "";
  return `${version}${status.detail}${status.error ? ` ${status.error}` : ""}`.trim();
}

export function renderConvexSyncStatus(status: ConvexSyncStatus) {
  const element = document.querySelector("#convexSyncStatus");
  if (!element) return;

  element.className = `sync-status is-${status.state}`;
  element.textContent = status.label;
  element.setAttribute("title", statusDetail(status));
}

export function createConvexStateSync(options: ConvexStateSyncOptions) {
  const stateKey = getConvexStateKey();
  const enabled = isConvexEnabled();
  const clientId = createClientId();
  const listeners = new Set<(status: ConvexSyncStatus) => void>();
  let client = getSharedConvexClient();
  let unsubscribeState: (() => void) | null = null;
  let unsubscribeConnection: (() => void) | null = null;
  let knownRemoteVersion = 0;
  let pendingState: any = null;
  let saveTimer: number | null = null;
  let flushPromise: Promise<void> | null = null;
  let bootstrapping = false;
  let lastQueuedSnapshotJson = "";
  let status: ConvexSyncStatus = {
    state: enabled ? "connecting" : "disabled",
    label: enabled ? "Convex connecting" : "Local data",
    detail: enabled
      ? "Waiting for the Convex deployment to return the first snapshot."
      : "Set VITE_CONVEX_URL to enable Convex sync.",
    version: 0,
    updatedAt: Date.now()
  };

  function emit(nextStatus: Partial<ConvexSyncStatus>) {
    status = {
      ...status,
      ...nextStatus,
      updatedAt: Date.now()
    };
    renderConvexSyncStatus(status);
    listeners.forEach((listener) => listener(status));
  }

  function actorId() {
    return options.getActorId?.() || "";
  }

  function mutationMetadata() {
    const userId = actorId();
    return {
      ...(userId ? { updatedBy: userId } : {}),
      clientId
    };
  }

  async function bootstrapRemoteState() {
    if (!client || bootstrapping) return;
    bootstrapping = true;
    emit({
      state: "syncing",
      label: "Convex seeding",
      detail: "Creating the first Convex state snapshot from local data."
    });

    try {
      const initialSnapshot = toConvexValue(createSharedStateSnapshot(options.getState()));
      lastQueuedSnapshotJson = stableJson(initialSnapshot);
      const result: any = await client.mutation(anyApi.appState.bootstrap as any, {
        key: stateKey,
        state: initialSnapshot,
        ...mutationMetadata()
      });
      knownRemoteVersion = Number(result?.version) || knownRemoteVersion || 1;
      emit({
        state: "ready",
        label: "Convex synced",
        detail: "The local app state is connected to Convex.",
        version: knownRemoteVersion,
        error: undefined
      });
    } catch (error) {
      emit({
        state: "error",
        label: "Convex error",
        detail: "Could not create the initial Convex snapshot.",
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      bootstrapping = false;
    }
  }

  function applyRemoteDocument(document: any) {
    if (document === undefined) return;
    if (!document) {
      void bootstrapRemoteState();
      return;
    }

    const remoteVersion = Number(document.version) || 0;
    if (remoteVersion < knownRemoteVersion) return;
    knownRemoteVersion = remoteVersion;

    if (document.clientId !== clientId && (pendingState || flushPromise || saveTimer)) {
      emit({
        state: "syncing",
        label: "Convex merging",
        detail: "Remote data changed while local edits are queued; local changes will be saved next.",
        version: knownRemoteVersion
      });
      return;
    }

    if (document.clientId !== clientId) {
      options.replaceState(mergeRemoteSharedState(document.state, options.getState()));
      options.onRemoteApplied?.();
    }
    lastQueuedSnapshotJson = stableJson(toConvexValue(createSharedStateSnapshot(document.state)));

    emit({
      state: "ready",
      label: "Convex synced",
      detail: "The local app state is connected to Convex.",
      version: knownRemoteVersion,
      error: undefined
    });
  }

  async function flush() {
    if (!enabled || !client) return;
    if (flushPromise) {
      await flushPromise;
      return;
    }
    if (!pendingState) return;

    flushPromise = (async () => {
      while (pendingState) {
        const stateToSave = pendingState;
        pendingState = null;
        emit({
          state: "syncing",
          label: "Convex saving",
          detail: "Saving the latest local snapshot to Convex.",
          version: knownRemoteVersion
        });

        try {
          const result: any = await client!.mutation(anyApi.appState.saveSnapshot as any, {
            key: stateKey,
            state: stateToSave,
            ...(knownRemoteVersion ? { expectedVersion: knownRemoteVersion } : {}),
            ...mutationMetadata()
          });
          knownRemoteVersion = Number(result?.version) || knownRemoteVersion;
          emit({
            state: "ready",
            label: "Convex synced",
            detail: "The latest local changes are saved in Convex.",
            version: knownRemoteVersion,
            error: undefined
          });
        } catch (error) {
          pendingState = stateToSave;
          emit({
            state: "error",
            label: "Convex error",
            detail: "Local data is still saved in the browser. Convex will retry on the next change.",
            error: error instanceof Error ? error.message : String(error)
          });
          break;
        }
      }
    })();

    await flushPromise;
    flushPromise = null;
  }

  function queueSave(nextState: any) {
    if (!enabled) return;
    const sharedSnapshot = toConvexValue(createSharedStateSnapshot(nextState));
    const snapshotJson = stableJson(sharedSnapshot);
    if (snapshotJson === lastQueuedSnapshotJson && !pendingState) return;
    lastQueuedSnapshotJson = snapshotJson;
    pendingState = sharedSnapshot;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }

  async function flushNow(nextState = options.getState()) {
    if (!enabled) return;
    queueSave(nextState);
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    await flush();
  }

  function start() {
    renderConvexSyncStatus(status);
    if (!enabled) return;

    try {
      client = getSharedConvexClient();
      if (!client) return;
      unsubscribeConnection = client.subscribeToConnectionState((connectionState) => {
        if (connectionState.isWebSocketConnected) {
          emit({
            state: flushPromise || pendingState ? "syncing" : "ready",
            label: flushPromise || pendingState ? "Convex syncing" : "Convex connected",
            detail: "The browser has an active Convex connection.",
            version: knownRemoteVersion
          });
          return;
        }

        emit({
          state: "connecting",
          label: connectionState.hasEverConnected ? "Convex reconnecting" : "Convex connecting",
          detail: "Waiting for the Convex WebSocket connection.",
          version: knownRemoteVersion
        });
      });

      unsubscribeState = client.onUpdate(
        anyApi.appState.get as any,
        { key: stateKey },
        applyRemoteDocument,
        (error) => {
          emit({
            state: "error",
            label: "Convex error",
            detail: "Could not load the Convex app-state snapshot.",
            error: error.message
          });
        }
      );
    } catch (error) {
      emit({
        state: "error",
        label: "Convex error",
        detail: "Could not initialize the Convex client.",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function stop() {
    if (saveTimer) window.clearTimeout(saveTimer);
    unsubscribeState?.();
    unsubscribeConnection?.();
    void closeSharedConvexClient();
  }

  function subscribe(listener: (status: ConvexSyncStatus) => void) {
    listeners.add(listener);
    listener(status);
    return () => listeners.delete(listener);
  }

  return {
    getStatus: () => status,
    flushNow,
    queueSave,
    start,
    stop,
    subscribe
  };
}

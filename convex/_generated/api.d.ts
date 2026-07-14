/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appState from "../appState.js";
import type * as communications from "../communications.js";
import type * as communicationsWorker from "../communicationsWorker.js";
import type * as http from "../http.js";
import type * as mailchimpAdapters from "../mailchimpAdapters.js";
import type * as operationalSync from "../operationalSync.js";
import type * as paymentWebhooks from "../paymentWebhooks.js";
import type * as payments from "../payments.js";
import type * as receiptPrintJobs from "../receiptPrintJobs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appState: typeof appState;
  communications: typeof communications;
  communicationsWorker: typeof communicationsWorker;
  http: typeof http;
  mailchimpAdapters: typeof mailchimpAdapters;
  operationalSync: typeof operationalSync;
  paymentWebhooks: typeof paymentWebhooks;
  payments: typeof payments;
  receiptPrintJobs: typeof receiptPrintJobs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

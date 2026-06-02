import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  appStates: defineTable({
    key: v.string(),
    state: v.any(),
    version: v.number(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
    clientId: v.optional(v.string())
  }).index("by_key", ["key"]),

  syncEvents: defineTable({
    appStateKey: v.string(),
    type: v.string(),
    payload: v.any(),
    at: v.number(),
    actorId: v.optional(v.string()),
    clientId: v.optional(v.string())
  })
    .index("by_app_state", ["appStateKey", "at"])
    .index("by_type", ["type", "at"]),

  integrationConfigs: defineTable({
    key: v.string(),
    name: v.string(),
    provider: v.string(),
    status: v.string(),
    config: v.any(),
    updatedAt: v.number()
  })
    .index("by_key", ["key"])
    .index("by_provider", ["provider"])
});

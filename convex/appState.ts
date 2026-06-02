import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { mirrorOperationalTables } from "./operationalSync";

const appStateArgs = {
  key: v.string()
};

async function getAppStateDocument(ctx: any, key: string) {
  return await ctx.db
    .query("appStates")
    .withIndex("by_key", (query: any) => query.eq("key", key))
    .first();
}

function optionalMetadata(args: { updatedBy?: string; clientId?: string }) {
  return {
    ...(args.updatedBy ? { updatedBy: args.updatedBy } : {}),
    ...(args.clientId ? { clientId: args.clientId } : {})
  };
}

function optionalEventMetadata(args: { actorId?: string; clientId?: string }) {
  return {
    ...(args.actorId ? { actorId: args.actorId } : {}),
    ...(args.clientId ? { clientId: args.clientId } : {})
  };
}

export const get = queryGeneric({
  args: appStateArgs,
  handler: async (ctx, args) => {
    return await getAppStateDocument(ctx, args.key);
  }
});

export const bootstrap = mutationGeneric({
  args: {
    ...appStateArgs,
    state: v.any(),
    updatedBy: v.optional(v.string()),
    clientId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await getAppStateDocument(ctx, args.key);
    if (existing) {
      return {
        status: "exists",
        version: existing.version,
        updatedAt: existing.updatedAt
      };
    }

    const now = Date.now();
    const id = await ctx.db.insert("appStates", {
      key: args.key,
      state: args.state,
      version: 1,
      updatedAt: now,
      ...optionalMetadata(args)
    });

    await ctx.db.insert("syncEvents", {
      appStateKey: args.key,
      type: "bootstrap",
      payload: { version: 1 },
      at: now,
      ...optionalEventMetadata({ actorId: args.updatedBy, clientId: args.clientId })
    });
    await mirrorOperationalTables(ctx, args.key, args.state, now);

    return { status: "created", id, version: 1, updatedAt: now };
  }
});

export const saveSnapshot = mutationGeneric({
  args: {
    ...appStateArgs,
    state: v.any(),
    expectedVersion: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
    clientId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await getAppStateDocument(ctx, args.key);
    const now = Date.now();

    if (!existing) {
      const id = await ctx.db.insert("appStates", {
        key: args.key,
        state: args.state,
        version: 1,
        updatedAt: now,
        ...optionalMetadata(args)
      });

      await ctx.db.insert("syncEvents", {
        appStateKey: args.key,
        type: "snapshot:create",
        payload: { version: 1 },
        at: now,
        ...optionalEventMetadata({ actorId: args.updatedBy, clientId: args.clientId })
      });
      await mirrorOperationalTables(ctx, args.key, args.state, now);

      return { status: "created", id, version: 1, updatedAt: now };
    }

    const nextVersion = existing.version + 1;
    await ctx.db.patch(existing._id, {
      state: args.state,
      version: nextVersion,
      updatedAt: now,
      ...optionalMetadata(args)
    });

    await ctx.db.insert("syncEvents", {
      appStateKey: args.key,
      type: "snapshot:update",
      payload: {
        previousVersion: existing.version,
        expectedVersion: args.expectedVersion ?? null,
        version: nextVersion
      },
      at: now,
      ...optionalEventMetadata({ actorId: args.updatedBy, clientId: args.clientId })
    });
    await mirrorOperationalTables(ctx, args.key, args.state, now);

    return { status: "updated", version: nextVersion, updatedAt: now };
  }
});

export const logEvent = mutationGeneric({
  args: {
    appStateKey: v.string(),
    type: v.string(),
    payload: v.any(),
    actorId: v.optional(v.string()),
    clientId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("syncEvents", {
      appStateKey: args.appStateKey,
      type: args.type,
      payload: args.payload,
      at: Date.now(),
      ...optionalEventMetadata(args)
    });
  }
});

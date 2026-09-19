import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  correlationId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantContextStore = {
  run<T>(context: TenantContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  get(): TenantContext | undefined {
    return storage.getStore();
  },

  getOrThrow(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error("TenantContext accessed outside of a request scope");
    }
    return ctx;
  },
};

import { AsyncLocalStorage } from "node:async_hooks";

export interface TankRuntimeBindings {
  ASSETS?: Fetcher;
  DB?: D1Database;
  IMAGES?: unknown;
  [key: string]: unknown;
}

const runtimeStorage = new AsyncLocalStorage<TankRuntimeBindings>();

export function runWithRuntimeBindings<T>(
  bindings: TankRuntimeBindings,
  work: () => T,
): T {
  return runtimeStorage.run(bindings, work);
}

export function currentRuntimeBindings(): TankRuntimeBindings {
  const bindings = runtimeStorage.getStore();
  if (!bindings) {
    throw new Error("TankAI wurde außerhalb eines gültigen Request-Kontexts aufgerufen.");
  }
  return bindings;
}

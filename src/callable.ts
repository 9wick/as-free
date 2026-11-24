import type { Result } from "./result.ts";

export type CallError =
  | { readonly kind: "not-callable" }
  | { readonly kind: "call-failed"; readonly cause: unknown };

export const callUnknown = (
  target: unknown,
  args: readonly unknown[],
  receiver?: unknown,
): Result<unknown, CallError> => {
  if (typeof target !== "function") {
    return { ok: false, error: { kind: "not-callable" } };
  }

  try {
    const value: unknown = Reflect.apply(target, receiver, args);
    return { ok: true, value };
  } catch (cause) {
    return { ok: false, error: { kind: "call-failed", cause } };
  }
};

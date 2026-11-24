export type Constructor = abstract new (...args: never[]) => object;

export const isConstructor = (value: unknown): value is Constructor => {
  if (typeof value !== "function") return false;

  // The proxy only receives [[Construct]] if its target has it, and the trap never calls the target.
  const probe = new Proxy(value, { construct: () => ({}) });
  try {
    Reflect.construct(probe, []);
    return true;
  } catch (cause) {
    if (!(cause instanceof TypeError)) throw cause;
    return false;
  }
};

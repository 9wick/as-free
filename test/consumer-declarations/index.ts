import { mapValues } from "as-free";

// Exported generic functions make the declaration emit write out as-free's internal types in place.
export const callTwice = <S extends Record<string, () => () => unknown>>(source: S) =>
  mapValues(source, (get) => get()());
export const callOnce = <S extends Record<string, () => unknown>>(source: S) => mapValues(source, (get) => get());
export const readField = <S extends Record<string, { readonly run: () => unknown }>>(source: S) =>
  mapValues(source, (item) => item.run());

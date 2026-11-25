import type { Key } from "./from-entries.ts";

// Only keys present in both types, and for tuples only real positions ("0" | "1" ...).
// A `number` index would let one callback result stand for every position.
type SharedKey<In, Out> = Exclude<keyof In & keyof Out, keyof (readonly unknown[])>;

type ValueMapper<In, Out> = <K extends SharedKey<In, Out>>(value: In[K], key: K) => Out[K];

export type MapValues<In, Out> = { readonly [K in keyof In]: Out[K & keyof Out] };

export function mapValues<In extends readonly unknown[], Out>(source: In, mapper: ValueMapper<In, Out>): MapValues<In, Out>;
export function mapValues<In, Out>(source: In & object, mapper: ValueMapper<In, Out>): MapValues<In, Out>;
// The caller's compiler checks the mapper for every key K, so the value stored under K is an Out[K].
// The loops below store each result under the key it was computed from.
export function mapValues(source: object, mapper: (value: unknown, key: Key) => unknown): unknown {
  if (Array.isArray(source)) {
    const values: unknown[] = [];
    for (let index = 0; index < source.length; index++) values.push(mapper(source[index], String(index)));
    return Object.freeze(values);
  }
  // Spread defines which keys a record value has for TypeScript: own enumerable strings and symbols.
  const record: { readonly [key: Key]: unknown } = { ...source };
  return Object.freeze(Object.fromEntries(Reflect.ownKeys(record).map((key) => [key, mapper(record[key], key)])));
}

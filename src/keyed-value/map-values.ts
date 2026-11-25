import type { Key } from "./from-entries.ts";

// Only real positions ("0" | "1" ...). A `number` index would let one mapper result stand for every position.
type Position<In> = Exclude<keyof In, keyof (readonly unknown[])>;

export type MapValues<In, Out> = { readonly [K in keyof In]: Out[K & keyof Out] };

// Every overload is sound on its own. The first of each pair keeps one result type per key and applies when the
// caller's compiler can check the mapper for every key K separately. `Out` defaults to `never` so that a mapper the
// compiler cannot follow per key fails here and falls through to the second, which gives every key the same type.
export function mapValues<In extends readonly unknown[], Out = never>(
  source: In,
  mapper: <K extends Position<In> & keyof Out>(value: In[K], key: K) => Out[K],
): MapValues<In, Out>;
export function mapValues<In extends readonly unknown[], Result>(
  source: In,
  mapper: (value: In[number], key: Position<In>) => Result,
): { readonly [K in keyof In]: Result };
export function mapValues<In, Out = never>(
  source: In & object,
  mapper: <K extends keyof In & keyof Out>(value: In[K], key: K) => Out[K],
): MapValues<In, Out>;
export function mapValues<In, Result>(
  source: In & object,
  mapper: (value: In[keyof In], key: keyof In) => Result,
): { readonly [K in keyof In]: Result };
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

import type { Key } from "./from-entries.ts";

// Only real positions ("0" | "1" ...). A `number` index would let one mapper result stand for every position.
type Position<In> = Exclude<keyof In, keyof (readonly unknown[])>;
type KeyOf<In> = In extends readonly unknown[] ? Position<In> : keyof In;
type ValueOf<In> = In extends readonly unknown[] ? In[number] : In[keyof In];

declare const origin: unique symbol;
declare const called: unique symbol;
type Called = typeof called;
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// Marks a value as "the item of call Scope, followed along Path". It exists only in types.
// Scope is invariant, so a value traced in one call is never accepted as a value traced in another.
type Traced<Scope, Path> = { readonly [origin]: readonly [(scope: Scope) => Scope, Path] };

type Primitive = string | number | bigint | boolean | symbol;
type Missing = null | undefined;

// The last signature of a function. A function with overloads does not fit it, because the declared result
// follows the last overload, which a call may not select.
type LastCall<Fn> = Fn extends (...args: infer Args) => infer Result ? (...args: Args) => Result : never;
type FirstCall<Fn> = Fn extends { (...args: infer Args): infer Result; (...args: never): unknown }
  ? (...args: Args) => Result
  : never;
type SingleCall<Fn> = Same<FirstCall<Fn>, LastCall<Fn>> extends true ? LastCall<Fn> : never;

// The item as the mapper sees it. It behaves as the union of all values, and every property read or call on it
// keeps a record of the path taken, so the result can be looked up again per key.
type Trace<Value, Scope, Path extends readonly unknown[]> =
  | Extract<Value, Missing>
  | (Extract<Value, Primitive> & Traced<Scope, Path>)
  | TraceObject<Exclude<Value, Primitive | Missing>, Scope, Path>;

type TraceObject<Value, Scope, Path extends readonly unknown[]> = [Value] extends [never]
  ? never
  : [Value] extends [SingleCall<Value>]
    ? [Value] extends [(...args: infer Args) => infer Result]
      ? ((...args: Args) => Trace<Result, Scope, [...Path, Called]>) & Traced<Scope, Path>
      : never
    : { readonly [Field in keyof Value]: Trace<Value[Field], Scope, [...Path, Field]> } & Traced<Scope, Path> & Value;

type Follow<Value, Path> = Path extends readonly [infer Step, ...infer Rest]
  ? Step extends Called
    ? Value extends (...args: never) => infer Result
      ? Follow<Result, Rest>
      : never
    : Value extends null | undefined
      ? Value
      : Step extends keyof Value
        ? Follow<Value[Step], Rest>
        : never
  : Value;

// Rebuilds the mapper's result for one key: a value traced by this call becomes the value found along its path.
// Every part is rebuilt, so no traced type survives in the result.
type Settle<Result, Scope, Value> =
  Result extends Traced<infer Slot, infer Path>
    ? Same<Slot, Scope> extends true
      ? Follow<Value, Path>
      : Result
    : Same<Result, Date> extends true
      ? Result
      : Result extends Promise<infer Inner>
        ? Promise<Settle<Inner, Scope, Value>>
        : Result extends (...args: infer Args) => infer Returned
          ? (...args: { [Index in keyof Args]: Settle<Args[Index], Scope, Value> }) => Settle<Returned, Scope, Value>
          : Result extends object
            ? { readonly [Field in keyof Result]: Settle<Result[Field], Scope, Value> }
            : Result;

// The same walk as Settle, leaving only a small mark at each place. `Own` is false for a value traced by
// another call, and cannot be decided while that call is still running.
type Marks<Result, Scope, Own> =
  Result extends Traced<infer Slot, unknown>
    ? Own extends true
      ? Same<Slot, Scope>
      : true
    : Result extends Promise<infer Inner>
      ? readonly [Marks<Inner, Scope, Own>]
      : Result extends (...args: infer Args) => infer Returned
        ? readonly [{ [Index in keyof Args]: Marks<Args[Index], Scope, Own> }, Marks<Returned, Scope, Own>]
        : Result extends object
          ? { readonly [Field in keyof Result]: Marks<Result[Field], Scope, Own> }
          : true;

type Mapper<In> = <K extends KeyOf<In>>(value: Trace<ValueOf<In>, K, []>, key: K) => unknown;
// The key parameter is given the full key union, so K is read back as that union whether or not the mapper uses it.
type Returned<Fn, Keys> = Fn extends (value: never, key: Keys) => infer Result ? Result : never;

// A value traced by an outer mapValues cannot be told apart once both calls are finished, so returning one from
// an inner mapper is rejected here, while the two are still different.
type Proof<Result, Scope> = [Marks<Result, Scope, false>] extends [Marks<Result, Scope, true>]
  ? []
  : ["mapValues cannot return a value that an outer mapValues passed to its mapper"];

// The result is looked up per key along the path the mapper took from the item.
export function mapValues<const In extends object, Fn extends Mapper<In>>(
  source: In,
  mapper: Fn,
  ...proof: Proof<Returned<Fn, KeyOf<In>>, KeyOf<In>>
): { readonly [K in keyof In]: Settle<Returned<Fn, KeyOf<In>>, KeyOf<In>, In[K]> };
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

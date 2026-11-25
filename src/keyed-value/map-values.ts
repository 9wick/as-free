import type { Key } from "./from-entries.ts";

// How the result type is found.
// The mapper sees each value as a lens: it behaves as the value, and every property read, call or await on it
// records the path taken. The mapper's result type then carries those paths, and for each key the same path is
// followed on that key's own value type. The lens exists only in types; at runtime the mapper gets the value.
declare const origin: unique symbol;
declare const site: unique symbol;
declare const sealed: unique symbol;
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Primitive = string | number | bigint | boolean | symbol;
type Missing = null | undefined;

// Op is a type parameter of the mapper. While the mapper is checked it is unknown-to-be, so a type that depends
// on it shows only what both outcomes share. Once the call is typed it is not Sealed, and the other outcome appears.
// Op is a type parameter of the mapper. While the mapper is checked nothing is known about it, so a type that
// depends on it shows only what both outcomes share. Once the call is typed it is not Sealed.
type Sealed = { readonly [sealed]: true };
// Member is the type the value had for the mapper. A key whose own value is of another type did not take this path.
type Traced<Scope, Path, Member> = { readonly [origin]: readonly [(scope: Scope) => Scope, Path, Member] };
type Brand<Scope, Path, Member, Op> = Traced<Scope, Path, Member> & { readonly [site]?: Op };

// One step of a path. Owner is the type the mapper held when it took the step: a key whose own value is of
// another type did not take this path. Fallback is the result as the mapper saw it, used where the key's own
// type cannot say more (an overloaded function, or a property the type does not list).
type Prop<Key, Owner, Fallback> = { readonly prop: Key; readonly owner: Owner; readonly fallback: Fallback };
type Call<Owner, Fallback> = { readonly call: Owner; readonly fallback: Fallback };
type Wait<Owner> = { readonly wait: Owner };
type Then = { readonly then: true };

// A function is followed through a call only when its last signature alone can stand for the whole function.
// With overloads the declared result is that of the last one, which a call may not select.
type IsSingleCall<Fn> = Fn extends (...args: infer Args) => infer Result
  ? [(...args: Args) => Result] extends [Fn]
    ? true
    : false
  : false;

type Lens<Value, Scope, Path extends readonly unknown[], Op> = Value extends unknown
  ? unknown extends Value
    ? Op extends Sealed
      ? unknown
      : Traced<Scope, Path, unknown> & PromiseLike<Traced<Scope, [...Path, Wait<unknown>], unknown>>
    : Value extends Missing
      ? Op extends Sealed
        ? Value
        : never
      : Value extends Primitive
        ? Value & Brand<Scope, Path, Value, Op>
        : Value extends PromiseLike<infer Inner>
          ? PromiseLike<Lens<Inner, Scope, [...Path, Wait<Value>], Op>> & Brand<Scope, [...Path, Then], Value, Op>
          : Value extends (...args: infer Args) => infer Result
            ? IsSingleCall<Value> extends true
              ? ((...args: Args) => Lens<Result, Scope, [...Path, Call<Value, Result>], Op>) &
                  Brand<Scope, Path, Value, Op>
              : Value & Brand<Scope, Path, Value, Op>
            : {
                readonly [Field in keyof Value]: Lens<
                  Value[Field],
                  Scope,
                  [...Path, Prop<Field, Value, Value[Field]>],
                  Op
                >;
              } & Brand<Scope, Path, Value, Op>
  : never;

type Follow<Value, Path> = Path extends readonly [infer Step, ...infer Rest]
  ? Step extends Prop<infer Key, infer Owner, infer Fallback>
    ? Value extends Owner
      ? Key extends keyof Value
        ? Follow<Value[Key], Rest>
        : Follow<Fallback, Rest>
      : never
    : Step extends Call<infer Owner, infer Fallback>
      ? Value extends Owner
        ? IsSingleCall<Value> extends true
          ? Value extends (...args: never) => infer Result
            ? Follow<Result, Rest>
            : never
          : Follow<Fallback, Rest>
        : never
      : Step extends Wait<infer Owner>
        ? Value extends Owner
          ? Follow<Awaited<Value>, Rest>
          : never
        : Follow<Value, Rest>
  : Value;
type Last<Path> = Path extends readonly [...unknown[], infer Step] ? Step : never;
// Keeps the part of the found value that can be what the mapper held. A missing value always can: its own
// trace leaves no mark. A promise the mapper took for a plain value may have been awaited or not; for a value
// of unknown type the await itself is recorded, so nothing is left open.
type Kept<Found, Path, Member> = Found extends Member | Missing
  ? unknown extends Member
    ? Found
    : Last<Path> extends Wait<unknown> | Then
      ? Found
      : Found extends PromiseLike<unknown>
        ? Found | Awaited<Found>
        : Found
  : never;

type Settle<Result, Scope, Value> =
  Result extends Traced<infer Slot, infer Path, infer Member>
    ? Same<Slot, Scope> extends true
      ? Kept<Follow<Value, Path>, Path, Member>
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

type Marks<Result, Scope, Own> =
  Result extends Traced<infer Slot, unknown, unknown>
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
type Proof<Result, Scope> = [Marks<Result, Scope, false>] extends [Marks<Result, Scope, true>]
  ? []
  : ["mapValues cannot return a value that an outer mapValues passed to its mapper"];

type Position<In> = Exclude<keyof In, keyof (readonly unknown[])>;
type KeyOf<In> = In extends readonly unknown[] ? Position<In> : keyof In;
type ValueOf<In> = In extends readonly unknown[] ? In[number] : In[keyof In];
// Shape is what the source is known to be: the source type itself, or inside a generic function its constraint.
type Known<Shape> = { readonly [Key in keyof Shape]: Shape[Key] };
type Mapper<Shape, Keys> = <K extends Keys, Op>(value: Lens<ValueOf<Shape>, K, [], Op>, key: K) => unknown;
type Returned<Fn, Shape, Keys> = Fn extends (value: Lens<ValueOf<Shape>, Keys, [], unknown>, key: Keys) => infer Result
  ? Result
  : never;
type Covered<In, Shape> = Shape extends readonly unknown[]
  ? true
  : string extends keyof Shape
    ? true
    : [Exclude<keyof In, keyof Shape>] extends [never]
      ? true
      : false;
type Checked<In, Shape, Result, Scope> =
  Covered<In, Shape> extends true ? Proof<Result, Scope> : ["mapValues needs every key of the source to be known"];

export function mapValues<const In extends object, Shape, Fn extends Mapper<Shape, KeyOf<In>>>(
  source: In & Known<Shape>,
  mapper: Fn,
  ...proof: Checked<In, Shape, Returned<Fn, Shape, KeyOf<In>>, KeyOf<In>>
): { readonly [K in keyof In]: Settle<Returned<Fn, Shape, KeyOf<In>>, KeyOf<In>, In[K]> };
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

import type { AnyFunction, FitsSlots, Intersect, OverloadArgs, OverloadResult } from "./overloads.ts";

declare const CALL: unique symbol;

// Id is a type parameter of the body, so each call gets its own. Invariance keeps a value from one call from
// passing for another, and the symbol is never created, so only this module can produce these types.
type CallMark<Id> = { readonly [CALL]: (id: Id) => Id };

export type CallArgs<Id, Args> = Readonly<Args> & CallMark<Id>;

export type Forwarded<Id> = CallMark<Id>;

export type Forward<Id, Parts extends readonly AnyFunction[]> = <Part extends Parts[number]>(
  to: Part,
  args: CallArgs<Id, OverloadArgs<Part>>,
) => Forwarded<Id>;

type Parts = readonly [AnyFunction, ...AnyFunction[]];

type ForwarderBody<P extends Parts> = <Id>(
  args: CallArgs<Id, OverloadArgs<P[number]>>,
  forward: Forward<Id, P>,
) => Forwarded<Id> | ([undefined] extends [OverloadResult<P[number]>] ? undefined : never);

type CheckedBody<P extends Parts> = false extends FitsSlots<P[number]> ? never : ForwarderBody<P>;

export const defineForwarder = <P extends Parts>(body: CheckedBody<P>): Intersect<P[number]> => {
  // The marks on args and on forward's result exist only in types; at run time the body receives the plain
  // argument list and gets back whatever the forwarded call returned.
  const run = body as unknown as (
    args: readonly unknown[],
    forward: (to: AnyFunction, args: readonly unknown[]) => unknown,
  ) => unknown;
  function forwarder(this: unknown, ...args: unknown[]): unknown {
    return run(args, (to, forwarded) => Reflect.apply(to, this, forwarded));
  }
  // The body can only return what forward returned for the received arguments, or undefined where every overload
  // allows it, so each call returns what the matching overload of the parts declares.
  return forwarder as Intersect<P[number]>;
};

type At<Args, Index> = Index extends keyof Args ? Args[Index] : undefined;

type Primitive = string | number | bigint | boolean | symbol | null | undefined;

type PairDisjoint<X, G> = [X & G] extends [never]
  ? true
  : [X] extends [Primitive]
    ? [G] extends [object]
      ? true
      : false
    : [X] extends [object]
      ? [G] extends [Primitive]
        ? true
        : false
      : false;

// Every member of X must be provably disjoint from every member of G. Anything unproven counts as overlapping,
// so an argument list stays on the matched side whenever the guard could accept its value.
type Disjoint<X, G> = false extends (X extends unknown ? (G extends unknown ? PairDisjoint<X, G> : never) : never)
  ? false
  : true;

type Matching<Args, Index, G> = Args extends unknown
  ? Disjoint<At<Args, Index>, G> extends true
    ? never
    : Args
  : never;

type NotMatching<Args, Index, G> = Args extends unknown ? ([At<Args, Index>] extends [G] ? never : Args) : never;

export type ArgMatch<Id, Args, Index, G> =
  | { readonly matched: true; readonly args: CallArgs<Id, Matching<Args, Index, G>> }
  | { readonly matched: false; readonly args: CallArgs<Id, NotMatching<Args, Index, G>> };

export const whenArg = <Id, Args extends readonly unknown[], Index extends number, G>(
  args: CallArgs<Id, Args>,
  index: Index,
  guard: (value: unknown) => value is G,
): ArgMatch<Id, Args, Index, G> => {
  const matched = guard(args[index]);
  // Each side keeps every argument list whose value at index could have produced this guard result.
  return { matched, args } as ArgMatch<Id, Args, Index, G>;
};

export type AnyFunction = (...args: never[]) => unknown;

type Overload = readonly [args: unknown, result: unknown];

// Inference against more call signatures than a type has fills the extra leading slots with copies of its first
// signature, and against fewer it keeps only the last ones. A first slot that repeats exactly is therefore the only
// sign that every overload was captured.
type Slots<F> = F extends {
  (...args: infer A1): infer R1;
  (...args: infer A2): infer R2;
  (...args: infer A3): infer R3;
  (...args: infer A4): infer R4;
  (...args: infer A5): infer R5;
}
  ? [[A1, R1], [A2, R2], [A3, R3], [A4, R4], [A5, R5]]
  : never;

type Same<X, Y> = (<V>() => V extends X ? 1 : 2) extends <V>() => V extends Y ? 1 : 2 ? true : false;

type RepeatsLater<S> = S extends [infer Head, ...infer Rest]
  ? true extends { [K in keyof Rest]: Same<Head, Rest[K]> }[number]
    ? true
    : false
  : false;

export type Overloads<F> = F extends unknown
  ? RepeatsLater<Slots<F>> extends true
    ? Extract<Slots<F>[number], Overload>
    : never
  : never;

export type FitsSlots<F> = F extends unknown ? ([Overloads<F>] extends [never] ? false : true) : never;

export type OverloadArgs<F> = Overloads<F>[0];

export type OverloadResult<F> = Overloads<F>[1];

export type Intersect<U> = (U extends unknown ? (member: U) => void : never) extends (member: infer I) => void
  ? I
  : never;

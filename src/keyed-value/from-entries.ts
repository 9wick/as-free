export type Key = string | symbol;
export type Flatten<T> = { [K in keyof T]: T[K] };

type IsUnion<T, All = T> = T extends All ? ([All] extends [T] ? false : true) : never;

export type SingleKey<K extends Key> = true extends IsUnion<K>
  ? never
  : {} extends Record<K, never> ? never : K;

type Pair = readonly [Key, unknown];

type HasUnsureKey<Pairs extends readonly Pair[]> = true extends {
  [Index in keyof Pairs]: [SingleKey<Pairs[Index][0]>] extends [never] ? true : false;
}[number] ? true : false;

type FromPairs<Pairs extends readonly Pair[], Values = {}> =
  Pairs extends readonly [infer First extends Pair, ...infer Rest extends Pair[]]
    ? FromPairs<Rest, Omit<Values, First[0]> & Record<First[0], First[1]>>
    : Readonly<Flatten<Values>>;

// Rejection lives in the result so that generic code can call fromEntries before its
// pairs are concrete. A rejected result has no readable property, and its only key says why.
export type FromEntries<Pairs extends readonly Pair[]> =
  number extends Pairs["length"]
    ? { readonly "fromEntries needs a fixed-length tuple"?: never }
    : [Extract<Pairs[number], unknown[]>] extends [never]
      ? HasUnsureKey<Pairs> extends true
        ? { readonly "fromEntries needs one literal key per pair"?: never }
        : FromPairs<Pairs>
      : { readonly "fromEntries needs readonly pairs"?: never };

export const freezeEntries = (pairs: Iterable<Pair>) => Object.freeze(Object.fromEntries(pairs));

export const fromEntries = <const Pairs extends readonly Pair[]>(pairs: Pairs): FromEntries<Pairs> => {
  const snapshot: Pair[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index];
    if (pair === undefined) throw new TypeError("Missing entry at a tuple position");
    snapshot.push([pair[0], pair[1]]);
  }
  // The result type follows these same indexed positions in overwrite order.
  return freezeEntries(snapshot) as FromEntries<Pairs>;
};

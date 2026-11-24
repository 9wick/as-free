export type Key = string | symbol;
export type Flatten<T> = { [K in keyof T]: T[K] };

type IsUnion<T, All = T> = T extends All ? ([All] extends [T] ? false : true) : never;

export type SingleKey<K extends Key> = true extends IsUnion<K>
  ? never
  : {} extends Record<K, never> ? never : K;

type Pair = readonly [Key, unknown];

type LiteralPairs<Pairs extends readonly Pair[]> =
  number extends Pairs["length"] ? never
    : [Extract<Pairs | Pairs[number], unknown[]>] extends [never]
      ? { [Index in keyof Pairs]: readonly [SingleKey<Pairs[Index][0]>, unknown] }
      : never;

type FromPairs<Pairs extends readonly Pair[], Values = {}> =
  Pairs extends readonly [infer First extends Pair, ...infer Rest extends Pair[]]
    ? FromPairs<Rest, Omit<Values, First[0]> & Record<First[0], First[1]>>
    : Readonly<Flatten<Values>>;

export const freezeEntries = (pairs: Iterable<Pair>) => Object.freeze(Object.fromEntries(pairs));

export const fromEntries = <const Pairs extends readonly Pair[]>(
  pairs: Pairs & NoInfer<LiteralPairs<Pairs>>,
): FromPairs<Pairs> => {
  const snapshot: Pair[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const pair = pairs[index];
    if (pair === undefined) throw new TypeError("Missing entry at a tuple position");
    snapshot.push([pair[0], pair[1]]);
  }
  // The result type follows these same indexed positions in overwrite order.
  return freezeEntries(snapshot) as FromPairs<Pairs>;
};

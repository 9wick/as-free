type Resolver<C> = { readonly resolveIn: (ctx: C) => unknown };
type Out<X> = X extends { readonly resolveIn: (ctx: never) => infer R } ? R : never;

type HasIndex<P> = string extends keyof P
  ? true
  : number extends keyof P
    ? true
    : symbol extends keyof P
      ? true
      : false;
type OptionalKeys<P> = { [K in keyof P]-?: {} extends Pick<P, K> ? K : never }[keyof P];

export type StrictRecord<P> =
  HasIndex<P> extends true
    ? { readonly "index signature の record は渡せない": never }
    : [OptionalKeys<P>] extends [never]
      ? unknown
      : { readonly "省略できる key は渡せない": OptionalKeys<P> };

export type Resolved<P> = { readonly [K in keyof P]: Out<P[K]> };

// field の型が string やテンプレートリテラルだと、Holder の key が index signature になり、空の holder も受け付けてしまう
export type LiteralField<F extends string> = {} extends { readonly [_ in F]: unknown }
  ? { readonly "field は文字列リテラルにする": never }
  : unknown;

export type Holder<F extends string, P> = { readonly [_ in F]?: P & StrictRecord<P> } & ([keyof P] extends [never]
  ? unknown
  : { readonly [_ in F]: P & StrictRecord<P> });

export const resolveField = <C, F extends string, const P extends Readonly<Record<string, Resolver<C>>>>(
  holder: Holder<F, P>,
  field: F & LiteralField<F>,
  ctx: C,
): Resolved<P> => {
  const optional: { readonly [_ in F]?: P & StrictRecord<P> } = holder;
  const record: Readonly<Record<string, Resolver<C>>> = optional[field] ?? {};
  // 代入だと key が "__proto__" のとき own property にならないので、fromEntries で作る
  const out = Object.fromEntries(Object.entries(record).map(([k, r]) => [k, r.resolveIn(ctx)]));
  return Object.freeze(out) as Resolved<P>;
};
type Named<C> = Resolver<C> & { readonly name: string };

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;
type DuplicateName<T extends readonly { readonly name: string }[], Seen = never> = T extends readonly [
  infer H extends { readonly name: string },
  ...infer R extends readonly { readonly name: string }[],
]
  ? H["name"] extends Seen
    ? H["name"]
    : DuplicateName<R, Seen | H["name"]>
  : never;
type NonLiteralName<T extends readonly { readonly name: string }[]> = {
  [I in keyof T]: string extends T[I]["name"] ? T[I] : true extends IsUnion<T[I]["name"]> ? T[I] : never;
}[number];

export type UniqueNames<T extends readonly { readonly name: string }[]> = number extends T["length"]
  ? { readonly "長さの決まった tuple を渡す": never }
  : [NonLiteralName<T>] extends [never]
    ? [DuplicateName<T>] extends [never]
      ? unknown
      : { readonly "name が重複している": DuplicateName<T> }
    : { readonly "name は1つの文字列リテラルにする": NonLiteralName<T> };

export type ByName<T extends readonly { readonly name: string }[]> = {
  readonly [E in T[number] as E["name"]]: Out<E>;
};

export const byName = <C, const T extends readonly Named<C>[]>(items: T & UniqueNames<T>, ctx: C): ByName<T> => {
  // 代入だと name が "__proto__" のとき own property にならないので、Map に集めて fromEntries で作る
  const out = new Map<string, unknown>();
  for (const item of items) {
    const { name } = item;
    if (out.has(name)) throw new Error(`"${name}" が重複しています`);
    out.set(name, item.resolveIn(ctx));
  }
  return Object.freeze(Object.fromEntries(out)) as ByName<T>;
};

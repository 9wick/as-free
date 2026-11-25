import { fromEntries, mapValues } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected mapped value");
}

// The application's own generic helpers. They use no type assertion.
type Getters<R> = { readonly [K in keyof R]: () => R[K] };
const readAll = <R>(getters: Getters<R>) => mapValues<Getters<R>, R>(getters, (get) => get());

type Named = { readonly name: string };
type NameOf<Item> = Item extends Named ? Item["name"] : never;
type Positions<P> = { readonly [I in keyof P]: Named & { readonly read: () => P[I] } };
type Fields<T extends readonly Named[], P> = {
  readonly [I in keyof T]: { readonly name: NameOf<T[I]>; readonly read: () => P[I & keyof P] };
};
type Pairs<T extends readonly Named[], P> = { readonly [I in keyof T]: readonly [NameOf<T[I]>, P[I & keyof P]] };
const readByName = <const T extends readonly Named[], const P>(fields: T & Positions<P> & Fields<T, P>) =>
  fromEntries(mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, field.read()]));

const marker = Symbol("marker");
const product = readAll({ price: () => 300, title: () => "ノート", [marker]: () => true });
const price: number = product.price;
const title: string = product.title;
const marked: boolean = product[marker];
equal(Reflect.ownKeys(product).length, 3);
equal(price, 300);
equal(title, "ノート");
equal(marked, true);
equal(Object.isFrozen(product), true);

const named = readByName([
  { name: "price", read: () => 300 },
  { name: "title", read: () => "ノート" },
]);
const namedPrice: number = named.price;
const namedTitle: string = named.title;
equal(Object.keys(named).join(), "price,title");
equal(namedPrice, 300);
equal(namedTitle, "ノート");

const partial: { price: () => number; title?: () => string } = { price: () => 300 };
const read = readAll(partial);
const maybeTitle: string | undefined = read.title;
equal(Object.keys(read).join(), "price");
equal(maybeTitle, undefined);

const own = readAll({ ["__proto__"]: () => 1 });
equal(Object.hasOwn(own, "__proto__"), true);

function overloaded(): number;
function overloaded(scale: number): string;
function overloaded(scale?: number): number | string {
  return scale === undefined ? 1 : "scaled";
}

function checkTypes(rows: readonly { readonly name: "price"; readonly read: () => number }[]) {
  // @ts-expect-error Each key keeps its own value type.
  const wrongTitle: number = product.title;
  // @ts-expect-error Each name keeps its own value type.
  const wrongNamed: string = named.price;
  // @ts-expect-error An optional key stays optional.
  const sureTitle: string = read.title;
  // @ts-expect-error The declared result follows the last overload, which this call does not select.
  readAll({ value: overloaded });
  // @ts-expect-error An array does not promise the price item exists.
  readByName(rows).price;
  void [price, title, marked, namedPrice, namedTitle, maybeTitle, wrongTitle, wrongNamed, sureTitle];
}
void checkTypes;

// A mapper that mixes up keys, positions or names does not compile in the application.
export const otherKey = <R>(getters: Getters<R>, other: R[keyof R]) =>
  // @ts-expect-error
  mapValues<Getters<R>, R>(getters, () => other);
export const constant = <const T extends readonly Named[], const P>(fields: T & Fields<T, P>) =>
  // @ts-expect-error
  mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, 123]);
export const otherPosition = <const T extends readonly Named[], const P>(fields: T & Fields<T, P>, other: P[keyof P]) =>
  // @ts-expect-error
  mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, other]);
export const otherName = <const T extends readonly Named[], const P>(fields: T & Fields<T, P>) =>
  // @ts-expect-error
  mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => ["title", field.read()]);
// @ts-expect-error A concrete mapper cannot return one position's value for every position.
mapValues<readonly [1, "a"], readonly [number, string]>([1, "a"], () => 1);

// Without type arguments the call always compiles, and no key gets a type its value does not have.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const same = <T extends true>(): T | undefined => undefined;
const boxes = { price: { value: 300 }, title: { value: "ノート" } };

const doubled = mapValues({ a: 1, b: 2 }, (n) => n * 2);
same<Same<typeof doubled, { readonly a: number; readonly b: number }>>();
equal(doubled.b, 4);

const mixed = mapValues(boxes, (box) => box.value);
same<Same<typeof mixed, { readonly price: string | number; readonly title: string | number }>>();
equal(mixed.title, "ノート");

const texts = mapValues([1, 2] as const, (n) => String(n));
same<Same<typeof texts, readonly [string, string]>>();
equal(texts[1], "2");

const unboxAll = <R>(source: { readonly [K in keyof R]: { readonly value: R[K] } }) =>
  mapValues(source, (box) => box.value);
const unboxed = unboxAll(boxes);
same<Same<typeof unboxed, { readonly price: number; readonly title: string }>>();
equal(unboxed.price, 300);

const constantAll = <R>(source: { readonly [K in keyof R]: { readonly value: R[K] } }) => mapValues(source, () => 123);
const constants = constantAll(boxes);
same<Same<typeof constants, { readonly price: number; readonly title: number }>>();
equal(constants.title, 123);

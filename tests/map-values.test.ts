import { fromEntries, mapValues } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected mapped value");
}

const marker = Symbol("marker");
const product = mapValues({ price: () => 300, title: () => "ノート", [marker]: () => true }, (get) => get());
const price: number = product.price;
const title: string = product.title;
const marked: boolean = product[marker];
equal(Reflect.ownKeys(product).length, 3);
equal(price, 300);
equal(title, "ノート");
equal(marked, true);
equal(Object.isFrozen(product), true);

const partial: { price: () => number; title?: () => string } = { price: () => 300 };
const read = mapValues(partial, (get) => get?.());
const maybeTitle: string | undefined = read.title;
equal(Object.keys(read).join(), "price");
equal(maybeTitle, undefined);

const own = mapValues({ ["__proto__"]: () => 1 }, (get) => get());
equal(Object.hasOwn(own, "__proto__"), true);

function overloaded(): number;
function overloaded(scale: number): string;
function overloaded(scale?: number): number | string {
  return scale === undefined ? 1 : "scaled";
}
// A call on an overloaded function gets the type of the overload the call selects.
const selected = mapValues({ value: overloaded }, (run) => run());
const selectedValue: number = selected.value;
equal(selectedValue, 1);

function checkTypes() {
  // @ts-expect-error Each key keeps its own value type.
  const wrongTitle: number = product.title;
  // @ts-expect-error An optional key stays optional.
  const sureTitle: string = read.title;
  // @ts-expect-error A generic function does not know the values yet.
  const generic = <T extends object>(source: T) => mapValues(source, (value) => value);
  void [wrongTitle, sureTitle, generic];
}
void checkTypes;

// Called directly, each key gets the type found along the path the mapper took from its item.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const same = <T extends true>(): T | undefined => undefined;
const boxes = { price: { value: 300 }, title: { value: "ノート" } };

const unboxed = mapValues(boxes, (box) => box.value);
same<Same<typeof unboxed, { readonly price: number; readonly title: string }>>();
equal(unboxed.price, 300);

const called = mapValues({ price: () => 300, title: async () => "ノート" }, (get) => get());
same<Same<typeof called, { readonly price: number; readonly title: Promise<string> }>>();
equal(called.price, 300);

const withArgument = mapValues({ find: (id: string) => ({ id }), save: (id: string) => id.length > 0 }, (run) => run("a"));
same<Same<typeof withArgument, { readonly find: { id: string }; readonly save: boolean }>>();
equal(withArgument.save, true);

const viaMethod = mapValues({ p: { run: (n: number) => n }, q: { run: (n: number) => String(n) } }, (item) => item.run(1));
same<Same<typeof viaMethod, { readonly p: number; readonly q: string }>>();
equal(viaMethod.q, "1");

const computed = mapValues(boxes, (box) => String(box.value));
same<Same<typeof computed, { readonly price: string; readonly title: string }>>();
equal(computed.price, "300");

const keyed = mapValues(boxes, (box, key) => [key, box.value] as const);
same<Same<typeof keyed.title, readonly ["price" | "title", string]>>();
equal(keyed.title[1], "ノート");

const wrapped = mapValues(boxes, (box) => new Set([box.value]));
wrapped.price.forEach((value) => {
  const kept: number = value;
  equal(kept, 300);
});

const direct = fromEntries(
  mapValues(
    [
      { name: "price", value: 300 },
      { name: "title", value: "ノート" },
    ],
    (field) => [field.name, field.value] as const,
  ),
);
same<Same<typeof direct, { readonly price: 300; readonly title: "ノート" }>>();
equal(direct.title, "ノート");

// A function that keeps an earlier item gets no per-key type.
const first = <T>() => {
  let kept: { readonly value: T } | undefined;
  return (value: T): T => (kept ??= { value }).value;
};
const stale = mapValues({ a: 1, b: "x" }, first());
same<Same<typeof stale, { readonly a: unknown; readonly b: unknown }>>();
equal(stale.b, 1);

const table = mapValues({ a: 1, b: "x" }, (outer) => {
  const plain: number | string = outer;
  return mapValues({ a: 1, b: "x" }, (inner) => [plain, inner] as const);
});
same<Same<typeof table.b.a, readonly [string | number, 1]>>();
equal(table.b.a[0], "x");

function checkDirect(rows: readonly { readonly name: "price"; readonly value: number }[]) {
  // @ts-expect-error The inner call cannot return the outer item: both would count as the inner item.
  mapValues({ a: 1, b: "x" }, (outer) => mapValues({ a: 1, b: "x" }, () => outer));
  // @ts-expect-error The same holds inside a container.
  mapValues({ a: 1, b: "x" }, (outer) => mapValues({ a: 1, b: "x" }, (inner) => [outer, inner] as const));
  // @ts-expect-error An array does not promise the price item exists.
  fromEntries(mapValues(rows, (field) => [field.name, field.value] as const)).price;
  // @ts-expect-error Each key keeps its own value type.
  const wrong: string = unboxed.price;
  void wrong;
}
void checkDirect;

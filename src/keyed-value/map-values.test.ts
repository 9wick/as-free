import { fromEntries, mapValues } from "as-free";

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

const withArgument = mapValues({ find: (id: string) => ({ id }), save: (id: string) => id.length > 0 }, (run) =>
  run("a"),
);
same<Same<typeof withArgument, { readonly find: { id: string }; readonly save: boolean }>>();
equal(withArgument.save, true);

const viaMethod = mapValues({ p: { run: (n: number) => n }, q: { run: (n: number) => String(n) } }, (item) =>
  item.run(1),
);
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

// Inside a generic function the mapper is checked against what the items are known to be,
// and each key's result is found on the actual item once the function is called.
type Context = { readonly seed: number };
type Feature = { readonly key: string; realize(context: Context): unknown };
class UserFeature {
  readonly key = "users";
  async realize(context: Context) {
    return { userCount: context.seed };
  }
}
class StatusFeature {
  readonly key = "status";
  realize(context: Context) {
    return { ready: context.seed > 0 };
  }
}

const describeAll = <const Features extends readonly Feature[]>(features: Features, context: Context) =>
  fromEntries(mapValues(features, (feature) => [feature.key, feature.realize(context)] as const));
const described = describeAll([new UserFeature(), new StatusFeature()], { seed: 2 });
same<Same<typeof described, { readonly users: Promise<{ userCount: number }>; readonly status: { ready: boolean } }>>();
equal(described.status.ready, true);

const realizeAll = async <const Features extends readonly Feature[]>(features: Features, context: Context) =>
  fromEntries(
    await Promise.all(mapValues(features, async (feature) => [feature.key, await feature.realize(context)] as const)),
  );
const realized = await realizeAll([new UserFeature(), new StatusFeature()], { seed: 2 });
same<Same<typeof realized, { readonly users: { userCount: number }; readonly status: { ready: boolean } }>>();
equal(realized.users.userCount, 2);
equal(realized.status.ready, true);

const readAll = <Getters extends Record<string, () => unknown>>(getters: Getters) => mapValues(getters, (get) => get());
const readBoth = readAll({ count: () => 3, label: () => "x" });
same<Same<typeof readBoth, { readonly count: number; readonly label: string }>>();
equal(readBoth.label, "x");

function readOverlapping(context: "port"): number;
function readOverlapping(context: string): string;
function readOverlapping(context: string): number | string {
  return context === "port" ? 3000 : context;
}
type Reader = { readonly key: string; read(context: "port"): unknown };
const readPorts = <const Readers extends readonly Reader[]>(readers: Readers) =>
  fromEntries(mapValues(readers, (reader) => [reader.key, reader.read("port")] as const));
const ports = readPorts([
  { key: "plain", read: (context: "port") => context.length },
  { key: "overloaded", read: readOverlapping },
]);
// An overloaded function is not followed: its result stays as the generic function saw it.
same<Same<typeof ports, { readonly plain: number; readonly overloaded: unknown }>>();
equal(ports.plain, 4);
equal(ports.overloaded, 3000);

// A value of unknown type stays unknown inside the mapper, and an await on it is recorded.
const unknownGetters: { readonly a: () => unknown; readonly b: () => unknown } = { a: () => 1, b: () => "x" };
const awaitedUnknown = mapValues(unknownGetters, async (get) => await get());
same<Same<typeof awaitedUnknown, { readonly a: Promise<unknown>; readonly b: Promise<unknown> }>>();
equal(await awaitedUnknown.b, "x");

interface Shop {
  readonly open: () => boolean;
  readonly name: () => string;
}
function checkGeneric(rows: readonly UserFeature[]) {
  mapValues(unknownGetters, (get) => {
    const value = get();
    // @ts-expect-error Nothing is known about the value.
    value.toString();
    return value;
  });
  mapValues(unknownGetters, (get) => {
    const value = get();
    // @ts-expect-error A value an outer mapValues traced cannot be returned from an inner one.
    return mapValues({ a: 1 }, () => value);
  });
  // @ts-expect-error The source may have keys beyond the ones Shop lists, whose values are not functions.
  const callAll = <Source extends Shop>(source: Source) => mapValues(source, (get) => get());
  // @ts-expect-error An array does not promise the users item exists.
  describeAll(rows, { seed: 1 }).users;
  void callAll;
}
void checkGeneric;

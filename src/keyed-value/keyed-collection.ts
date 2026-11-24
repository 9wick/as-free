import { freezeEntries, type Flatten, type Key, type SingleKey } from "./from-entries.ts";
import type { GuardedValue } from "./keyed-value-view.ts";

type KeyedItem = { readonly key: Key };
type Evaluation = "async" | "sync";
type Projection = "raw" | "view";
type Method<Args extends readonly unknown[]> = (...args: Args) => unknown;

type DeclaredValue<Item, Name extends PropertyKey> =
  Item extends Record<Name, (...args: never[]) => infer Value> ? Value : never;

export type KeyedMethodValue<
  Item,
  Name extends PropertyKey,
  Mode extends Evaluation = "async",
> = Mode extends "async" ? Awaited<DeclaredValue<Item, Name>> : DeclaredValue<Item, Name>;

type ConstructSignature<Fn> =
  Fn extends abstract new (...args: infer Parameters) => infer Value
    ? new (...args: Parameters) => Value
    : unknown;

type AcceptsCall<Fn, Args extends readonly unknown[], Receiver> =
  Fn extends (...args: infer Parameters) => infer Value
    ? Receiver extends ThisParameterType<Fn>
      ? (((this: ThisParameterType<Fn>, ...args: Parameters) => Value) &
        Pick<Fn, keyof Fn> & ConstructSignature<Fn>) extends Fn
        ? Fn extends (...args: Args) => Value ? true : false
        : false
      : false
    : false;

type CompatibleItem<Item, Name extends PropertyKey, Args extends readonly unknown[]> =
  Item extends Record<Name, infer Fn> ? false extends AcceptsCall<Fn, Args, Item> ? never : Item : never;

export type CompatibleKeyedMethods<
  Items extends readonly KeyedItem[],
  Name extends PropertyKey,
  Args extends readonly unknown[],
> = { [Index in keyof Items]: CompatibleItem<Items[Index], Name, Args> };

type Projected<Value, Shape extends Projection> = Shape extends "view" ? GuardedValue<Value> : Value;

type EntryOf<
  Item extends KeyedItem,
  Name extends PropertyKey,
  Mode extends Evaluation,
  Shape extends Projection,
> = Readonly<{ key: Item["key"]; item: Item; value: Projected<KeyedMethodValue<Item, Name, Mode>, Shape> }>;

export type KeyedValueEntry<
  Item extends KeyedItem,
  Name extends PropertyKey,
  Mode extends Evaluation = "async",
  Shape extends Projection = "raw",
> = Item extends KeyedItem ? EntryOf<Item, Name, Mode, Shape> : never;

type FixedItems<Items extends readonly KeyedItem[]> =
  [Extract<Items, unknown[]>] extends [never] ? {
    [Index in keyof Items & `${number}`]: [Items[Index]] extends [KeyedItem]
      ? [SingleKey<Items[Index]["key"]>] extends [never] ? never : Items[Index]
      : never;
  }[keyof Items & `${number}`] : never;

type OverlappingItems<Items extends KeyedItem, K extends Key> = Items extends KeyedItem
  ? [Items["key"] & K] extends [never] ? never : Items
  : never;

type PrototypeKey = keyof Object | "__proto__" | "__defineGetter__" | "__defineSetter__" |
  "__lookupGetter__" | "__lookupSetter__";

type InheritedValue<K extends Key, P extends PrototypeKey = PrototypeKey> =
  P extends K ? P extends keyof Object ? Object[P] : unknown : never;

type ProjectOptional<Items extends KeyedItem, Name extends PropertyKey, Mode extends Evaluation, Shape extends Projection> = {
  readonly [K in Items["key"]]?: Projected<KeyedMethodValue<OverlappingItems<Items, K>, Name, Mode>, Shape> | InheritedValue<K>;
};

type ProjectRequired<Items extends KeyedItem, Name extends PropertyKey, Mode extends Evaluation, Shape extends Projection> = {
  readonly [Item in Items as Item["key"]]: Projected<KeyedMethodValue<Item, Name, Mode>, Shape>;
};

type DefinedValue<Items extends KeyedItem, K extends Key, Name extends PropertyKey> =
  Exclude<KeyedMethodValue<OverlappingItems<Items, K>, Name, "sync">, undefined>;

type ProjectDefinedOptional<Items extends KeyedItem, Name extends PropertyKey> = {
  readonly [K in Items["key"] as [DefinedValue<Items, K, Name>] extends [never]
    ? never : K]?: DefinedValue<Items, K, Name> | InheritedValue<K>;
};

type ProjectDefinedRequired<Items extends KeyedItem, Name extends PropertyKey> = {
  readonly [K in Items["key"] as undefined extends KeyedMethodValue<
    Extract<Items, { readonly key: K }>, Name, "sync"
  > ? never : K]: KeyedMethodValue<Extract<Items, { readonly key: K }>, Name, "sync">;
};

export type ObjectFromKeyedValues<
  Items extends readonly KeyedItem[],
  Name extends PropertyKey,
  Mode extends Evaluation = "async",
  Shape extends Projection = "raw",
> = Flatten<ProjectOptional<Items[number], Name, Mode, Shape> & ProjectRequired<FixedItems<Items>, Name, Mode, Shape>>;

export type ObjectFromDefinedKeyedValues<
  Items extends readonly KeyedItem[],
  Name extends PropertyKey,
> = Flatten<ProjectDefinedOptional<Items[number], Name> & ProjectDefinedRequired<FixedItems<Items>, Name>>;

type Row = Readonly<{ key: Key; item: KeyedItem; value: unknown }>;
type ItemClass<Name extends PropertyKey> =
  abstract new (...args: never[]) => KeyedItem & Record<Name, Method<never[]>>;

export type KeyedClassEntry<
  Item extends KeyedItem,
  Instance extends KeyedItem,
  Name extends PropertyKey,
  Mode extends Evaluation = "async",
  Args extends readonly unknown[] = [],
  Shape extends Projection = "raw",
> = Readonly<{
  key: Item["key"] & Instance["key"];
  item: Item & Instance;
  value: Projected<KeyedMethodValue<Item, Name, Mode>, Shape> &
    ([Instance] extends [CompatibleItem<Instance, Name, Args>]
      ? Projected<KeyedMethodValue<Instance, Name, Mode>, Shape> : unknown);
}>;

export interface KeyedValues<
  Items extends readonly KeyedItem[],
  Name extends PropertyKey,
  Mode extends Evaluation = "async",
  Args extends readonly unknown[] = [],
  Shape extends Projection = "raw",
> {
  readonly rows: readonly KeyedValueEntry<Items[number], Name, Mode, Shape>[];
  toObject(): ObjectFromKeyedValues<Items, Name, Mode, Shape>;
  forClass<Class extends ItemClass<Name>>(
    itemClass: Class,
  ): readonly KeyedClassEntry<Items[number], InstanceType<Class>, Name, Mode, Args, Shape>[];
  mapValues(map: <Value>(value: Value, item: Items[number]) => Value): KeyedValues<Items, Name, Mode, Args, Shape>;
  viewValues(
    this: KeyedValues<Items, Name, Mode, Args, "raw">,
    bind: <Value>(value: Value, item: Items[number]) => GuardedValue<Value>,
  ): KeyedValues<Items, Name, Mode, Args, "view">;
}

export interface SyncKeyedValues<Items extends readonly KeyedItem[], Name extends PropertyKey>
  extends KeyedValues<Items, Name, "sync"> {
  toDefinedObject(): ObjectFromDefinedKeyedValues<Items, Name>;
  mapValues(map: <Value>(value: Value, item: Items[number]) => Value): SyncKeyedValues<Items, Name>;
}

const toObject = (rows: readonly Row[]): Readonly<Record<Key, unknown>> =>
  freezeEntries(rows.map(({ key, value }) => [key, value]));

export const matchesKeyedClass = (
  item: object,
  itemClass: abstract new (...args: never[]) => object,
): boolean => {
  if (!(item instanceof itemClass)) return false;
  const prototype: unknown = itemClass.prototype;
  if (
    typeof prototype !== "object" || prototype === null ||
    !Object.prototype.isPrototypeOf.call(prototype, item)
  ) {
    throw new TypeError("The class matched a value outside its prototype chain");
  }
  return true;
};

function createCollection<
  Items extends readonly KeyedItem[],
  Name extends PropertyKey,
  Mode extends Evaluation,
  Args extends readonly unknown[],
  Shape extends Projection,
>(source: readonly Row[]) {
  const stored = Object.freeze(source.map((row) => Object.freeze(row)));
  const rows = stored as readonly KeyedValueEntry<Items[number], Name, Mode, Shape>[];

  return Object.freeze({
    rows,
    toObject: (): ObjectFromKeyedValues<Items, Name, Mode, Shape> =>
      toObject(rows) as ObjectFromKeyedValues<Items, Name, Mode, Shape>,
    toDefinedObject: (): ObjectFromDefinedKeyedValues<Items, Name> =>
      toObject(rows.filter(({ value }) => value !== undefined)) as
        ObjectFromDefinedKeyedValues<Items, Name>,
    forClass: <Class extends ItemClass<Name>>(itemClass: Class) => {
      return Object.freeze(stored.filter(
        (row): row is KeyedClassEntry<Items[number], InstanceType<Class>, Name, Mode, Args, Shape> =>
          matchesKeyedClass(row.item, itemClass),
      ));
    },
    mapValues: (map: <Value>(value: Value, item: Items[number]) => Value) =>
      createCollection<Items, Name, Mode, Args, Shape>(rows.map(({ key, item, value }) => ({
        key,
        item,
        value: map(value, item),
      }))),
    viewValues: (bind: <Value>(value: Value, item: Items[number]) => GuardedValue<Value>) =>
      createCollection<Items, Name, Mode, Args, "view">(rows.map(({ key, item, value }) => ({
        key,
        item,
        value: bind(value, item),
      }))),
  });
}

function snapshotKeys<Item extends KeyedItem>(items: readonly Item[]) {
  const seen = new Set<Key>();
  const keyedItems: { key: Key; item: Item }[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item === undefined) throw new TypeError("Missing keyed item");
    const key = item.key;
    if (seen.has(key)) throw new TypeError(`Duplicate collection key: ${String(key)}`);
    seen.add(key);
    keyedItems.push({ key, item });
  }
  return keyedItems;
}

export async function collectKeyedValues<
  const Items extends readonly (KeyedItem & Record<Name, Method<[Context]>>)[],
  const Name extends PropertyKey,
  Context,
>(
  items: Items & NoInfer<CompatibleKeyedMethods<Items, Name, [Context]>>,
  method: Name,
  context: Context,
): Promise<KeyedValues<Items, Name, "async", [Context]>> {
  const rows: Row[] = [];
  for (const { key, item } of snapshotKeys<Items[number]>(items)) {
    rows.push({ key, item, value: await item[method](context) });
  }
  return createCollection<Items, Name, "async", [Context], "raw">(rows);
}

export function collectKeyedValuesSync<
  const Items extends readonly (KeyedItem & Record<Name, Method<[]>>)[],
  const Name extends PropertyKey,
>(
  items: Items & NoInfer<CompatibleKeyedMethods<Items, Name, []>>,
  method: Name,
): SyncKeyedValues<Items, Name> {
  return createCollection<Items, Name, "sync", [], "raw">(snapshotKeys<Items[number]>(items).map(({ key, item }) => ({
    key,
    item,
    value: item[method](),
  })));
}

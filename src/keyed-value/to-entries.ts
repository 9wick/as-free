import type { Key } from "./from-entries.ts";

type Item<KeyField extends PropertyKey, ValueField extends PropertyKey> =
  Readonly<Record<KeyField, Key>> & Readonly<Record<ValueField, unknown>>;

type Entry<Source, KeyField extends PropertyKey, ValueField extends PropertyKey> =
  Source extends Item<KeyField, ValueField>
    ? readonly [Source[KeyField], Source[ValueField]]
    : never;

type TupleEntries<Slots extends readonly unknown[], KeyField extends PropertyKey, ValueField extends PropertyKey> = {
  readonly [Index in keyof Slots]: Entry<Slots[Index], KeyField, ValueField>;
};

type Entries<Items extends readonly unknown[], KeyField extends PropertyKey, ValueField extends PropertyKey> =
  Items extends unknown[]
    ? readonly Entry<Items[number], KeyField, ValueField>[]
    : Items extends readonly [...infer Slots]
      ? TupleEntries<Slots, KeyField, ValueField>
      : readonly Entry<Items[number], KeyField, ValueField>[];

export const toEntries = <
  const KeyField extends PropertyKey,
  const ValueField extends PropertyKey,
  const Items extends readonly Item<KeyField, ValueField>[],
>(
  items: Items,
  keyField: KeyField,
  valueField: ValueField,
): Entries<Items, KeyField, ValueField> => {
  const pairs: (readonly [Key, unknown])[] = [];
  const length = items.length;
  for (let index = 0; index < length; index++) {
    const item = items[index];
    if (item === undefined) throw new TypeError("Missing item at an entry position");
    const pair: readonly [Key, unknown] = [item[keyField], item[valueField]];
    pairs.push(Object.freeze(pair));
  }

  // Each output position uses both fields from the same indexed input item.
  return Object.freeze(pairs) as Entries<Items, KeyField, ValueField>;
};

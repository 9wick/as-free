import { fromEntries, toEntries } from "type-proof";

const items = [
  { name: "price", value: 300 },
  { name: "title", value: "ノート" },
] as const;

const entries = toEntries(items, "name", "value");
const priceEntry: readonly ["price", 300] = entries[0];
const titleEntry: readonly ["title", "ノート"] = entries[1];
const product = fromEntries(entries);
const price: 300 = product.price;
const title: "ノート" = product.title;

if (
  priceEntry[0] !== "price" ||
  titleEntry[0] !== "title" ||
  price !== 300 ||
  title !== "ノート" ||
  !Object.isFrozen(entries) ||
  !Object.isFrozen(priceEntry)
) {
  throw new Error("Expected each item's key and value in the same position");
}

const symbol = Symbol("calculate");
let calls = 0;
const calculate = (value: number) => {
  calls++;
  return value * 2;
};
const handlers = fromEntries(toEntries([{ key: symbol, action: calculate }], "key", "action"));
if (calls !== 0 || handlers[symbol] !== calculate || handlers[symbol](3) !== 6) {
  throw new Error("Expected function values to remain unchanged until the caller invokes them");
}

const withIterator = Object.assign(items, {
  [Symbol.iterator]: () => items.slice(0, 0).values(),
});
const indexedEntries = toEntries(withIterator, "name", "value");
if (indexedEntries.length !== 2 || indexedEntries[1]?.[1] !== "ノート") {
  throw new Error("Expected the indexed items in their original positions");
}

const mutable: [typeof items[0], typeof items[1]] = [items[0], items[1]];
mutable.pop();
const remaining = toEntries(mutable, "name", "value");
if (remaining.length !== 1 || remaining[0]?.[1] !== 300) {
  throw new Error("Expected only the items still present in the mutable array");
}

function checkTypes(rows: readonly (typeof items)[number][]) {
  const pairs = toEntries(rows, "name", "value");
  for (const pair of pairs) {
    if (pair[0] === "price") {
      const amount: 300 = pair[1];
      void amount;
    } else {
      const name: "ノート" = pair[1];
      void name;
    }
  }
  // @ts-expect-error An arbitrary array may have no price or title.
  fromEntries(pairs);
  // @ts-expect-error A mutable tuple may have lost a required position.
  fromEntries(remaining);
  // @ts-expect-error Every item must have the selected value field.
  toEntries(items, "name", "missing");
  // @ts-expect-error A selected key must be a string or symbol.
  toEntries(items, "value", "name");
}

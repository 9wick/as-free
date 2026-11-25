# value-store

English | [日本語](README.ja.md) · [Back to README](../../README.md)

## Create lifetime-guarded references

Pass a reader function for the underlying value to `createKeyedValueView`, then pass the target object to `bind` to get a `Proxy` that forwards its public members. In this example, once editing ends, reading the draft through the reference throws:

```ts
import { createKeyedValueView } from "as-free";

const draft = { text: "Draft" };
let editing = true;

const view = createKeyedValueView(() => {
  if (!editing) throw new Error("Editing has ended");
  return draft;
});

const result = view.bind(draft);
if (result.ok) {
  console.log(result.value.text); // Draft
  editing = false;
  // Reading result.value.text throws Error
}
```

## Store values with typed keys

`KeyedValueStore` stores values of different types in a single store. Using the same `ValueKey<T>` for `set` and `get` recovers the value with its exact type:

```ts
import { KeyedValueStore, ValueKey } from "as-free";

const store = new KeyedValueStore();
const title = new ValueKey<string>();
const quantity = new ValueKey<number>();
store.set(title, "Notebook");
store.set(quantity, 12);

store.get(title); // string | undefined
store.get(quantity); // number | undefined
```

`ValueKey<T>`'s type parameter is invariant. The backing `WeakMap` is private, and `set` accepts only values matching that key's `T`—which guarantees that `get` can safely recover `Value | undefined`.

# keyed-value

English | [日本語](README.ja.md) · [Back to README](../../README.md)

## Build an object from pairs

Pass `[key, value]` pairs to `fromEntries` to receive an object that preserves literal key and value types:

```ts
import { fromEntries } from "as-free";

const pairs = [
  ["name", "Notebook"],
  ["price", 300],
] as const;

const product = fromEntries(pairs);
product.name; // type: "Notebook"
product.price; // type: 300
```

The input must be a fixed-length tuple of `readonly` pairs, where each pair's key is a single concrete string literal or `unique symbol`. If the same key appears multiple times, the last value and type win.

If you pass an input whose keys cannot be statically guaranteed (such as a variable-length array), the return type becomes an object whose only property name is the error reason. Accessing any property such as `product.price` triggers a compile error:

```ts
const rows: readonly (readonly ["price", number])[] = [];

const product = fromEntries(rows);
product.price;
// Error: Property 'price' does not exist on type
// '{ readonly "fromEntries needs a fixed-length tuple"?: never }'
```

## Register and call functions

Functions can also be registered as `[key, value]` entries. Calling a function retrieved from the resulting object preserves each key's parameter and return types:

```ts
import { fromEntries } from "as-free";

const handlers = fromEntries([
  ["count", (n: number) => n * 2],
  ["label", async (n: number) => `${n} left`],
] as const);

const count = handlers.count(3); // number
const label = await handlers.label(3); // string
```

`fromEntries` stores functions as values; call and `await` them at the call site.

## Map every value

`mapValues` is the object counterpart of `Array.prototype.map`. It applies the second-argument mapper function to every value and places each result under the same key, preserving per-key return types:

```ts
import { mapValues } from "as-free";

const boxes = { price: { value: 300 }, title: { value: "Notebook" } };
const values = mapValues(boxes, (box) => box.value);
values.price; // number
values.title; // string

const getters = { count: () => 3, label: async () => "3 left" };
const results = mapValues(getters, (get) => get());
results.count; // number
results.label; // Promise<string>
```

For an array/tuple of named items, map them into `[name, value]` pairs and pass the result to `fromEntries`:

```ts
import { fromEntries, mapValues } from "as-free";

const fields = [
  { name: "price", read: () => 300 },
  { name: "title", read: () => "Notebook" },
] as const;

const product = fromEntries(mapValues(fields, (field) => [field.name, field.read()] as const));
product.price; // number
product.title; // string
```

When extracting this pattern into a helper function, capture the input type as a `const` type parameter so literal types are not widened:

```ts
type Field = { readonly name: string; read(): unknown };

const readByName = <const Fields extends readonly Field[]>(list: Fields) =>
  fromEntries(mapValues(list, (field) => [field.name, field.read()] as const));
```

When calling `mapValues` nested inside another `mapValues` mapper, returning the outer received value directly from the inner mapper results in a compile error. Calling an overloaded function inside the mapper also does not preserve per-key return types.

## Read a field that may be left out

To let a field such as a record of dependencies be left out only when it would be empty, build the definition type with `OptionalWhenEmpty`. Inside a generic function, read the field with `fieldOrEmpty`. When the field is left out, it returns an empty object.

```ts
import { fieldOrEmpty, mapValues, type OptionalWhenEmpty } from "as-free";

type Dep<T> = { readonly resolve: () => T };

const resolveAll = <P extends Record<string, Dep<unknown>>>(deps: P) => mapValues(deps, (dep) => dep.resolve());
type Resolved<P extends Record<string, Dep<unknown>>> = ReturnType<typeof resolveAll<P>>;

type Rule<P extends Record<string, Dep<unknown>>> = {
  readonly check: (id: string, deps: Resolved<P>) => boolean;
} & OptionalWhenEmpty<"requires", P>;

const rule = <P extends Record<string, Dep<unknown>> = {}>(def: Rule<P>) => {
  const deps = resolveAll(fieldOrEmpty<"requires", P>(def, "requires"));
  return (id: string) => def.check(id, deps);
};

rule({ check: (id) => id !== "" });
rule({ requires: { find }, check: (id, { find }) => find(id) });
```

`P` is not inferred, so pass it explicitly along with the field name. Give the type parameter `P` of your own function the default `= {}`.

The field cannot be left out for the following `P`, and doing so is a compile error:

- A record with any key, including optional keys and index signatures such as `Record<string, X>`.
- Function types, constructor types, and classes whose members are all private. An empty object is not a value of these.

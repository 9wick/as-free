# as-free

[![CI](https://github.com/9wick/as-free/actions/workflows/ci.yml/badge.svg)](https://github.com/9wick/as-free/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/as-free)](https://www.npmjs.com/package/as-free)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English | [日本語](README.ja.md)

**Type-preserving TypeScript utilities so your application code needs no `as`.**

## Overview

In TypeScript, there are cases where you _know_ a value's exact type at runtime, yet the type system loses it—such as `Object.fromEntries()`, `JSON.parse()` round-trips, typed heterogenous stores, or forwarding overloaded functions.

`as-free` encapsulates the unavoidable `as` assertions inside small, contract-enforced utilities so your application code gets precise types through normal type checking alone.

> **Out of scope:** Unchecked casts, validation-boundary casts, test mocks, and broken third-party `@types` workarounds. For the full taxonomy of `as` casts and our utility acceptance criteria, see [Scope & Design Criteria](docs/scope.md).

## Installation

```bash
npm install as-free
# or
pnpm add as-free
```

`as-free` is ESM-only and ships bundled `.d.mts` type declarations.

## Usage

### Type-preserving object transforms (`fromEntries`, `mapValues`)

Keep literal key and value types across `fromEntries` and `mapValues`:

```ts
import { fromEntries, mapValues } from "as-free";

const product = fromEntries([
  ["name", "Notebook"],
  ["price", 300],
] as const);
product.name; // "Notebook"
product.price; // 300

const boxes = { price: { value: 300 }, title: { value: "Notebook" } };
const values = mapValues(boxes, (box) => box.value);
values.price; // number
values.title; // string
```

### Typed JSON storage (`createJsonStore`)

Pair `set` and `get` under a single JSON-round-trippable type `T` with `Result`-based error handling:

```ts
import { createJsonStore } from "as-free";

type Product = { name: string; price: number };

const products = createJsonStore<Product>({
  readString: (key) => redis.get(`product:${key}`),
  writeString: (key, text) => redis.set(`product:${key}`, text),
});

await products.set("note", { name: "Notebook", price: 300 });

const result = await products.get("note");
if (result.type === "Success") {
  result.value; // Product
}
```

### Typed key-value store & lifetime views (`KeyedValueStore`, `createKeyedValueView`)

Store differently typed values in one store using invariant `ValueKey<T>` tokens, or guard object access with a lifetime check:

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

### Overload-preserving forwarding (`defineForwarder`, `whenArg`, `isFunction`)

Wrap or dispatch calls without losing overload signatures or generic parameters:

```ts
import { defineForwarder } from "as-free";

type Format = {
  (value: number, digits: number): string;
  (value: Date): string;
};

declare const format: Format;

const countedFormat = defineForwarder<[Format]>((args, forward) => {
  return forward(format, args);
});

countedFormat(3.14159, 2); // string
countedFormat(new Date()); // string
```

### Runtime constructor check (`as-free/runtime`)

Check whether an `unknown` value has `[[Construct]]` without invoking it or touching `prototype`:

```ts
import { isConstructor } from "as-free/runtime";

const candidate: unknown = Date;

if (isConstructor(candidate)) {
  console.log(new Date(0) instanceof candidate); // true
}
```

## Modules

| Module        | Import            | Purpose                                                               | Docs                                     |
| ------------- | ----------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `keyed-value` | `as-free`         | `fromEntries`, `mapValues`, `fieldOrEmpty` preserving key/value types | [keyed-value](src/keyed-value/README.md) |
| `json`        | `as-free`         | `createJsonStore` preserving `T` across JSON serialization            | [json](src/json/README.md)               |
| `value-store` | `as-free`         | `KeyedValueStore` / `ValueKey` and `createKeyedValueView`             | [value-store](src/value-store/README.md) |
| `callable`    | `as-free`         | `defineForwarder`, `whenArg`, `isFunction`                            | [callable](src/callable/README.md)       |
| `runtime`     | `as-free/runtime` | `isConstructor` runtime check                                         | [runtime](src/runtime/README.md)         |

## Documentation

- [Scope & Design Criteria](docs/scope.md) — Which `as` casts this package targets and how utilities are evaluated
- Module guides: [keyed-value](src/keyed-value/README.md) · [json](src/json/README.md) · [value-store](src/value-store/README.md) · [callable](src/callable/README.md) · [runtime](src/runtime/README.md)

## Development

```bash
pnpm install
vp check      # lint, format, and type check
vp run test   # run tests
vp run build  # build dist/
```

## License

[MIT](LICENSE)

# json

English | [日本語](README.ja.md) · [Back to README](../../README.md)

## Store and retrieve values with their types preserved

Pass string reader and writer functions to `createJsonStore<T>`. You get back a `set` function that serializes `T` to JSON and a `get` function that retrieves it as `T`:

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

Both `readString` and `writeString` may be synchronous or asynchronous. `get` and `set` always return a `Promise` wrapping a `Result`.

Connection handling, key prefixes, TTLs, and similar storage concerns belong inside `readString` and `writeString`. This module handles only JSON conversion and tying the types of `get` and `set` together.

## Handling results

Results from `get` and `set` are `{ type: "Success", value }` on success, or `{ type: "Failure", error }` on failure.

If `readString` returns no value, `get` fails. When `get` succeeds, `value` is guaranteed to have type `T`.

Inspect `error.kind` to distinguish failure causes:

| Function | `error.kind`        | Meaning                                                                                 |
| -------- | ------------------- | --------------------------------------------------------------------------------------- |
| `get`    | `not-found`         | `readString` returned `null` or `undefined`                                             |
| `get`    | `invalid-json`      | The stored string could not be parsed as JSON (`error.cause` is `SyntaxError`)          |
| `set`    | `non-finite-number` | The value contains `NaN` or `Infinity` (not stored because JSON turns them into `null`) |
| `set`    | `not-serializable`  | Serialization failed, e.g. due to circular references (`error.cause` is `TypeError`)    |

```ts
const result = await products.get("note");
if (result.type === "Failure" && result.error.kind === "not-found") {
  await products.set("note", { name: "Notebook", price: 300 });
}
```

Exceptions thrown by `readString` or `writeString` propagate directly from `get` and `set`.

## Why the type is sound

`get` can safely return `T` for three reasons:

- `get` and `set` are created together from a single `T`. `get` has no type parameter, so readers cannot pick an arbitrary type.
- `set` accepts only values of type `T`.
- JSON parsing runs exclusively on strings returned by `readString`; there is no generic function that parses arbitrary strings as `T`.

This guarantees consistency within your program's own reads and writes; it does not perform runtime schema validation on stored payloads.

## Supported types

Serialization uses `JSON.stringify` and `JSON.parse` directly. Only types whose shape survives a JSON round-trip unmodified can be passed as `T`:

```ts
createJsonStore<{ name: string; tags: string[] }>({ readString, writeString }); // OK

createJsonStore<{ createdAt: Date }>({ readString, writeString }); // Compile error
```

`Date` serializes to a string, `Map` serializes to `{}`, and `undefined` properties disappear. Because they do not match `T` after round-tripping, they are rejected at compile time. Convert timestamps to ISO strings or other JSON-native representations first.

## Caller responsibilities

The following cannot be enforced by the type system and must be maintained by the caller:

- `readString(key)` must return the string written by `writeString` for the same `key` (keep prefixes consistent).
- Do not call `createJsonStore` with different types `T` against the same backing store; define the store's type in one place.
- Handle data migrations separately when changing the shape of `T`. Values written by older versions or external systems are outside this module's guarantees, just like database schema changes.
- Do not pass class instances carrying data—the type system cannot distinguish them from plain objects, and retrieved values will not have prototypes.

# callable

English | [日本語](README.ja.md) · [Back to README](../../README.md)

## Forward calls while preserving overloads

Pass function types and a forwarding handler to `defineForwarder`. The returned function has the exact combined signature, so callers retain all original overloads:

```ts
import { defineForwarder } from "as-free";

type Format = {
  (value: number, digits: number): string;
  (value: Date): string;
};

declare const format: Format;
let calls = 0;

const countedFormat = defineForwarder<[Format]>((args, forward) => {
  calls += 1;
  return forward(format, args);
});

countedFormat(3.14159, 2); // string
countedFormat(new Date()); // string
countedFormat("3.14"); // Compile error
```

`args` represents the parameters of one of the provided overloads. `forward(f, args)` invokes `f` with `args` and returns its result, forwarding the outer `this` receiver as well.

Per-overload return types and generic signatures are preserved too:

```ts
type First = <T>(items: readonly T[]) => T | undefined;

declare const first: First;
const loggedFirst = defineForwarder<[First]>((args, forward) => {
  console.log("first", args[0].length);
  return forward(first, args);
});

loggedFirst([1, 2, 3]); // number | undefined
```

You can also forward the same arguments to multiple functions and return `undefined` (allowed whenever every overload's return type accepts `undefined`):

```ts
type Listener = {
  (event: "open"): void;
  (event: "close", code: number): void;
};

declare const listeners: readonly Listener[];

const notifyAll = defineForwarder<[Listener]>((args, forward) => {
  for (const listener of listeners) forward(listener, args);
  return undefined;
});
```

## Dispatch by argument type

Provide multiple function types to combine their overloads into one function, then use `whenArg(args, index, guard)` to narrow `args` per branch according to the argument at `index`:

```ts
import { defineForwarder, whenArg } from "as-free";

type OpenByPath = (path: string) => Handle;
type OpenWithOptions = (options: { readonly path: string; readonly readOnly: boolean }) => Handle;

declare const openByPath: OpenByPath;
declare const openWithOptions: OpenWithOptions;
const isString = (value: unknown): value is string => typeof value === "string";

const open = defineForwarder<[OpenByPath, OpenWithOptions]>((args, forward) => {
  const r = whenArg(args, 0, isString);
  return r.matched ? forward(openByPath, r.args) : forward(openWithOptions, r.args);
});

open("/tmp/a.txt"); // Handle
open({ path: "/tmp/a.txt", readOnly: true }); // Handle
```

Swapping the branches—for example passing `r.args` to `openWithOptions` when `r.matched` is `true`—fails to compile.

## Check if a value is a function

`isFunction(value)` narrows a function value to `(...args: never[]) => unknown`. Unlike `typeof value === "function"` (which narrows to the unsafe `Function` type), the narrowed value can be passed directly to parameters or collections expecting typed callbacks:

```ts
import { isFunction } from "as-free";

const handlers = new Map<string, (...args: never[]) => unknown>();

const register = (name: string, value: unknown): void => {
  if (isFunction(value)) handlers.set(name, value);
};
```

Because the parameter type is `never[]`, the narrowed function cannot be called blindly without knowing its parameter types.

## Why the type is sound

Let `F` be the combined signature built from the types passed to `defineForwarder`. The wrapper is guaranteed to return the declared return type for each overload of `F` because:

- The wrapper's signature `F` is constructed by the library; callers cannot widen accepted arguments.
- `args` is read-only and cannot be mutated inside the forwarding body.
- `forward` accepts only the `args` received in the current invocation (or narrowed via `whenArg`), never fabricated arrays or arguments from another call.
- `forward` accepts only functions matching a member of `F`, and only when `args` has been narrowed to parameters accepted by that function.
- The body may only return the token returned by `forward` during the current invocation, preventing cached results from a previous call from leaking across overloads.

Consequently, the wrapper always returns the result of calling a function in `F` with the exact arguments received, matching the return type `F` declares for those arguments.

## Caller responsibilities

TypeScript does not verify the body of a `guard` passed to `whenArg`. Whenever `guard` returns `true`, the runtime value must satisfy the type predicate:

```ts
const isString = (value: unknown): value is string => typeof value === "number"; // Not caught by the type checker
```

Treat `guard` like external-input validation: keep its runtime check aligned with its type predicate.

## Limitations

Patterns that break the soundness guarantees above are intentionally rejected:

- Replacing arguments with the output of an earlier function before forwarding to the next one.
- Constructing and returning a new value without forwarding through `forward`.
- Forwarding functions with 6 or more overloads (`defineForwarder` fails at compile time rather than silently dropping overloads).

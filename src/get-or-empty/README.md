# get-or-empty

English | [日本語](README.ja.md) · [Back to README](../../README.md)

## Read a field that may be left out only when empty

To make a field of type `P` optional only when `P` has no key, build the type with `OmittableIfEmpty`. Inside a generic function, `getOrEmpty` reads the field as a value of type `P`. When the field is left out, it returns an empty object.

```ts
import { getOrEmpty, type OmittableIfEmpty } from "as-free";

type Job<P> = { readonly run: (input: P) => void } & OmittableIfEmpty<"input", P>;

const runJob = <P extends object>(job: Job<P>) => job.run(getOrEmpty<"input", P>(job, "input"));

runJob({ run: () => {} });
runJob({ input: { id: 1 }, run: ({ id }) => console.log(id) });
```

`P` is not inferred, so pass it explicitly along with the field name.

The field cannot be left out for the following `P`, and doing so is a compile error:

- A type with any key, including optional keys and index signatures such as `Record<string, X>`.
- Function types, constructor types, and classes whose members are all private. An empty object is not a value of these.

# runtime

English | [日本語](README.ja.md) · [Back to README](../../README.md)

`as-free/runtime` provides runtime type guards for external inputs and dynamic values.

## Check whether a value is a constructor

`isConstructor(value)` checks whether a value has JavaScript's `[[Construct]]` internal method and narrows it to `Constructor` (`abstract new (...args: never[]) => object`). It uses a `Proxy` probe so it neither invokes the constructor body nor accesses `prototype`. See the [ECMAScript specification](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxycreate).

```ts
import { isConstructor } from "as-free/runtime";

const candidate: unknown = Date;

if (isConstructor(candidate)) {
  const date = new Date(0);
  console.log(date instanceof candidate); // true
}
```

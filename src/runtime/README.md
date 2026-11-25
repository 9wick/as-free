# 実行時の検証

`type-proof/runtime` は、外部入力や動的な値を扱うときに使います。

## コンストラクタかどうかを判定する

`isConstructor(value)` は JavaScript の `[[Construct]]` を持つかを判定し、成功時は `Constructor` 型に絞り込みます。Proxy を使い、対象のコンストラクタ本体を呼び出さず、`prototype` にも触れずに判定します。 [ECMAScript 仕様](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxycreate)

```ts
import { isConstructor } from "type-proof/runtime";

const candidate: unknown = Date;

if (isConstructor(candidate)) {
  const date = new Date(0);
  console.log(date instanceof candidate); // true
}
```

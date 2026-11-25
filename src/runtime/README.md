# 実行時の検証

`type-proof/runtime` は、外部入力や動的な値を扱うときに使います。

## 未知の値を関数として呼び出す

`callUnknown(target, args, receiver?)` は未知の値を指定された引数とレシーバーで呼び出します。成功時の値は `unknown` です。関数以外の入力は `not-callable`、呼び出しが例外を投げた場合は元の例外を伴う `call-failed` になります。

```ts
import { callUnknown } from "type-proof/runtime";

const target: unknown = (value: number) => value * 2;
const result = callUnknown(target, [21]);

if (result.ok && typeof result.value === "number") {
  console.log(result.value); // 42
}
```

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

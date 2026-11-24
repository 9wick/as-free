# safe-as


このパッケージは **「型安全だとわかっているのに、言語機能が足りなくて安全にできない」** 場合に使うものです。
必要な型アサーションをユーティリティの中に閉じ込め、アプリは `as` を書かずに精密な型を受け取れます。

典型例:

- `Object.entries()` / `Object.fromEntries()` すると型が消える
- `JSON.parse()` の戻り値が `unknown` になる
- DI コンテナが返す値の型パラメータが消える


### 1. 何の保証もない `as`

型が合わないのでとりあえず黙らせるキャスト。最も危険。

```ts
const value = someFunction() as MyType; // 根拠なし
```


### 2. 信頼境界の `as`

外部入力（API レスポンス、JSON など）にバリデーション付きで型を与えるキャスト。
バリデーションの正しさに依存する。

```ts
const parsed = schema.parse(JSON.parse(raw)) as Config;
```

### 3. 言語機能不足を補う `as`

ランタイムでは正しいことが保証されているが、TypeScript の型システムが表現できないキャスト。
**このパッケージが対象とするスコープ。**

いくつかの小分類がある:

#### 3a. 型推論の限界

ジェネリクスや高階型の推論が追いつかないケース。

```ts
// Object.entries() はキーを string に拡げてしまう
const entries = Object.entries(record) as [keyof T, T[keyof T]][];
```

#### 3b. ナローイング補助

型ガードや discriminated union で絞り込んだ後、コンパイラが推論しきれないケース。

```ts
// switch で全ケースを網羅しているが、コンパイラが絞りきれない末端
function handle(action: Action) {
  switch (action.type) {
    case "create":
      return processCreate(action as CreateAction);
    // ...
  }
}
```

> **推奨:** このケースは `ts-pattern` の `match().exhaustive()` を使えば `as` なしで型安全にナローイングできる。標準の `switch` 構文の制約であり、言語機能自体の不足ではないため、`as` ではなく `ts-pattern` の利用を推奨する。

### 4. テストモックの `as`

テストでオブジェクトの一部だけ用意するためのキャスト。プロダクションコードには入らない。

```ts
const mockUser = { name: "test" } as User;
```

### 5. ライブラリ型定義の不備を回避する `as`

サードパーティの `@types` が不正確・古い場合に正しい型へ矯正するキャスト。
外部要因に依存するため、型定義の更新で不要になることがある。

```ts
// @types/xxx が返り値を string としているが、実際は string | null
const result = lib.getValue() as string | null;
```

---

**このパッケージは分類 3（言語機能不足を補う `as`）のみを対象とする。** それ以外の `as` は、それぞれ適切な場所（バリデーション層、テストユーティリティなど）で管理すべきである。

## 採用基準

型アサーションを使うユーティリティには、以下のすべてが必要です。

1. 受け付ける入力の契約と実装から、宣言した戻り値型が実行時に成立することを説明できる。
2. TypeScript の型検査だけでは、その型の関係を保ったまま処理を書けない。
3. 型アサーションを関数内に閉じ込めることで、アプリは通常の型検査が効く呼び出しだけで使える。

## モジュール

### `keyed-values`

`resolveNamedValues(context)` は、同じコンテキストで解決した値を名前ごとのプロパティにします。

```ts
import { resolveNamedValues } from "type-proof"

const config = resolveNamedValues({ port: 3000 })
  .with("port", ctx => ctx.port)
  .with("url", ctx => `http://localhost:${ctx.port}`)
  .toObject()

config.port // number
config.url // string
```

`with` は一つの文字列リテラルか `unique symbol` を受け取り、そのキーに解決結果を入れた新しいスナップショットを作ります。同じキーを登録すると新しい値で上書きします。`toObject()` は凍結されたオブジェクトを返します。resolver が Promise を返した場合は、その Promise が値になります。

型アサーションの根拠は、既存の全フィールドをこの関数が列挙可能な own property として作っていることと、追加する一件のキーと値が `with` の実引数で決まることです。

### `keyed-value-store`

`KeyedValueStore` は、`ValueKey<T>` のインスタンスに対応する値を保管します。遅延値や DI トークンを保管する際、登録と取得で同じキーを使うことで型が揃います。

```ts
import { KeyedValueStore, ValueKey } from "type-proof"

const store = new KeyedValueStore()
const port = new ValueKey<number>()
store.set(port, 3000)

const value = store.get(port) // number | undefined
```

`ValueKey<T>` の型パラメータは不変です。保管先は非公開で、`set` はそのキーの `T` に合う値だけを受け取ります。これが、`WeakMap` から取り出した値の型を復元できる根拠です。

## 実行時の検証

`type-proof/runtime` は、外部入力や動的な値を扱うときに使います。

### `parseJson`

JSON を `unknown` としてパースし、デコーダが成功した場合にその値の型を返します。構文エラーとデコーダのエラーはそれぞれ `invalid-json` と `invalid-value` で受け取れます。

```ts
import { parseJson, type Result } from "type-proof/runtime"

function decodePort(input: unknown): Result<number, "expected-number"> {
  return typeof input === "number"
    ? { ok: true, value: input }
    : { ok: false, error: "expected-number" }
}

const port = parseJson("3000", decodePort)
```

### `callUnknown`

`callUnknown(target, args, receiver?)` は未知の値を指定された引数とレシーバーで呼び出します。成功時の値は `unknown` です。関数以外の入力は `not-callable`、呼び出しが例外を投げた場合は元の例外を伴う `call-failed` になります。

### `isConstructor`

`isConstructor(value)` は JavaScript の `[[Construct]]` を持つかを判定し、成功時は `Constructor` 型に絞り込みます。Proxy を使い、対象のコンストラクタ本体を呼び出さず、`prototype` にも触れずに判定します。 [ECMAScript 仕様](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxycreate)

# as-free

[![CI](https://github.com/9wick/as-free/actions/workflows/ci.yml/badge.svg)](https://github.com/9wick/as-free/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/as-free)](https://www.npmjs.com/package/as-free)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) | 日本語

**アプリケーションコードから `as` をなくすための、型を保つ TypeScript ユーティリティ集。**

## 概要

TypeScript では、`Object.fromEntries()` や `JSON.parse()`、型付きストア、オーバーロードを持つ関数の転送など、**「実行時には型が保証されているのに、言語機能の制約で型が失われる」** 場面があります。

`as-free` は、そうした不可避な型アサーションを契約付きの小さなユーティリティ内に閉じ込めます。呼び出し側は `as` を書かずに、通常の型検査だけで精密な型を受け取れます。

> **対象外:** 根拠のないキャスト、外部入力のバリデーション境界、テストモック、サードパーティ `@types` の回避策。対象スコープの分類と採用基準の詳細は [スコープと採用基準](docs/scope.ja.md) をご覧ください。

## インストール

```bash
npm install as-free
# または
pnpm add as-free
```

ESM 専用パッケージです（`.d.mts` 型定義同梱）。

## 使い方

### キーと値の型を保つ変換 (`fromEntries`, `mapValues`)

`fromEntries` や `mapValues` を使っても、キーと値のリテラル型やプロパティごとの型を失いません。

```ts
import { fromEntries, mapValues } from "as-free";

const product = fromEntries([
  ["name", "ノート"],
  ["price", 300],
] as const);
product.name; // "ノート"
product.price; // 300

const boxes = { price: { value: 300 }, title: { value: "ノート" } };
const values = mapValues(boxes, (box) => box.value);
values.price; // number
values.title; // string
```

### 型を保った JSON 保管 (`createJsonStore`)

JSON 往復できる型 `T` で `set` と `get` を結び付け、結果を `Result` で返します。

```ts
import { createJsonStore } from "as-free";

type Product = { name: string; price: number };

const products = createJsonStore<Product>({
  readString: (key) => redis.get(`product:${key}`),
  writeString: (key, text) => redis.set(`product:${key}`, text),
});

await products.set("note", { name: "ノート", price: 300 });

const result = await products.get("note");
if (result.type === "Success") {
  result.value; // Product
}
```

### 型付きキーストアと有効期間付き参照 (`KeyedValueStore`, `createKeyedValueView`)

不変な型パラメータを持つ `ValueKey<T>` で異なる型の値を 1 つのストアに保管したり、有効期間を検査する Proxy を作れます。

```ts
import { KeyedValueStore, ValueKey } from "as-free";

const store = new KeyedValueStore();
const title = new ValueKey<string>();
const quantity = new ValueKey<number>();

store.set(title, "ノート");
store.set(quantity, 12);

store.get(title); // string | undefined
store.get(quantity); // number | undefined
```

### オーバーロードを保つ関数転送 (`defineForwarder`, `whenArg`, `isFunction`)

オーバーロードやジェネリクスを失わずに、関数呼び出しをラップ・振り分けできます。

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

### 実行時のコンストラクタ判定 (`as-free/runtime`)

対象を呼び出さず、`prototype` にも触れずに `[[Construct]]` を持つか判定します。

```ts
import { isConstructor } from "as-free/runtime";

const candidate: unknown = Date;

if (isConstructor(candidate)) {
  console.log(new Date(0) instanceof candidate); // true
}
```

## モジュール一覧

| モジュール     | インポート        | 用途                                                     | ドキュメント                                  |
| -------------- | ----------------- | -------------------------------------------------------- | --------------------------------------------- |
| `keyed-value`  | `as-free`         | キーと値の型対応を保つ `fromEntries` / `mapValues`       | [keyed-value](src/keyed-value/README.ja.md)   |
| `get-or-empty` | `as-free`         | 空のときだけ省略できる field を取り出す `getOrEmpty`     | [get-or-empty](src/get-or-empty/README.ja.md) |
| `json`         | `as-free`         | JSON 経由で `T` を保つ `createJsonStore`                 | [json](src/json/README.ja.md)                 |
| `value-store`  | `as-free`         | `KeyedValueStore` / `ValueKey` と `createKeyedValueView` | [value-store](src/value-store/README.ja.md)   |
| `callable`     | `as-free`         | `defineForwarder`, `whenArg`, `isFunction`               | [callable](src/callable/README.ja.md)         |
| `runtime`      | `as-free/runtime` | `isConstructor` によるコンストラクタ判定                 | [runtime](src/runtime/README.ja.md)           |

## ドキュメント

- [スコープと採用基準](docs/scope.ja.md) — このパッケージが対象とする `as` の分類と採用基準
- 各モジュール詳細: [keyed-value](src/keyed-value/README.ja.md) · [get-or-empty](src/get-or-empty/README.ja.md) · [json](src/json/README.ja.md) · [value-store](src/value-store/README.ja.md) · [callable](src/callable/README.ja.md) · [runtime](src/runtime/README.ja.md)

## 開発

```bash
pnpm install
vp check      # リント・フォーマット・型チェック
vp run test   # テスト実行
vp run build  # dist/ のビルド
```

## ライセンス

[MIT](LICENSE)

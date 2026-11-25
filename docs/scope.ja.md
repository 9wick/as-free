# スコープと採用基準

[English](scope.md) | 日本語 · [README に戻る](../README.ja.md)

このパッケージは **「型安全だとわかっているのに、言語機能が足りなくて安全にできない」** 場合に使うものです。

## `as` の分類

すべての `as` がユーティリティの対象になるわけではありません。型アサーションを 5 つに分類して考えます。

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

### 3. 言語機能不足を補う `as`（このパッケージの対象）

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

> **推奨:** このケースは [`ts-pattern`](https://github.com/gvergnaud/ts-pattern) の `match().exhaustive()` を使えば `as` なしで型安全にナローイングできる。標準の `switch` 構文の制約であり、言語機能自体の不足ではないため、`as` ではなく `ts-pattern` の利用を推奨する。

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

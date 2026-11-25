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

- [keyed-value](src/keyed-value/README.md) は、キーと値の型の対応を保つ変換を扱います。
- [value-store](src/value-store/README.md) は、有効期間を持つ参照と、型付きキーでの保管を扱います。
- [runtime](src/runtime/README.md) は、JSON の検証、未知の値の呼び出し、コンストラクタの判定を扱います。

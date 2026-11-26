# json

[English](README.md) | 日本語 · [README に戻る](../../README.ja.md)

## 型を保ったまま保管して取り出す

`createJsonStore<T>` に、文字列を読む関数と書く関数を渡します。`T` を JSON にして保管する `set` と、取り出して `T` として返す `get` の対を受け取れます。

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

`readString` と `writeString` は同期でも非同期でも渡せます。`get` と `set` は常に `Promise` を返し、結果は `Result` で受け取ります。

保管先への接続、キーの prefix、有効期限などは `readString` と `writeString` の中に書きます。このモジュールが受け持つのは、JSON への変換と、`get` と `set` の型の結び付けだけです。

## 結果の受け取り方

`get` と `set` の結果は、成功なら `{ type: "Success", value }`、失敗なら `{ type: "Failure", error }` です。

`readString` が値を返さなかったとき、`get` の結果は失敗です。成功したときの `value` は必ず `T` です。

失敗の理由は `error.kind` で見分けます。

| 関数  | `error.kind`        | 意味                                                                                 |
| ----- | ------------------- | ------------------------------------------------------------------------------------ |
| `get` | `not-found`         | `readString` が `null` か `undefined` を返した                                       |
| `get` | `invalid-json`      | 読んだ文字列を JSON として復元できなかった。`error.cause` は `SyntaxError`           |
| `set` | `non-finite-number` | 値に `NaN` か `Infinity` が含まれている。JSON にすると `null` になるため保管しません |
| `set` | `not-serializable`  | 循環参照などで JSON にできなかった。`error.cause` は `TypeError`                     |

```ts
const result = await products.get("note");
if (result.type === "Failure" && result.error.kind === "not-found") {
  await products.set("note", { name: "ノート", price: 300 });
}
```

`readString` と `writeString` が投げた例外は、`get` と `set` からそのまま投げられます。

## 型が保たれる根拠

`get` が返す値の型を `T` と言える理由は、次の三つです。

- `get` と `set` は一つの `T` から一緒に作られます。`get` に型引数はなく、読む側が型を選べません。
- `set` は `T` の値だけを受け取ります。
- JSON からの復元は、`readString` が返した文字列にだけ適用されます。任意の文字列を `T` として読む関数はありません。

保証するのは、このプログラムのコードが自分自身と矛盾しないことです。保管されている値の形は検証しません。

## 保管できる型

変換の方式は `JSON.stringify` と `JSON.parse` に固定です。`T` に指定できるのは、JSON にして戻しても形が変わらない型だけです。

```ts
createJsonStore<{ name: string; tags: string[] }>({ readString, writeString }); // 指定できる

createJsonStore<{ createdAt: Date }>({ readString, writeString }); // コンパイルエラー
```

`Date` は JSON にすると文字列になり、`Map` は `{}` になり、`undefined` のプロパティは消えます。こうした型は、戻したときに `T` と一致しないため指定できません。日時を保管するときは、ISO 形式の文字列など、JSON でそのまま表せる型に直してから渡します。

## 利用する側が守る前提

次の点は型で確かめられないため、利用する側が守ります。

- `readString(key)` は、同じ `key` で `writeString` した文字列を返す。`readString` と `writeString` で prefix がずれていると、別の値を `T` として読むことになります。
- 同じ保管場所に対して、異なる `T` で `createJsonStore` を呼ばない。保管場所ごとの型の定義は一か所に置きます。
- 保管されている値の形を変えるときは、移行を別に行う。以前の版が書いた値や、ほかのシステムが書いた値は、このモジュールの保証の対象外です。DB のスキーマを変えるときと同じ扱いです。
- データだけを持つクラスのインスタンスを渡さない。型の上では普通のオブジェクトと区別できず、取り出した値はプロトタイプを持ちません。

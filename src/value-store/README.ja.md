# value-store

[English](README.md) | 日本語 · [README に戻る](../../README.ja.md)

## 有効期間を持つ参照を作る

`createKeyedValueView` に元の値を読む関数を渡します。`bind` に同じオブジェクトを渡すと、元の値の公開メンバーを転送する Proxy を受け取れます。この例では、編集を終了すると参照から下書きを読めなくなります。

```ts
import { createKeyedValueView } from "as-free";

const draft = { text: "下書き" };
let editing = true;

const view = createKeyedValueView(() => {
  if (!editing) throw new Error("編集は終了しました");
  return draft;
});

const result = view.bind(draft);
if (result.ok) {
  console.log(result.value.text); // 下書き
  editing = false;
  // result.value.text を読むと Error
}
```

## 型付きキーで値を保管する

`KeyedValueStore` は、一つのストアに異なる型の値を保管できます。登録と取得で同じ `ValueKey<T>` を使うと、そのキーに対応する型で値を取り出せます。

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

`ValueKey<T>` の型パラメータは不変です。保管先は非公開で、`set` はそのキーの `T` に合う値だけを受け取ります。これが、`WeakMap` から取り出した値の型を復元できる根拠です。

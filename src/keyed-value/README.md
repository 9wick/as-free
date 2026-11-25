# keyed-value

## 一覧からキー付きのオブジェクトを作る

`toEntries(items, keyField, valueField)` は、各要素の指定した2つのフィールドを `[key, value]` にします。固定長の `readonly` タプルを渡すと、各位置のキーと値の型を保ったペアが得られます。

```ts
import { fromEntries, toEntries } from "type-proof"

const items = [
	{ name: "price", value: 300 },
	{ name: "title", value: "ノート" },
] as const

const pairs = toEntries(items, "name", "value")
const product = fromEntries(pairs)

product.price // 型は 300
product.title // 型は "ノート"
```

通常の配列を渡す場合、同じペアのキーと値の型は対応しますが、結果の長さは配列型のままです。`fromEntries` に渡すには、入力に各ペアが揃っていることが型で分かる必要があります。

## ペアからオブジェクトを作る

手元にある `[key, value]` のペアを `fromEntries` に渡します。キーと値のリテラル型を保ったオブジェクトを受け取れます。

```ts
import { fromEntries } from "type-proof"

const pairs = [
	["name", "ノート"],
	["price", 300],
] as const

const product = fromEntries(pairs)
product.name // 型は "ノート"
product.price // 型は 300
```

入力は固定長の `readonly` タプルです。各ペアのキーには、一つに確定した文字列リテラルか `unique symbol` を指定します。同じキーが複数ある場合は、最後の値とその型を採用します。

長さの決まらない配列など、キーが必ずあると言えない入力を渡すと、戻り値が「理由を名前にしたプロパティだけを持つ型」になります。その結果から `product.price` などを読んだ時点でコンパイルエラーになります。

```ts
const rows: readonly (readonly ["price", number])[] = []

const product = fromEntries(rows)
product.price
// エラー: Property 'price' does not exist on type
// '{ readonly "fromEntries needs a fixed-length tuple"?: never }'
```

## 関数を登録してから呼ぶ

関数も `[key, value]` の値として登録できます。変換後のオブジェクトから関数を取り出して呼ぶと、キーごとの引数と戻り値の型が使えます。

```ts
import { fromEntries } from "type-proof"

const handlers = fromEntries([
	["count", (n: number) => n * 2],
	["label", async (n: number) => `残り ${n} 個`],
] as const)

const count = handlers.count(3) // number
const label = await handlers.label(3) // string
```

`fromEntries` は関数を値として格納します。呼び出しと `await` は、取り出した関数を使う箇所に書きます。

## すべての値を写す

`mapValues` は配列の `map` のオブジェクト版です。2つ目の引数の関数をすべての値に適用し、結果を同じキーに置きます。型引数は書きません。

```ts
import { mapValues } from "type-proof"

const doubled = mapValues({ a: 1, b: 2 }, (n) => n * 2)
// { a: number; b: number }

const boxes = { price: { value: 300 }, title: { value: "ノート" } }
const values = mapValues(boxes, (box) => box.value)
// { price: string | number; title: string | number }
```

値の型がキーごとに違うと、結果の型は全キー共通になります。TypeScript は、渡された関数をキーごとに当てはめた型を計算できないためです。型が実際の値と食い違うことはありません。

キーごとの型を保つには、入力の型を結果の型 `R` から書いた関数の中で呼びます。

```ts
const unboxAll = <R>(source: { readonly [K in keyof R]: { readonly value: R[K] } }) =>
	mapValues(source, (box) => box.value)

const product = unboxAll(boxes)
// { price: number; title: string }
```

省略できるキーは、結果でも省略できるキーになります。

名前を持つ要素の配列は、`mapValues` で `[名前, 値]` のペアに写してから `fromEntries` に渡します。

```ts
import { fromEntries, mapValues } from "type-proof"

type Named = { readonly name: string }
type NameOf<Item> = Item extends Named ? Item["name"] : never

type Positions<P> = { readonly [I in keyof P]: Named & { readonly value: P[I] } }
type Fields<T extends readonly Named[], P> = {
	readonly [I in keyof T]: { readonly name: NameOf<T[I]>; readonly value: P[I & keyof P] }
}
type Pairs<T extends readonly Named[], P> = {
	readonly [I in keyof T]: readonly [NameOf<T[I]>, P[I & keyof P]]
}

const byName = <const T extends readonly Named[], const P>(fields: T & Positions<P> & Fields<T, P>) =>
	fromEntries(mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, field.value]))

const product = byName([
	{ name: "price", value: 300 },
	{ name: "title", value: "ノート" },
])
product.price // number
product.title // string
```

配列の場合は、`P` に `extends readonly unknown[]` を付けず、名前の型は `T[I]["name"]` ではなく `NameOf<T[I]>` と書きます。どちらかを崩すと TypeScript の検査が緩み、`[field.name, 123]` のような誤った関数が通ります。

## 有効期間を持つ参照を作る

`createKeyedValueView` に元の値を読む関数を渡します。`bind` に同じオブジェクトを渡すと、元の値の公開メンバーを転送する Proxy を受け取れます。この例では、編集を終了すると参照から下書きを読めなくなります。

```ts
import { createKeyedValueView } from "type-proof"

const draft = { text: "下書き" }
let editing = true

const view = createKeyedValueView(() => {
	if (!editing) throw new Error("編集は終了しました")
	return draft
})

const result = view.bind(draft)
if (result.ok) {
	console.log(result.value.text) // 下書き
	editing = false
	// result.value.text を読むと Error
}
```

## 型付きキーで値を保管する

`KeyedValueStore` は、一つのストアに異なる型の値を保管できます。登録と取得で同じ `ValueKey<T>` を使うと、そのキーに対応する型で値を取り出せます。

```ts
import { KeyedValueStore, ValueKey } from "type-proof"

const store = new KeyedValueStore()
const title = new ValueKey<string>()
const quantity = new ValueKey<number>()
store.set(title, "ノート")
store.set(quantity, 12)

store.get(title) // string | undefined
store.get(quantity) // number | undefined
```

`ValueKey<T>` の型パラメータは不変です。保管先は非公開で、`set` はそのキーの `T` に合う値だけを受け取ります。これが、`WeakMap` から取り出した値の型を復元できる根拠です。

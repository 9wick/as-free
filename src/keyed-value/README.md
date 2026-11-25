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

`mapValues` は、配列の `map` のオブジェクト版です。

```ts
[1, 2, 3].map((n) => n * 2) // [2, 4, 6]

mapValues({ a: 1, b: 2 }, (n) => n * 2) // { a: 2, b: 4 }
```

1つ目の引数が元のオブジェクト、2つ目の引数が「値を1つ受け取り、新しい値を1つ返す関数」です。この関数を、以下では「写し方」と呼びます。`mapValues` は写し方をすべての値に適用し、結果を同じキーに置きます。キーは変わりません。

### どういうときに `as` を付けたくなるか

値が `{ value: ... }` に包まれているオブジェクトから、中身だけのオブジェクトを作るとします。

```ts
const boxes = {
	price: { value: 300 },
	title: { value: "ノート" },
}

// 欲しい結果: { price: 300, title: "ノート" }
// 欲しい型:   { price: number; title: string }
```

どんなオブジェクトにも使える関数にするには、キーを1つずつ書けないので、ループを使います。ループを通すと「`price` の結果は `price` の中身」という対応が型から消え、どの値も `number | string` になります。そこで最後に `as` を付けたくなります。

```ts
const unboxAll = <T extends Record<string, { value: unknown }>>(boxes: T) =>
	Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, box.value])) as {
		[K in keyof T]: T[K]["value"]
	}
```

この `as` は、写し方を `([key, box]) => [key, 123]` に書き間違えても通ります。

### `mapValues` での書き方

```ts
import { mapValues } from "type-proof"

type Boxes<R> = { readonly [K in keyof R]: { readonly value: R[K] } }

const unboxAll = <R>(boxes: Boxes<R>) =>
	mapValues<Boxes<R>, R>(boxes, (box) => box.value)

const product = unboxAll(boxes)
product.price // number
product.title // string
```

`as` はありません。順に読むと次のとおりです。

- **`R` は結果の型です。** この例では `{ price: number; title: string }` です。`unboxAll(boxes)` と呼ぶと、渡した値から TypeScript が決めます。
- **`Boxes<R>` は入力の型です。** 「キー `K` の値は、`R[K]` を包んだ `{ value: R[K] }`」と読みます。入力の型を、結果の型 `R` を使って書いているのが要点です。
- **`mapValues<Boxes<R>, R>(...)` の2つの型は、入力の型と結果の型です。**
- **`(box) => box.value` が写し方です。**

入力の型を `R` を使って書くと、TypeScript が写し方を検査できます。写し方は「`{ value: R[K] }` を受け取り、`R[K]` を返す関数」でなければなりません。`box.value` の型は `R[K]` なので通ります。書き間違えると、利用側でコンパイルエラーになります。

```ts
const broken = <R>(boxes: Boxes<R>) =>
	mapValues<Boxes<R>, R>(boxes, () => 123)
// エラー: Type 'number' is not assignable to type 'R[K]'
```

つまり、`as` で言い張っていた対応を、TypeScript に検査させる書き方に変えています。

値が包みではなく関数でも、書き方は同じです。入力の型と写し方だけが変わります。

```ts
type Getters<R> = { readonly [K in keyof R]: () => R[K] }

const readAll = <R>(getters: Getters<R>) =>
	mapValues<Getters<R>, R>(getters, (get) => get())

readAll({ price: () => 300, title: () => "ノート" }) // { price: number; title: string }
```

省略できるキーは、結果でも省略できるキーになります。写すのは、スプレッド構文(`{ ...source }`)がコピーするのと同じキーです。

### 名前付きの一覧から、名前ごとの結果を作る

入力がオブジェクトではなく、名前を持つ要素の配列の場合です。

```ts
const fields = [
	{ name: "price", value: 300 },
	{ name: "title", value: "ノート" },
]

// 欲しい結果: { price: 300, title: "ノート" }
// 欲しい型:   { price: number; title: string }
```

2段階で作ります。

1. `mapValues` で、各要素を `[名前, 値]` のペアに写す。結果は `[["price", 300], ["title", "ノート"]]` です。
2. `fromEntries` で、ペアの配列をオブジェクトにする。

```ts
import { fromEntries, mapValues } from "type-proof"

type Named = { readonly name: string }
type NameOf<Item> = Item extends Named ? Item["name"] : never

// 入力の型: 位置 I の要素は、T[I] の名前と、P[I] の値を持つ
type Fields<T extends readonly Named[], P> = {
	readonly [I in keyof T]: { readonly name: NameOf<T[I]>; readonly value: P[I & keyof P] }
}
// 結果の型: 位置 I は [T[I] の名前, P[I]] のペア
type Pairs<T extends readonly Named[], P> = {
	readonly [I in keyof T]: readonly [NameOf<T[I]>, P[I & keyof P]]
}
// P を TypeScript に決めさせるための型
type Positions<P> = { readonly [I in keyof P]: Named & { readonly value: P[I] } }

const byName = <const T extends readonly Named[], const P>(fields: T & Positions<P> & Fields<T, P>) =>
	fromEntries(mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, field.value]))

const product = byName([
	{ name: "price", value: 300 },
	{ name: "title", value: "ノート" },
])
product.price // number
product.title // string
```

考え方はオブジェクトの場合と同じです。違いは、型引数が2つになることです。

- **`T` は渡した配列そのものの型です。** 名前(`"price"`、`"title"`)はここから取ります。
- **`P` は位置ごとの値の型です。** この例では `[300, "ノート"]` です。
- **`Fields<T, P>` が入力の型、`Pairs<T, P>` が結果の型です。** どちらも `T` と `P` を使って書きます。
- **`(field) => [field.name, field.value]` が写し方です。**

この書き方では、次の2点を守ります。守らないと、TypeScript が写し方の検査を緩め、書き間違いが通ります。

- **`P` に `extends readonly unknown[]` を付けない。** 付けると、`(field) => [field.name, 123]` がコンパイルを通ります。`title` の中身が `123` なのに、型は `string` のままになります。
- **名前の型は `T[I]["name"]` ではなく `NameOf<T[I]>` と書く。** `T[I]["name"]` と書くと、`(field) => ["title", field.value]` のように別の名前を付ける写し方が通ります。

どちらも、配列の制約が付いた型引数について、TypeScript が代入の検査を緩めることが原因です。オブジェクトの場合には、この穴はありません。

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

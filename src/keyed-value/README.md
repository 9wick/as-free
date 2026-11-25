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

`mapValues(source, fn)` は、オブジェクトか固定長タプルのすべての値に `fn` を適用し、結果を同じキー(タプルなら同じ位置)に置きます。値をどう写すかは `fn` に書きます。関数を呼ぶ、計算する、別の形に包む、のどれでも同じ書き方です。

### どういうときに `as` を付けたくなるか

値がすべて「読むと値を返す関数」のオブジェクトから、読んだ結果のオブジェクトを作る関数を書くとします。

```ts
const getters = {
	price: () => 300,
	title: () => "ノート",
}

// 欲しい結果: { price: number; title: string }
```

どんなオブジェクトにも使える関数にするには、キーを一つずつ書けないのでループを使います。ループを通ると「`price` には `price` の関数の結果が入る」という対応が型から消えるので、最後に `as` を付けたくなります。

```ts
const readAll = <T extends Record<string, () => unknown>>(getters: T) =>
	Object.fromEntries(Object.entries(getters).map(([key, get]) => [key, get()])) as {
		[K in keyof T]: ReturnType<T[K]>
	}
```

### `mapValues` での書き方

```ts
import { mapValues } from "type-proof"

type Getters<R> = { readonly [K in keyof R]: () => R[K] }

const readAll = <R>(getters: Getters<R>) =>
	mapValues<Getters<R>, R>(getters, (get) => get())

const product = readAll(getters)
product.price // number
product.title // string
```

書くことは3つです。

1. **結果の型を型引数 `R` にする。** この例の `R` は `{ price: number; title: string }` です。`readAll(getters)` と呼ぶと、渡した値から TypeScript が推論します。
2. **入力の型を `R` から作る。** `Getters<R>` は「キー `K` の値は、`R[K]` を返す関数」という型です。
3. **`mapValues<入力の型, 結果の型>(値, fn)` と呼ぶ。** `fn` には、値を一つ受け取って結果を一つ返す処理を書きます。

入力の型を `R` から作るのは、`fn` を TypeScript に検査させるためです。`fn` は「`() => R[K]` を受け取って `R[K]` を返す」関数として、すべてのキー `K` について検査されます。`get()` の型は `R[K]` なので通ります。別のキーの値や決まった値を返す `fn` は、`R[K]` に合わないのでコンパイルエラーになります。

```ts
const broken = <R>(getters: Getters<R>) =>
	mapValues<Getters<R>, R>(getters, () => 123)
// エラー: Type 'number' is not assignable to type 'R[K]'
```

`mapValues` が結果の型を言い切れる根拠は、この検査です。`fn` が正しいことを利用側のコンパイラが確かめているので、ライブラリは「キー `K` で計算した結果をキー `K` に置く」ことだけを保証します。

省略できるキーは、結果でも省略できるキーになります。写すのは、スプレッド構文(`{ ...source }`)がコピーするのと同じキーです。

### 名前付きの一覧から、名前ごとの結果を作る

一覧の各要素を `[名前, 結果]` のペアに写し、`fromEntries` に渡します。

```ts
import { fromEntries, mapValues } from "type-proof"

type Named = { readonly name: string }
type NameOf<Item> = Item extends Named ? Item["name"] : never

// P は位置ごとの結果の型。この型は P を推論させるためだけに使う
type Positions<P> = { readonly [I in keyof P]: Named & { readonly read: () => P[I] } }
// 位置 I の要素は、T[I] の名前を持ち、P[I] を返す
type Fields<T extends readonly Named[], P> = {
	readonly [I in keyof T]: { readonly name: NameOf<T[I]>; readonly read: () => P[I & keyof P] }
}
// 位置 I の結果は、[T[I] の名前, P[I]] のペア
type Pairs<T extends readonly Named[], P> = {
	readonly [I in keyof T]: readonly [NameOf<T[I]>, P[I & keyof P]]
}

const readByName = <const T extends readonly Named[], const P>(fields: T & Positions<P> & Fields<T, P>) =>
	fromEntries(mapValues<Fields<T, P>, Pairs<T, P>>(fields, (field) => [field.name, field.read()]))

const product = readByName([
	{ name: "price", read: () => 300 },
	{ name: "title", read: () => "ノート" },
])
product.price // number
product.title // string
```

オブジェクトの場合と考え方は同じで、入力の型(`Fields`)と結果の型(`Pairs`)を、位置ごとの結果 `P` から作ります。名前は各要素が持つ `name` をそのまま使うので、書き直す必要はありません。

この書き方では、次の2点を守ります。守らないと、TypeScript が `fn` の検査を緩め、誤った `fn` が通ります。

- **`P` に `extends readonly unknown[]` を付けない。** 付けると、`[field.name, 123]` のように決まった値を返す `fn` がコンパイルを通ります。TypeScript は配列の制約が付いた型引数について、`P[I]` への代入を「配列の要素の型(`unknown`)に代入できるか」で検査するためです。
- **名前は `T[I]["name"]` ではなく `NameOf<T[I]>` と書く。** `T[I]["name"]` と書くと、同じ理由で `["title", field.read()]` のように別の名前を付ける `fn` が通ります。

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

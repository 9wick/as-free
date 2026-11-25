# keyed-value

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

`mapValues` は配列の `map` のオブジェクト版です。2つ目の引数の関数をすべての値に適用し、結果を同じキーに置きます。結果の型はキーごとに決まります。

```ts
import { mapValues } from "type-proof"

const boxes = { price: { value: 300 }, title: { value: "ノート" } }
const values = mapValues(boxes, (box) => box.value)
values.price // number
values.title // string

const getters = { count: () => 3, label: async () => "残り 3 個" }
const results = mapValues(getters, (get) => get())
results.count // number
results.label // Promise<string>
```

キーごとの型になるのは、受け取った値からプロパティを読んだ結果と、関数を呼んだ結果です。`String(box.value)` のように計算した結果は、全キーで同じ型になります。関数の中で `await` した結果は、キーごとの型にならず、粗い型になります。

名前を持つ要素の配列は、`[名前, 値]` のペアに写してから `fromEntries` に渡します。

```ts
import { fromEntries, mapValues } from "type-proof"

const product = fromEntries(
	mapValues(
		[
			{ name: "price", value: 300 },
			{ name: "title", value: "ノート" },
		],
		(field) => [field.name, field.value] as const,
	),
)
product.price // 型は 300
product.title // 型は "ノート"
```

`mapValues` の関数の中でもう一度 `mapValues` を呼ぶとき、外側で受け取った値を内側からそのまま返すとコンパイルエラーになります。値の型がまだ決まっていない総称関数の中でも使えません。

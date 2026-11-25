# keyed-value

[English](README.md) | 日本語 · [README に戻る](../../README.ja.md)

## ペアからオブジェクトを作る

手元にある `[key, value]` のペアを `fromEntries` に渡します。キーと値のリテラル型を保ったオブジェクトを受け取れます。

```ts
import { fromEntries } from "as-free";

const pairs = [
  ["name", "ノート"],
  ["price", 300],
] as const;

const product = fromEntries(pairs);
product.name; // 型は "ノート"
product.price; // 型は 300
```

入力は固定長のタプルで、各ペアは `readonly` です。各ペアのキーには、一つに確定した文字列リテラルか `unique symbol` を指定します。同じキーが複数ある場合は、最後の値とその型を採用します。

長さの決まらない配列など、キーが必ずあると言えない入力を渡すと、戻り値が「理由を名前にしたプロパティだけを持つ型」になります。その結果から `product.price` などを読んだ時点でコンパイルエラーになります。

```ts
const rows: readonly (readonly ["price", number])[] = [];

const product = fromEntries(rows);
product.price;
// エラー: Property 'price' does not exist on type
// '{ readonly "fromEntries needs a fixed-length tuple"?: never }'
```

## 関数を登録してから呼ぶ

関数も `[key, value]` の値として登録できます。変換後のオブジェクトから関数を取り出して呼ぶと、キーごとの引数と戻り値の型が使えます。

```ts
import { fromEntries } from "as-free";

const handlers = fromEntries([
  ["count", (n: number) => n * 2],
  ["label", async (n: number) => `残り ${n} 個`],
] as const);

const count = handlers.count(3); // number
const label = await handlers.label(3); // string
```

`fromEntries` は関数を値として格納します。呼び出しと `await` は、取り出した関数を使う箇所に書きます。

## すべての値を写す

`mapValues` は配列の `map` のオブジェクト版です。2つ目の引数の関数をすべての値に適用し、結果を同じキーに置きます。結果の型はキーごとに決まります。

```ts
import { mapValues } from "as-free";

const boxes = { price: { value: 300 }, title: { value: "ノート" } };
const values = mapValues(boxes, (box) => box.value);
values.price; // number
values.title; // string

const getters = { count: () => 3, label: async () => "残り 3 個" };
const results = mapValues(getters, (get) => get());
results.count; // number
results.label; // Promise<string>
```

名前を持つ要素の配列は、`[名前, 値]` のペアに写してから `fromEntries` に渡します。

```ts
import { fromEntries, mapValues } from "as-free";

const fields = [
  { name: "price", read: () => 300 },
  { name: "title", read: () => "ノート" },
] as const;

const product = fromEntries(mapValues(fields, (field) => [field.name, field.read()] as const));
product.price; // number
product.title; // string
```

この処理を関数にまとめるときは、引数の型が広がらないように、渡された値の型を型引数で受け取ります。

```ts
type Field = { readonly name: string; read(): unknown };

const readByName = <const Fields extends readonly Field[]>(list: Fields) =>
  fromEntries(mapValues(list, (field) => [field.name, field.read()] as const));
```

`mapValues` の関数の中でもう一度 `mapValues` を呼ぶとき、外側で受け取った値を内側からそのまま返すとコンパイルエラーになります。オーバーロードのある関数を呼んだ結果は、キーごとの型になりません。

## 空のときだけ省略できる field を取り出す

field の型が `P` で、`P` に key がないときだけ省略できるようにするには、`OptionalWhenEmpty` で型を組み立てます。generic な関数の中では、`fieldOrEmpty` で field を `P` 型の値として取り出せます。field が省略されていれば、空のオブジェクトを返します。

```ts
import { fieldOrEmpty, type OptionalWhenEmpty } from "as-free";

type Job<P> = { readonly run: (input: P) => void } & OptionalWhenEmpty<"input", P>;

const runJob = <P extends object>(job: Job<P>) => job.run(fieldOrEmpty<"input", P>(job, "input"));

runJob({ run: () => {} });
runJob({ input: { id: 1 }, run: ({ id }) => console.log(id) });
```

型引数 `P` は推論されないので、field 名と一緒に明示します。

次の `P` では field を省略できず、コンパイルエラーになります。

- key を持つ型。key が省略可能な場合や、`Record<string, X>` のような index signature の場合も含みます。
- 関数型、コンストラクタ型、private なメンバーだけを持つ class。空のオブジェクトはこれらの値になりません。

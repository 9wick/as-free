# get-or-empty

[English](README.md) | 日本語 · [README に戻る](../../README.ja.md)

## 空のときだけ省略できる field を取り出す

field の型が `P` で、`P` に key がないときだけ省略できるようにするには、`OmittableIfEmpty` で型を組み立てます。generic な関数の中では、`getOrEmpty` で field を `P` 型の値として取り出せます。field が省略されていれば、空のオブジェクトを返します。

```ts
import { getOrEmpty, type OmittableIfEmpty } from "as-free";

type Job<P> = { readonly run: (input: P) => void } & OmittableIfEmpty<"input", P>;

const runJob = <P extends object>(job: Job<P>) => job.run(getOrEmpty<"input", P>(job, "input"));

runJob({ run: () => {} });
runJob({ input: { id: 1 }, run: ({ id }) => console.log(id) });
```

型引数 `P` は推論されないので、field 名と一緒に明示します。

次の `P` では field を省略できず、コンパイルエラーになります。

- key を持つ型。key が省略可能な場合や、`Record<string, X>` のような index signature の場合も含みます。
- 関数型、コンストラクタ型、private なメンバーだけを持つ class。空のオブジェクトはこれらの値になりません。

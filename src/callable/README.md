# callable

## オーバーロードを保ったまま呼び出しを転送する

`defineForwarder` に、関数の型と、呼び出しを転送する処理を渡します。渡した型そのものを持つ関数を受け取れます。呼び出し側では、元の関数と同じオーバーロードがそのまま使えます。

```ts
import { defineForwarder } from "as-free";

type Format = {
  (value: number, digits: number): string;
  (value: Date): string;
};

declare const format: Format;
let calls = 0;

const countedFormat = defineForwarder<[Format]>((args, forward) => {
  calls += 1;
  return forward(format, args);
});

countedFormat(3.14159, 2); // string
countedFormat(new Date()); // string
countedFormat("3.14"); // コンパイルエラー
```

`args` は、渡した型のどれかのオーバーロードの引数です。`forward(f, args)` は `args` で `f` を呼び、その結果を返します。外側の関数は、受け取った `this` をそのまま `f` に渡します。

戻り値の型も、オーバーロードごとに保たれます。型引数を持つ関数でも同じです。

```ts
type First = <T>(items: readonly T[]) => T | undefined;

declare const first: First;
const loggedFirst = defineForwarder<[First]>((args, forward) => {
  console.log("first", args[0].length);
  return forward(first, args);
});

loggedFirst([1, 2, 3]); // number | undefined
```

複数の関数へ同じ引数を転送して、何も返さないこともできます。`undefined` を返せるのは、どのオーバーロードの戻り値も `undefined` を受け付けるときだけです。

```ts
type Listener = {
  (event: "open"): void;
  (event: "close", code: number): void;
};

declare const listeners: readonly Listener[];

const notifyAll = defineForwarder<[Listener]>((args, forward) => {
  for (const listener of listeners) forward(listener, args);
  return undefined;
});
```

## 引数で転送先を振り分ける

型を複数並べると、それらすべてのオーバーロードを持つ関数を受け取れます。`whenArg(args, index, guard)` で、`index` 番目の引数が `guard` を満たすかどうかで振り分けます。それぞれの分岐の `args` は、その分岐に来うるオーバーロードの引数に絞られます。

```ts
import { defineForwarder, whenArg } from "as-free";

type OpenByPath = (path: string) => Handle;
type OpenWithOptions = (options: { readonly path: string; readonly readOnly: boolean }) => Handle;

declare const openByPath: OpenByPath;
declare const openWithOptions: OpenWithOptions;
const isString = (value: unknown): value is string => typeof value === "string";

const open = defineForwarder<[OpenByPath, OpenWithOptions]>((args, forward) => {
  const r = whenArg(args, 0, isString);
  return r.matched ? forward(openByPath, r.args) : forward(openWithOptions, r.args);
});

open("/tmp/a.txt"); // Handle
open({ path: "/tmp/a.txt", readOnly: true }); // Handle
```

分岐を取り違えて `forward(openWithOptions, r.args)` を `matched` の側に書くと、コンパイルエラーになります。

## 関数かどうかを判定する

`isFunction(value)` は、値が関数なら `(...args: never[]) => unknown` に絞り込みます。`typeof value === "function"` で得られる `Function` 型と違い、関数を受け取る引数やプロパティにそのまま渡せます。

```ts
import { isFunction } from "as-free";

const handlers = new Map<string, (...args: never[]) => unknown>();

const register = (name: string, value: unknown): void => {
  if (isFunction(value)) handlers.set(name, value);
};
```

絞り込んだ値の引数は `never[]` なので、引数の型が分からないまま呼ぶことはできません。

## 型が保たれる根拠

外側の関数の型を `F` とします。`F` は `defineForwarder` に渡した型を並べたものです。`F` の各オーバーロードが返すと宣言した型を、外側の関数が実際に返す理由は次のとおりです。

- 外側の関数の型は、ライブラリが `F` として作ります。利用する側はオーバーロードを書かないので、受け付ける引数を広げられません。
- `args` は読み取り専用です。転送する処理の中で書き換えられません。
- `forward` に渡せる引数は、今回の呼び出しで受け取った `args` か、`whenArg` で絞ったものだけです。自分で作った配列や、別の呼び出しの引数は渡せません。
- `forward` に渡せる関数は、`F` を構成する型の値だけです。さらに、その関数が受け付ける引数に `args` が絞られている必要があります。
- 返せる値は、今回の呼び出しで `forward` が返したものだけです。以前の呼び出しの結果を保存しておき、別の呼び出しで返すことはできません。

この結果、外側の関数はいつも「受け取ったのと同じ引数で、`F` のオーバーロードを持つ関数を呼んだ結果」を返します。その値は、`F` がその引数について宣言した型を持ちます。

## 利用する側が守る前提

`whenArg` に渡す `guard` の中身は、TypeScript が確かめません。`guard` が `true` を返した値は、型述語に書いた型を必ず満たす必要があります。

```ts
const isString = (value: unknown): value is string => typeof value === "number"; // 型では検出できない
```

`guard` は、実行時に来た値の形を検査する関数です。外部入力の検証と同じように、型述語と中身を一致させます。

## できないこと

次の処理は、上の根拠が成り立たないため書けません。

- 前の関数の結果で引数を差し替えて、次の関数を呼ぶ処理。差し替えた引数で呼んだ結果は、受け取った引数についての宣言と結び付きません。
- 転送せずに新しい値を作って返す処理。その値がオーバーロードの宣言どおりだと示す方法がありません。
- オーバーロードを6つ以上持つ関数の転送。`defineForwarder` の呼び出しがコンパイルエラーになります。一部のオーバーロードを黙って取りこぼすことはありません。

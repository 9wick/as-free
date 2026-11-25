import { createJsonStore } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

type Product = { readonly name: string; readonly price: number; readonly tags: readonly string[]; note?: string };

const storage = new Map<string, string>();
const readString = (key: string) => storage.get(`product:${key}`);
const writeString = (key: string, text: string) => {
  storage.set(`product:${key}`, text);
};

const products = createJsonStore<Product>({ readString, writeString });

const written = await products.set("note", { name: "ノート", price: 300, tags: ["紙"] });
equal(written.type, "Success");
equal(storage.get("product:note"), '{"name":"ノート","price":300,"tags":["紙"]}');

const found = await products.get("note");
if (found.type !== "Success") throw new Error("Expected the stored product");
const product: Product = found.value;
equal(product.name, "ノート");
equal(product.price, 300);
equal(product.tags[0], "紙");

const missing = await products.get("pen");
if (missing.type !== "Failure") throw new Error("Expected a missing key to fail");
equal(missing.error.kind, "not-found");

storage.set("product:broken", "{");
const broken = await products.get("broken");
if (broken.type !== "Failure" || broken.error.kind !== "invalid-json") throw new Error("Expected invalid JSON to fail");
equal(broken.error.cause instanceof SyntaxError, true);

const nonFinite = await products.set("nan", { name: "ノート", price: Number.NaN, tags: [] });
if (nonFinite.type !== "Failure") throw new Error("Expected NaN to be rejected");
equal(nonFinite.error.kind, "non-finite-number");
equal(storage.has("product:nan"), false);

type Tree = { readonly label: string; readonly children: readonly Tree[] };
const trees = createJsonStore<Tree>({ readString, writeString });
const cyclic: { label: string; children: Tree[] } = { label: "根", children: [] };
cyclic.children.push(cyclic);
const notSerializable = await trees.set("cyclic", cyclic);
if (notSerializable.type !== "Failure" || notSerializable.error.kind !== "not-serializable") {
  throw new Error("Expected a cyclic value to be rejected");
}

const asyncStore = createJsonStore<number | null>({
  readString: async (key) => storage.get(key) ?? null,
  writeString: async (key, text) => {
    storage.set(key, text);
  },
});
await asyncStore.set("count", 3);
const count = await asyncStore.get("count");
equal(count.type === "Success" && count.value, 3);

let storageFailure: unknown;
try {
  await createJsonStore<string>({
    readString: () => {
      throw new Error("接続できません");
    },
    writeString,
  }).get("any");
} catch (cause) {
  storageFailure = cause;
}
equal(storageFailure instanceof Error && storageFailure.message, "接続できません");

function checkAcceptedTypes() {
  createJsonStore<string>({ readString, writeString });
  createJsonStore<readonly [number, "a" | "b"]>({ readString, writeString });
  createJsonStore<Record<string, boolean>>({ readString, writeString });
  createJsonStore<{ kind: "a"; value: number } | { kind: "b"; items: string[] }>({ readString, writeString });
}
void checkAcceptedTypes;

function checkRejectedInputs() {
  // @ts-expect-error A Date comes back as a string.
  createJsonStore<{ createdAt: Date }>({ readString, writeString });
  // @ts-expect-error A Map comes back as an empty object.
  createJsonStore<Map<string, number>>({ readString, writeString });
  // @ts-expect-error An undefined array element comes back as null.
  createJsonStore<(number | undefined)[]>({ readString, writeString });
  // @ts-expect-error A required property holding undefined is dropped.
  createJsonStore<{ note: string | undefined }>({ readString, writeString });
  // @ts-expect-error JSON cannot hold a bigint.
  createJsonStore<{ id: bigint }>({ readString, writeString });
  // @ts-expect-error A function is dropped.
  createJsonStore<{ run: () => void }>({ readString, writeString });
  // @ts-expect-error A symbol key is dropped.
  createJsonStore<{ [Symbol.iterator]: string }>({ readString, writeString });
  // @ts-expect-error unknown admits values that JSON reshapes.
  createJsonStore<unknown>({ readString, writeString });
  // @ts-expect-error any admits values that JSON reshapes.
  createJsonStore<any>({ readString, writeString });
  // @ts-expect-error object admits values that JSON reshapes.
  createJsonStore<object>({ readString, writeString });
  // @ts-expect-error One member of the union does not survive.
  createJsonStore<string | Date>({ readString, writeString });
  // @ts-expect-error The stored type has to be stated.
  createJsonStore({ readString, writeString });

  // @ts-expect-error The reader cannot choose the type.
  void products.get<string>("note");
  // @ts-expect-error set accepts only the stored type.
  void products.set("note", { name: "ノート" });
}
void checkRejectedInputs;

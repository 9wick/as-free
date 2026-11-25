import { createKeyedValueView, KeyedValueStore, ValueKey } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected value");
}

const counter = {
  count: 3,
  read: Object.assign(function (this: { count: number }) { return this.count; }, { label: "counter" }),
};
let source: object = counter;
const view = createKeyedValueView(() => source);
const pending = view.handle;
const wrongSource = view.bind({ count: 0 });
if (wrongSource.ok) throw new Error("A view must only bind to its own source");
const published = view.bind(counter);
if (!published.ok) throw new Error("Expected the current source to be bindable");
equal(typeof published.value, "object");
equal(Reflect.get(pending, "count"), 3);
const read = published.value.read;
equal(read.label, "counter");
equal(read.call({ count: 10 }), 10);

const values = [1, 2];
const arrayView = createKeyedValueView(() => values);
const pendingArray = arrayView.handle;
const publishedArray = arrayView.bind(values);
if (!publishedArray.ok) throw new Error("Expected the pending array view to be bindable");
equal(Array.isArray(publishedArray.value), true);
equal(Reflect.get(pendingArray, "1"), 2);
equal(publishedArray.value[1], 2);
equal(publishedArray.value.map((value) => value + 1).join(","), "2,3");

class Secret {
  #value = 3000;

  static hasBrand(value: object): value is Secret {
    return #value in value;
  }

  read(other: Secret): number {
    return other.#value;
  }
}

const withSecret = { first: new Secret(), second: new Secret() };
const secret = createKeyedValueView(() => withSecret).bind(withSecret);
if (!secret.ok) throw new Error("Expected the source to be bindable");
equal(Secret.hasBrand(secret.value.second), false);
equal(secret.value.first.read(withSecret.second), 3000);
function checkPrivateBrand() {
  if (!secret.ok) return;
  // @ts-expect-error A guarded projection does not carry the source's private fields.
  secret.value.first.read(secret.value.second);
  // @ts-expect-error A structural lookalike must not replace a branded source member.
  secret.value.second = { read: () => 3000 };
}

source = { count: 5 };
let changedSource: unknown;
try {
  read.call(counter);
} catch (error) {
  changedSource = error;
}
if (!(changedSource instanceof TypeError)) throw new Error("A bound view must reject a changed source");
void checkPrivateBrand;

const store = new KeyedValueStore();
const count = new ValueKey<number>();
const otherCount = new ValueKey<number>();
store.set(count, 42);
const stored: number | undefined = store.get(count);
if (stored !== 42 || store.get(otherCount) !== undefined) {
  throw new Error("Expected the value to belong to the exact key instance");
}

function checkRejectedInputs() {
  // @ts-expect-error A key determines the type of all writes.
  store.set(count, "42");
  // @ts-expect-error A read cannot reinterpret the key's type.
  store.get<string>(count);
  // @ts-expect-error Widening a key would allow another value type to be stored.
  const widened: ValueKey<unknown> = count;
  return widened;
}
void checkRejectedInputs;

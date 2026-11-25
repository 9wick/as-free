import { KeyedValueStore, ValueKey } from "type-proof";

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

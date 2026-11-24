import { KeyedValueStore, ValueKey } from "type-proof";
import { resolveNamedValues } from "type-proof/legacy";

function readPort(context: { port: number }): number;
function readPort(context: string): string;
function readPort(context: { port: number } | string): number | string {
  return typeof context === "string" ? context : context.port;
}

const symbol = Symbol("service");
const initial = resolveNamedValues({ port: 3000 });
const configured = initial
  .with("port", (context) => readPort(context))
  .with("__proto__", () => "own property")
  .with(symbol, () => Promise.resolve(1));

const output = configured.toObject();
const port: number = output.port;
const promise: Promise<number> = output[symbol];

const updated = configured.with("port", () => "3001").toObject();
const updatedPort: string = updated.port;
if (
  port !== 3000 ||
  await promise !== 1 ||
  updatedPort !== "3001" ||
  Object.hasOwn(initial.toObject(), "port") ||
  !Object.hasOwn(output, "__proto__") ||
  output.__proto__ !== "own property" ||
  !Object.isFrozen(output)
) {
  throw new Error("Expected independent, frozen snapshots with the registered keys and values");
}

const store = new KeyedValueStore();
const count = new ValueKey<number>();
const otherCount = new ValueKey<number>();
store.set(count, 42);
const stored: number | undefined = store.get(count);
if (stored !== 42 || store.get(otherCount) !== undefined) {
  throw new Error("Expected the value to belong to the exact key instance");
}

function checkRejectedInputs(
  unionKey: "a" | "b",
  dynamicKey: string,
  patternKey: `dep-${number}`,
  brandedKey: string & { readonly brand: "key" },
) {
  // @ts-expect-error One registration cannot guarantee both keys.
  initial.with(unionKey, () => 1);
  // @ts-expect-error Only the actual key exists in the snapshot.
  initial.with(dynamicKey, () => 1);
  // @ts-expect-error A template pattern can describe many keys.
  initial.with(patternKey, () => 1);
  // @ts-expect-error The brand does not identify a single property.
  initial.with(brandedKey, () => 1);
  // @ts-expect-error The runtime argument is a context object.
  initial.with("value", (context: string) => context.length);
  // @ts-expect-error A plain callback must select the overload for this context.
  initial.with("value", readPort);
  // @ts-expect-error A key determines the type of all writes.
  store.set(count, "42");
  // @ts-expect-error A read cannot reinterpret the key's type.
  store.get<string>(count);
  // @ts-expect-error Widening a key would allow another value type to be stored.
  const widened: ValueKey<unknown> = count;
  return widened;
}

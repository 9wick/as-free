import { createKeyedValueView, fromEntries } from "type-proof";
import {
  collectKeyedValues,
  collectKeyedValuesSync,
  type CompatibleKeyedMethods,
} from "type-proof/legacy";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected keyed collection value");
}

const config = fromEntries([["port", 3000], ["host", "localhost"], ["port", 3001]] as const);
const port: 3001 = config.port;
const host: "localhost" = config.host;
equal(port, 3001);
equal(host, "localhost");

let callsAfterConversion = 0;
const count = (value: number) => {
  callsAfterConversion++;
  return value * 2;
};
const label = async (value: number) => {
  callsAfterConversion++;
  return `残り ${value} 個`;
};
const handlers = fromEntries([["count", count], ["label", label]] as const);
equal(callsAfterConversion, 0);
equal(handlers.count, count);
equal(handlers.label, label);
const amount: number = handlers.count(3);
const pendingLabel: Promise<string> = handlers.label(3);
equal(amount, 6);
equal(await pendingLabel, "残り 3 個");
equal(callsAfterConversion, 2);

const customPairs = [["port", 3000]] as const;
Object.assign(customPairs, { [Symbol.iterator]: () => customPairs.slice(0, 0).values() });
equal(fromEntries(customPairs).port, 3000);

function checkPairs(entries: readonly (readonly ["port", number])[], key: "port" | "host") {
  // @ts-expect-error An array does not promise the port pair exists.
  fromEntries(entries);
  // @ts-expect-error The actual key could be either member of the union.
  fromEntries([[key, 3000]] as const);
  const mutable: [readonly ["port", number]] = [["port", 3000]];
  // @ts-expect-error A mutable tuple can lose its required position.
  fromEntries(mutable);
}

const calls: string[] = [];
class UserFeature {
  readonly key = "users";

  async realize(context: { readonly seed: number }) {
    calls.push("users:start");
    await Promise.resolve();
    calls.push("users:end");
    return { userCount: context.seed };
  }
}

class StatusFeature {
  readonly key = "status";

  realize(context: { readonly seed: number }) {
    calls.push("status");
    return { ready: context.seed > 0 };
  }
}

const userFeature = new UserFeature();
const statusFeature = new StatusFeature();
const collection = await collectKeyedValues([userFeature, statusFeature], "realize", { seed: 2 });
const { users, status } = collection.toObject();
equal(users.userCount, 2);
equal(status.ready, true);
equal(calls.join(","), "users:start,users:end,status");
equal(collection.rows.length, 2);

for (const row of collection.rows) {
  if (row.key === "users") {
    const item: UserFeature = row.item;
    equal(item, userFeature);
    equal(row.value, users);
  } else {
    const item: StatusFeature = row.item;
    equal(item, statusFeature);
    equal(row.value, status);
  }
}

const [userRow] = collection.forClass(UserFeature);
if (!userRow) throw new Error("Missing class row");
equal(userRow, collection.rows[0]);
equal(userRow.item, userFeature);
equal(userRow.value.userCount, 2);

const mapped = collection.mapValues((value, item) => {
  calls.push(item.key);
  return value;
});
equal(calls.join(","), "users:start,users:end,status,users,status");
equal(mapped.toObject().users, users);
equal(mapped.forClass(StatusFeature)[0]?.value, status);
equal(Object.isFrozen(collection.rows), true);
equal(Object.isFrozen(userRow), true);
equal(Object.isFrozen(mapped.toObject()), true);

const promise = Promise.resolve(7);
const token = Symbol("token");
const sync = collectKeyedValuesSync([
  { key: "__proto__", blueprint: () => promise },
  { key: token, blueprint: () => null },
  { key: "absent", blueprint: () => undefined },
  { key: "conditional", blueprint: (): { mode: string } | undefined => undefined },
  { key: "empty", blueprint: () => ({}) },
], "blueprint");
const raw = sync.toObject();
const storedPromise: Promise<number> = raw.__proto__;
equal(storedPromise, promise);
equal(raw[token], null);
equal(Object.hasOwn(raw, "__proto__"), true);
equal(Object.hasOwn(raw, "absent"), true);

const defined = sync.mapValues((value) => value).toDefinedObject();
const definedPromise: Promise<number> = defined.__proto__;
const empty: object = defined.empty;
const conditional: { mode: string } | undefined = defined.conditional;
equal(definedPromise, promise);
equal(Object.keys(empty).length, 0);
equal(conditional, undefined);
equal(Object.hasOwn(defined, "absent"), false);
equal(Object.hasOwn(defined, "conditional"), false);
equal(Object.isFrozen(defined), true);

const broad: readonly UserFeature[] = [];
const broadResult = (await collectKeyedValues(broad, "realize", { seed: 1 })).toObject();
const maybeUsers: { userCount: number } | undefined = broadResult.users;
equal(maybeUsers, undefined);

function checkDynamicKeys(
  key: string,
  template: `user-${number}`,
  union: "x" | "y",
) {
  const dynamic = collectKeyedValuesSync([{ key, read: () => 1 }], "read").toObject();
  const pattern = collectKeyedValuesSync([{ key: template, read: () => 1 }], "read").toObject();
  const either = collectKeyedValuesSync([{ key: union, read: () => 1 }], "read").toObject();
  // @ts-expect-error The collection only contains the runtime key.
  const unrelated: number = dynamic.other;
  // @ts-expect-error A template key need not be this particular literal.
  const first: number = pattern["user-1"];
  // @ts-expect-error Only one member of the key union exists.
  const x: number = either.x;
  return [unrelated, first, x];
}

function checkGenericCollection<const Items extends readonly UserFeature[]>(
  items: Items & NoInfer<CompatibleKeyedMethods<Items, "realize", [{ seed: number }]>>,
) {
  return collectKeyedValues<Items, "realize", { seed: number }>(items, "realize", { seed: 1 });
}

function readOverloaded(context: "port"): number;
function readOverloaded(context: "host"): string;
function readOverloaded(context: "port" | "host"): number | string {
  return context === "port" ? 3000 : "localhost";
}

function readOverlapping(context: "port"): number;
function readOverlapping(context: string): string;
function readOverlapping(context: string): number | string {
  return context === "port" ? 3000 : context;
}

class OverloadedFeature {
  readonly key = "overloaded";
  read = readOverloaded;
}

const narrowedFeature: { readonly key: "overloaded"; read(context: "port"): number } =
  new OverloadedFeature();
const selected = await collectKeyedValues([narrowedFeature], "read", "port" as const);
const [overloadedRow] = selected.forClass(OverloadedFeature);
if (!overloadedRow) throw new Error("Expected a matching feature");
const actualPort: number = overloadedRow.value;
equal(actualPort, 3000);
function checkOverloadResult() {
  if (!overloadedRow) return;
  // @ts-expect-error The selected row keeps the result of the port invocation.
  const host: string = overloadedRow.value;
  return host;
}

function checkRejectedInputs() {
  // @ts-expect-error The declared result from the last overload cannot apply to port.
  collectKeyedValues([{ key: "read", read: readOverloaded }], "read", "port" as const);
  // @ts-expect-error A broader final overload would hide the actual call result.
  collectKeyedValues([{ key: "read", read: readOverlapping }], "read", "port" as const);
  // @ts-expect-error The method reads a port from its receiver.
  collectKeyedValuesSync([{ key: "read", read(this: { port: number }) { return this.port; } }], "read");
  // @ts-expect-error The context must satisfy the method's parameter.
  collectKeyedValues([userFeature], "realize", { seed: "bad" });
  // @ts-expect-error The synchronous method must be callable without arguments.
  collectKeyedValuesSync([userFeature], "realize");
  // @ts-expect-error A possibly absent key cannot be treated as required.
  const required: { userCount: number } = broadResult.users;
  // @ts-expect-error Explicitly undefined values are omitted.
  defined.absent;
  // @ts-expect-error A maybe-undefined result does not guarantee presence.
  const alwaysPresent: { mode: string } = defined.conditional;
  // @ts-expect-error Mapping cannot replace a value with an arbitrary object.
  collection.mapValues(() => ({}));
  // @ts-expect-error One item's value cannot replace the others.
  collection.mapValues(() => users);
  // @ts-expect-error A different shape cannot be asserted through a generic argument.
  collection.mapValues(<Value,>(_value: Value) => 7);
  return { required, alwaysPresent };
}

const duplicates: readonly UserFeature[] = [new UserFeature(), new UserFeature()];
await collectKeyedValues(duplicates, "realize", { seed: 1 }).then(
  () => { throw new Error("Duplicate keys must be rejected"); },
  (error: unknown) => {
    if (!(error instanceof TypeError)) throw error;
  },
);
equal(calls.join(","), "users:start,users:end,status,users,status");

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

function checkOverlappingKeys(key: string) {
  const items: readonly [
    { readonly key: "a"; read(): number },
    ...{ readonly key: string; read(): boolean }[],
  ] = [{ key: "a", read: () => 1 }];
  const result = collectKeyedValuesSync(items, "read").toObject();
  const required: number = result.a;
  const indexed: unknown = result[key];
  // @ts-expect-error A dynamic key can also retrieve a prototype property.
  const onlyBoolean: boolean | undefined = result[key];
  return [required, indexed, onlyBoolean];
}

import { fromEntries } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected value");
}

const config = fromEntries([
  ["port", 3000],
  ["host", "localhost"],
  ["port", 3001],
] as const);
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
const handlers = fromEntries([
  ["count", count],
  ["label", label],
] as const);
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
  fromEntries(entries).port;
  // @ts-expect-error The actual key could be either member of the union.
  fromEntries([[key, 3000]] as const).port;
  const mutablePair: readonly [["port", number]] = [["port", 3000]];
  // @ts-expect-error A mutable pair can lose its key or value.
  fromEntries(mutablePair).port;
}

const symbol = Symbol("service");
const mixed = fromEntries([
  ["__proto__", "own property"],
  [symbol, 1],
] as const);
const marked: 1 = mixed[symbol];
equal(marked, 1);
equal(Object.hasOwn(mixed, "__proto__"), true);
equal(mixed.__proto__, "own property");
equal(Object.isFrozen(mixed), true);
void checkPairs;

// The tuple itself may be mutable, as the result of Promise.all is.
const awaited = await Promise.all([Promise.resolve(["port", 3000] as const), ["host", "localhost"] as const]);
const settled = fromEntries(awaited);
const settledPort: 3000 = settled.port;
equal(settledPort, 3000);
equal(settled.host, "localhost");

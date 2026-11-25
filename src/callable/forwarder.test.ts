import { defineForwarder, whenArg } from "type-proof";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected value");
}

type Format = {
  (value: number, digits: number): string;
  (value: Date): string;
};

const format: Format = (value: number | Date, digits?: number): string =>
  typeof value === "number" ? value.toFixed(digits) : value.toISOString();

let calls = 0;
const countedFormat = defineForwarder<[Format]>((args, forward) => {
  calls += 1;
  return forward(format, args);
});
const fixed: string = countedFormat(3.14159, 2);
const dated: string = countedFormat(new Date(0));
equal(fixed, "3.14");
equal(dated, "1970-01-01T00:00:00.000Z");
equal(calls, 2);

type First = <T>(items: readonly T[]) => T | undefined;

const first: First = (items) => items[0];
const loggedFirst = defineForwarder<[First]>((args, forward) => forward(first, args));
const head: number | undefined = loggedFirst([1, 2, 3]);
equal(head, 1);

type Listener = {
  (event: "open"): void;
  (event: "close", code: number): void;
};

const received: unknown[][] = [];
const listener: Listener = (...event: unknown[]) => {
  received.push(event);
};
const listeners: readonly Listener[] = [listener, listener];
const notifyAll = defineForwarder<[Listener]>((args, forward) => {
  for (const each of listeners) forward(each, args);
  return undefined;
});
equal(notifyAll("close", 1000), undefined);
equal(received.length, 2);
equal(received[1]?.[1], 1000);

type Read = (this: { readonly base: number }, amount: number) => number;

const read: Read = function (amount) {
  return this.base + amount;
};
const forwardedRead = defineForwarder<[Read]>((args, forward) => forward(read, args));
equal(forwardedRead.call({ base: 40 }, 2), 42);

const cause = new Error("failed");
const failing: (value: number) => number = () => {
  throw cause;
};
const forwardedFailure = defineForwarder<[typeof failing]>((args, forward) => forward(failing, args));
let thrown: unknown;
try {
  forwardedFailure(1);
} catch (error) {
  thrown = error;
}
equal(thrown, cause);

type Handle = { readonly path: string; readonly readOnly: boolean };
type OpenByPath = (path: string) => Handle;
type OpenWithOptions = (options: { readonly path: string; readonly readOnly: boolean }) => Handle;

const openByPath: OpenByPath = (path) => ({ path, readOnly: false });
const openWithOptions: OpenWithOptions = (options) => ({ ...options });
const isString = (value: unknown): value is string => typeof value === "string";
const open = defineForwarder<[OpenByPath, OpenWithOptions]>((args, forward) => {
  const r = whenArg(args, 0, isString);
  return r.matched ? forward(openByPath, r.args) : forward(openWithOptions, r.args);
});
const byPath: Handle = open("/tmp/a.txt");
const withOptions: Handle = open({ path: "/tmp/b.txt", readOnly: true });
equal(byPath.readOnly, false);
equal(withOptions.readOnly, true);

function checkRejectedBodies() {
  // @ts-expect-error A string is not an argument list of Format.
  countedFormat("3.14");

  // @ts-expect-error The overloads of Format do not allow undefined as a result.
  defineForwarder<[Format]>(() => undefined);

  const parse = (text: string): string => text;
  // @ts-expect-error Only a function of the declared parts can receive the arguments.
  defineForwarder<[Format]>((args, forward) => forward(parse, args));

  // @ts-expect-error An argument list built in the body is not the one this call received.
  defineForwarder<[Format]>((_args, forward) => forward(format, [1, 2]));

  defineForwarder<[Format]>((args, forward) => {
    // @ts-expect-error The received arguments are read-only.
    args[0] = 1;
    return forward(format, args);
  });

  let saved: unknown;
  defineForwarder<[Format]>((args, forward) => {
    saved = forward(format, args);
    return forward(format, args);
  });
  // @ts-expect-error A result from another call does not belong to this one.
  defineForwarder<[Format]>(() => saved);

  // @ts-expect-error The options overload has not been ruled out.
  defineForwarder<[OpenByPath, OpenWithOptions]>((args, forward) => forward(openByPath, args));

  defineForwarder<[OpenByPath, OpenWithOptions]>((args, forward) => {
    const r = whenArg(args, 0, isString);
    // @ts-expect-error Each branch goes to the function whose arguments it holds.
    return r.matched ? forward(openWithOptions, r.args) : forward(openByPath, r.args);
  });

  type Six = {
    (value: 1): void;
    (value: 2): void;
    (value: 3): void;
    (value: 4): void;
    (value: 5): void;
    (value: 6): void;
  };
  // @ts-expect-error A function with more overloads than can be read would lose some of them.
  defineForwarder<[Six]>(() => undefined);
}
void checkRejectedBodies;

import {
  callUnknown,
  isConstructor,
  parseJson,
  type Constructor,
  type Result,
} from "type-proof/runtime";

function decodeNumber(input: unknown): Result<number, "expected-number"> {
  return typeof input === "number"
    ? { ok: true, value: input }
    : { ok: false, error: "expected-number" };
}

const number = parseJson("42", decodeNumber);
const wrongType = parseJson('"42"', decodeNumber);
const invalidJson = parseJson("{", decodeNumber);
if (
  !number.ok ||
  number.value !== 42 ||
  wrongType.ok ||
  wrongType.error.kind !== "invalid-value" ||
  wrongType.error.cause !== "expected-number" ||
  invalidJson.ok ||
  invalidJson.error.kind !== "invalid-json" ||
  !(invalidJson.error.cause instanceof SyntaxError)
) {
  throw new Error("Expected JSON syntax and validation failures to remain distinct");
}

function increase(this: { base: number }, amount: number): number {
  return this.base + amount;
}

class Service {}

const cause = new Error("failed");
const call = callUnknown(increase, [2], { base: 40 });
const notCallable = callUnknown(42, []);
const calledConstructor = callUnknown(Service, []);
const failedCall = callUnknown(() => {
  throw cause;
}, []);
if (
  !call.ok ||
  call.value !== 42 ||
  notCallable.ok ||
  notCallable.error.kind !== "not-callable" ||
  calledConstructor.ok ||
  calledConstructor.error.kind !== "call-failed" ||
  failedCall.ok ||
  failedCall.error.kind !== "call-failed" ||
  failedCall.error.cause !== cause
) {
  throw new Error("Expected invocation to return the observed value or failure");
}

let touched = false;
class ConstructorWithSideEffects {
  constructor() {
    touched = true;
  }
}

const target: unknown = new Proxy(ConstructorWithSideEffects, {
  get() {
    touched = true;
    throw new TypeError("unexpected property read");
  },
});

if (!isConstructor(target) || isConstructor(() => ({})) || isConstructor(null) || touched) {
  throw new Error("Expected constructibility detection without running the target or reading its properties");
}

const constructor: Constructor = target;

function checkRejectedInputs() {
  // @ts-expect-error JSON syntax cannot determine the application's value type.
  parseJson("42");
  // @ts-expect-error Constructibility cannot determine the instance type.
  isConstructor<Date>(constructor);
  if (call.ok) {
    // @ts-expect-error An arbitrary call provides no proof of the result type.
    const result: number = call.value;
    return result;
  }
}

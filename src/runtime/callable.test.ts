import { callUnknown } from "type-proof/runtime";

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

function checkRejectedInputs() {
  if (call.ok) {
    // @ts-expect-error An arbitrary call provides no proof of the result type.
    const result: number = call.value;
    return result;
  }
}
void checkRejectedInputs;

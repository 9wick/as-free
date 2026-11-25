import { isConstructor, type Constructor } from "type-proof/runtime";

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
  // @ts-expect-error Constructibility cannot determine the instance type.
  isConstructor<Date>(constructor);
}
void checkRejectedInputs;

import { isFunction } from "as-free";

const handlers = new Map<string, (...args: never[]) => unknown>();
const register = (name: string, value: unknown): void => {
  if (isFunction(value)) handlers.set(name, value);
};

register("count", (value: number) => value * 2);
register("label", "not a function");
register("Service", class Service {});

if (handlers.size !== 2 || handlers.has("label")) throw new Error("Expected only functions to be registered");

function checkRejectedCalls(value: unknown) {
  if (isFunction(value)) {
    // @ts-expect-error The parameters of an unknown function are not known.
    value(1);
  }
}
void checkRejectedCalls;

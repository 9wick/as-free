import type { Result } from "../result.ts";
import { isConstructor } from "../runtime/class-constructor.ts";

type MemberValues<Value> = { [Key in keyof Value]: GuardedValue<Value[Key]> };
type DataKeys<Value> = {
  [Key in keyof Value]-?: [Extract<Value[Key], object>] extends [never] ? Key : never;
}[keyof Value];
type Members<Value> = Value extends readonly unknown[]
  ? Readonly<MemberValues<Value>>
  : {
      [
        Key in keyof (Pick<MemberValues<Value>, DataKeys<Value>> & Readonly<Omit<MemberValues<Value>, DataKeys<Value>>>)
      ]: (Pick<MemberValues<Value>, DataKeys<Value>> & Readonly<Omit<MemberValues<Value>, DataKeys<Value>>>)[Key];
    };
type Construct<Value> = Value extends new (...args: infer Args) => infer Instance
  ? new (...args: Args) => Instance
  : Value extends abstract new (...args: infer Args) => infer Instance
    ? abstract new (...args: Args) => Instance
    : unknown;

type Call<Value, Args extends unknown[], Result> = (this: ThisParameterType<Value>, ...args: Args) => Result;

export type GuardedValue<Value> = Value extends (...args: infer Args) => infer Result
  ? keyof Value extends never
    ? Value
    : Call<Value, Args, Result> & Construct<Value> & Pick<Value, keyof Value> extends Value
      ? Call<Value, Args, Result> & Construct<Value> & Members<Value>
      : Members<Value>
  : Value extends object
    ? Construct<Value> & Pick<Value, keyof Value> extends Value
      ? Construct<Value> & Members<Value>
      : Members<Value>
    : Value;

type HandleContext = {
  readonly checkLifetime: () => object;
  readonly handles: WeakMap<object, object>;
  readonly sources: WeakMap<object, object>;
};

const callableTarget = () => ((..._args: unknown[]): unknown => undefined).bind(undefined);
const constructibleTarget = () => function () {}.bind(undefined);

const shadowFor = (value: object): object => {
  if (Array.isArray(value)) return [];
  if (typeof value !== "function") return {};
  return isConstructor(value) ? constructibleTarget() : callableTarget();
};

const hasSameKind = (left: object, right: object): boolean =>
  typeof left === typeof right &&
  Array.isArray(left) === Array.isArray(right) &&
  isConstructor(left) === isConstructor(right);

const unwrap = (context: HandleContext, value: unknown): unknown =>
  value !== null && (typeof value === "object" || typeof value === "function")
    ? (context.sources.get(value) ?? value)
    : value;

const invocationReceiver = (instance: object, method: unknown, handle: object): object =>
  typeof instance === "function" &&
  (method === Function.prototype.call || method === Function.prototype.apply || method === Function.prototype.bind)
    ? handle
    : instance;

const readProperty = (context: HandleContext, read: () => object, handle: object, key: string | symbol): unknown => {
  const instance = read();
  const value: unknown = Reflect.get(instance, key);
  if (typeof value === "function") {
    // Bound functions must keep invoking the guarded handle after extraction.
    const receiver = invocationReceiver(instance, value, handle);
    return createHandle(
      context,
      () => {
        read();
        return value;
      },
      shadowFor(value),
      receiver,
    );
  }
  if (value === null || typeof value !== "object") return value;
  const existing = context.handles.get(value);
  if (existing) return existing;
  const nested = createHandle(context, () => value, Array.isArray(value) ? [] : {});
  context.handles.set(value, nested);
  context.sources.set(nested, value);
  return nested;
};

const propertyDescriptor = (
  context: HandleContext,
  read: () => object,
  handle: object,
  shadow: object,
  key: string | symbol,
): PropertyDescriptor | undefined => {
  const descriptor = Reflect.getOwnPropertyDescriptor(read(), key);
  if (!descriptor) return undefined;
  const configurable = Reflect.getOwnPropertyDescriptor(shadow, key)?.configurable ?? true;
  if (descriptor.writable !== undefined) {
    return { ...descriptor, configurable, value: readProperty(context, read, handle, key) };
  }
  return {
    ...descriptor,
    configurable,
    ...(descriptor.get ? { get: () => readProperty(context, read, handle, key) } : {}),
    ...(descriptor.set
      ? {
          set: (value: unknown) => {
            Reflect.set(read(), key, unwrap(context, value));
          },
        }
      : {}),
  };
};

const createHandle = (context: HandleContext, source: () => object, shadow: object, boundReceiver?: object): object => {
  const read = (): object => {
    context.checkLifetime();
    const instance = source();
    context.handles.set(instance, handle);
    context.sources.set(handle, instance);
    return instance;
  };
  const handle: object = new Proxy(shadow, {
    apply: (_, receiver: unknown, args: unknown[]): unknown => {
      const instance = read();
      if (typeof instance !== "function") throw new TypeError("The source is not callable");
      const target = receiver === undefined || receiver === boundReceiver ? boundReceiver : unwrap(context, receiver);
      return Reflect.apply(
        instance,
        target,
        args.map((arg) => unwrap(context, arg)),
      );
    },
    construct: (_, args: unknown[], newTarget): object => {
      const instance = read();
      if (!isConstructor(instance)) throw new TypeError("The source is not a constructor");
      const parameters = args.map((arg) => unwrap(context, arg));
      const result: object = Reflect.construct(instance, parameters, newTarget === handle ? instance : newTarget);
      return result;
    },
    get: (_, key): unknown => readProperty(context, read, handle, key),
    set: (_, key, value: unknown) => {
      const instance = read();
      return Reflect.set(instance, key, unwrap(context, value), instance);
    },
    has: (_, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getPrototypeOf: () => Reflect.getPrototypeOf(read()),
    getOwnPropertyDescriptor: (_, key) => propertyDescriptor(context, read, handle, shadow, key),
  });
  return handle;
};

/**
 * Guard properties recursively while preserving aliases, cycles and method receivers.
 * Operation results retain their own resource lifetime rather than being proxied.
 */
export const createKeyedValueView = (source: () => object) => {
  let bound: object | undefined;
  let handle: object | undefined;
  const read = (): object => {
    const value = source();
    if (bound !== undefined && value !== bound) {
      throw new TypeError("The source of a bound value view changed");
    }
    return value;
  };

  const context: HandleContext = { checkLifetime: read, handles: new WeakMap(), sources: new WeakMap() };

  return Object.freeze({
    get handle(): object {
      // Pending views must support calls before realization reveals the source's shape.
      return (handle ??= createHandle(context, read, constructibleTarget()));
    },
    bind<Value>(value: Value): Result<GuardedValue<Value>, "different-source"> {
      const current = source();
      if (current !== value || (bound !== undefined && bound !== current)) {
        return { ok: false, error: "different-source" };
      }
      bound = current;
      if (handle === undefined || !hasSameKind(handle, current)) {
        handle = createHandle(context, read, shadowFor(current));
      }
      // This view exposes the source's public shape without claiming its private brands.
      return { ok: true, value: handle as GuardedValue<Value> };
    },
  });
};

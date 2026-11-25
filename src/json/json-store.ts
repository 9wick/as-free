import { failure, success, type Result } from "./result.ts";

// Every part that JSON would drop or reshape becomes never, so a type equals its own
// round trip only when the value read back still has that type.
export type JsonRoundTrip<T> = 0 extends 1 & T
  ? never
  : T extends string | number | boolean | null
    ? T
    : T extends ((...args: never[]) => unknown) | (abstract new (...args: never[]) => unknown)
      ? never
      : T extends object
        ? [keyof T] extends [never]
          ? never
          : { [K in keyof T]: K extends symbol ? never : JsonRoundTrip<T[K]> }
        : never;

type StringStorage = {
  readonly readString: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  readonly writeString: (key: string, text: string) => unknown;
};

// A rejected type leaves no way to pass the storage, and the only key says why.
export type JsonStoreOptions<T> = [T] extends [JsonRoundTrip<T>]
  ? StringStorage
  : { readonly "createJsonStore needs a type that survives a JSON round trip"?: never };

export type JsonStoreGetError =
  | { readonly kind: "not-found" }
  | { readonly kind: "invalid-json"; readonly cause: SyntaxError };

export type JsonStoreSetError =
  | { readonly kind: "non-finite-number" }
  | { readonly kind: "not-serializable"; readonly cause: TypeError };

export type JsonStore<T> = {
  readonly get: (key: string) => Promise<Result<T, JsonStoreGetError>>;
  readonly set: (key: string, value: T) => Promise<Result<undefined, JsonStoreSetError>>;
};

const stringify = (value: unknown): Result<string, JsonStoreSetError> => {
  // The type number admits NaN and Infinity, which JSON would store as null.
  const found = { nonFinite: false };
  let text: string;
  try {
    text = JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === "number" && !Number.isFinite(item)) found.nonFinite = true;
      return item;
    });
  } catch (cause) {
    if (!(cause instanceof TypeError)) throw cause;
    return failure({ kind: "not-serializable", cause });
  }
  return found.nonFinite ? failure({ kind: "non-finite-number" }) : success(text);
};

export const createJsonStore = <T>(options: JsonStoreOptions<T>): JsonStore<T> => {
  const { readString, writeString } = options as StringStorage;

  return {
    get: async (key) => {
      const text = await readString(key);
      if (text === null || text === undefined) return failure({ kind: "not-found" });

      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (cause) {
        if (!(cause instanceof SyntaxError)) throw cause;
        return failure({ kind: "invalid-json", cause });
      }
      // set is the only writer paired with this reader, and it accepts only T, which JSON returns unchanged.
      return success(value as T);
    },
    set: async (key, value) => {
      const text = stringify(value);
      if (text.type === "Failure") return text;
      await writeString(key, text.value);
      return success(undefined);
    },
  };
};

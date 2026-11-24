import type { Result } from "./result.ts";

export type JsonError<DecodeError> =
  | { readonly kind: "invalid-json"; readonly cause: SyntaxError }
  | { readonly kind: "invalid-value"; readonly cause: DecodeError };

export const parseJson = <Value, DecodeError>(
  text: string,
  decode: (input: unknown) => Result<Value, DecodeError>,
): Result<Value, JsonError<DecodeError>> => {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { ok: false, error: { kind: "invalid-json", cause } };
  }

  const decoded = decode(input);
  return decoded.ok
    ? decoded
    : { ok: false, error: { kind: "invalid-value", cause: decoded.error } };
};

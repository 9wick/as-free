import { parseJson, type Result } from "type-proof/runtime";

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

function checkRejectedInputs() {
  // @ts-expect-error JSON syntax cannot determine the application's value type.
  parseJson("42");
}
void checkRejectedInputs;

import { fieldOrEmpty, mapValues, type OptionalWhenEmpty } from "as-free";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected field value");
}

type Check = { readonly id: string };
type Dep<T> = { readonly resolve: () => T };

const resolveAll = <P extends Record<string, Dep<unknown>>>(deps: P) => mapValues(deps, (dep) => dep.resolve());
type Resolved<P extends Record<string, Dep<unknown>>> = ReturnType<typeof resolveAll<P>>;

type Rule<P extends Record<string, Dep<unknown>>> = {
  readonly name: string;
  readonly check: (subject: Check, deps: Resolved<P>) => boolean;
} & OptionalWhenEmpty<"requires", P>;

// Inside a generic function the field is read as P, so mapValues keeps each key's type.
const rule = <P extends Record<string, Dep<unknown>> = {}>(def: Rule<P>) => {
  const deps = resolveAll(fieldOrEmpty<"requires", P>(def, "requires"));
  return (subject: Check) => def.check(subject, deps);
};

const find: Dep<(id: string) => boolean> = { resolve: () => (id) => id === "x" };
const plain = rule({ name: "plain", check: (subject) => subject.id === "" });
const withDeps = rule({
  name: "withDeps",
  requires: { find },
  check: (subject, { find }) => {
    const found: boolean = find(subject.id);
    return found;
  },
});
equal(plain({ id: "" }), true);
equal(withDeps({ id: "x" }), true);
equal(withDeps({ id: "y" }), false);

const given = { a: 1 };
equal(fieldOrEmpty({ f: given }, "f"), given);

const empty: {} = fieldOrEmpty<"f", {}>({}, "f");
equal(Reflect.ownKeys(empty).length, 0);
equal(Object.isFrozen(empty), true);

const asObject: object = fieldOrEmpty<"f", object>({}, "f");
equal(Reflect.ownKeys(asObject).length, 0);

class Private {
  private readonly x = 1;
  read(): number {
    return this.x;
  }
}
class OnlyPrivate {
  readonly #x = 1;
  static read(value: OnlyPrivate): number {
    return value.#x;
  }
}

function checkTypes() {
  // @ts-expect-error The field cannot be left out while P has a key.
  fieldOrEmpty<"f", { a: number }>({}, "f");
  // @ts-expect-error A record with an index signature has keys.
  fieldOrEmpty<"f", Record<string, number>>({}, "f");
  // @ts-expect-error An optional key is still a key.
  fieldOrEmpty<"f", { a?: number }>({}, "f");
  // @ts-expect-error A function type has no key, but {} is not a function.
  fieldOrEmpty<"f", () => number>({}, "f");
  // @ts-expect-error The same holds for a constructor type.
  fieldOrEmpty<"f", new () => object>({}, "f");
  // @ts-expect-error A class with only private members has no key, but {} is not an instance of it.
  fieldOrEmpty<"f", OnlyPrivate>({}, "f");
  // @ts-expect-error A private member is not a key either.
  fieldOrEmpty<"f", Private>({}, "f");
  // @ts-expect-error A rule that uses its deps must list them.
  rule({ name: "missing", check: (subject, { find }: { find: (id: string) => boolean }) => find(subject.id) });
  // @ts-expect-error The field read must be the one the holder's type describes.
  const other = <P extends Record<string, Dep<unknown>>>(def: Rule<P>) => fieldOrEmpty<"other", P>(def, "other");
  void [other, Private, OnlyPrivate];
}
void checkTypes;

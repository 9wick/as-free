import { getOrEmpty, type OmittableIfEmpty } from "as-free";

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected field value");
}

type Job<P> = { readonly run: (input: P) => number } & OmittableIfEmpty<"input", P>;

// Inside a generic function the field is read as P, whether or not it was given.
const runJob = <P extends object>(job: Job<P>) => job.run(getOrEmpty<"input", P>(job, "input"));

equal(runJob({ run: (input) => Reflect.ownKeys(input).length }), 0);
equal(runJob({ input: { id: 1 }, run: ({ id }) => id }), 1);

const given = { a: 1 };
equal(getOrEmpty({ f: given }, "f"), given);

const empty: {} = getOrEmpty<"f", {}>({}, "f");
equal(Reflect.ownKeys(empty).length, 0);
equal(Object.isFrozen(empty), true);

const asObject: object = getOrEmpty<"f", object>({}, "f");
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
  getOrEmpty<"f", { a: number }>({}, "f");
  // @ts-expect-error A record with an index signature has keys.
  getOrEmpty<"f", Record<string, number>>({}, "f");
  // @ts-expect-error An optional key is still a key.
  getOrEmpty<"f", { a?: number }>({}, "f");
  // @ts-expect-error A function type has no key, but {} is not a function.
  getOrEmpty<"f", () => number>({}, "f");
  // @ts-expect-error The same holds for a constructor type.
  getOrEmpty<"f", new () => object>({}, "f");
  // @ts-expect-error A class with only private members has no key, but {} is not an instance of it.
  getOrEmpty<"f", OnlyPrivate>({}, "f");
  // @ts-expect-error A private member is not a key either.
  getOrEmpty<"f", Private>({}, "f");
  // @ts-expect-error A job that reads its input must be given one.
  runJob({ run: ({ id }: { id: number }) => id });
  // @ts-expect-error The field read must be the one the holder's type describes.
  const other = <P extends object>(job: Job<P>) => getOrEmpty<"other", P>(job, "other");
  void [other, Private, OnlyPrivate];
}
void checkTypes;

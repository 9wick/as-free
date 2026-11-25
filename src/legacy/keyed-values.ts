import type { Key, SingleKey } from "../keyed-value/from-entries.ts";

type WithValue<Values, K extends Key, V> = Readonly<Omit<Values, K> & Record<K, V>>;

export class NamedValues<Context, Values extends object> {
  readonly #context: Context;
  readonly #values: Values;

  private constructor(context: Context, values: Values) {
    this.#context = context;
    this.#values = values;
  }

  static start<Context>(context: Context): NamedValues<Context, {}> {
    return new NamedValues(context, Object.freeze({}));
  }

  with<const K extends Key, V>(
    key: K & SingleKey<K>,
    resolveIn: (context: Context) => V,
  ): NamedValues<Context, WithValue<Values, K, V>> {
    const value = resolveIn(this.#context);
    // Every previous field is an own enumerable property of a snapshot created here.
    const next = Object.freeze({ ...this.#values, [key]: value }) as WithValue<Values, K, V>;
    return new NamedValues(this.#context, next);
  }

  toObject(): Values {
    return this.#values;
  }
}

export const resolveNamedValues = <Context>(context: Context): NamedValues<Context, {}> =>
  NamedValues.start(context);

export class ValueKey<Value> {
  declare private readonly valueType: (value: Value) => Value;
}

export class KeyedValueStore {
  readonly #values = new WeakMap<object, unknown>();

  set<Value>(key: ValueKey<Value>, value: NoInfer<Value>): void {
    this.#values.set(key, value);
  }

  get<Value>(key: ValueKey<Value>): Value | undefined {
    // A key's invariant type makes every write for that identity use the same value type.
    return this.#values.get(key) as Value | undefined;
  }
}

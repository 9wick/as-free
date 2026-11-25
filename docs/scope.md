# Scope & Design Criteria

English | [日本語](scope.ja.md) · [Back to README](../README.md)

`as-free` exists for cases where **you know an operation is type-safe at runtime, yet TypeScript lacks the expressiveness to prove it**.

## Categories of `as`

Not every `as` cast belongs in a utility library. We classify type assertions into five categories:

### 1. Unfounded `as`

Silencing a type mismatch with no runtime justification. The most dangerous kind.

```ts
const value = someFunction() as MyType; // No justification
```

### 2. Trust-boundary `as`

Casting external input (API responses, JSON payloads, etc.) alongside validation. Soundness depends on the validator.

```ts
const parsed = schema.parse(JSON.parse(raw)) as Config;
```

### 3. Language-limitation `as` (In scope)

Assertions that hold at runtime by construction, but cannot be expressed in TypeScript's type system. **This is the sole scope of `as-free`.**

#### 3a. Type-inference limits

Cases where generic or higher-order inference falls short:

```ts
// Object.entries() widens keys to string
const entries = Object.entries(record) as [keyof T, T[keyof T]][];
```

#### 3b. Narrowing assistance

Cases where the compiler cannot narrow a value further after type guards or discriminated-union checks:

```ts
// Exhaustive switch, yet the compiler fails to narrow a branch
function handle(action: Action) {
  switch (action.type) {
    case "create":
      return processCreate(action as CreateAction);
    // ...
  }
}
```

> **Recommendation:** For narrowing discriminated unions, use [`ts-pattern`](https://github.com/gvergnaud/ts-pattern)'s `match().exhaustive()` instead of `as`. That limitation comes from standard `switch` syntax rather than a missing type-system capability.

### 4. Test-mock `as`

Partial objects created solely for tests; never shipped in production code.

```ts
const mockUser = { name: "test" } as User;
```

### 5. Broken `@types` workaround `as`

Correcting inaccurate or outdated third-party `@types` definitions. These depend on external packages and disappear once upstream types are fixed.

```ts
// @types/xxx declares string, while runtime actually returns string | null
const result = lib.getValue() as string | null;
```

---

**`as-free` targets Category 3 only.** All other categories belong in their appropriate layers (validation schemas, test helpers, local overrides, etc.).

## Acceptance Criteria

Every utility in `as-free` that uses a type assertion internally must satisfy all three criteria:

1. **Runtime soundness:** Given the utility's input contract and implementation, the declared return type can be proven to hold at runtime.
2. **Type-system necessity:** The relationship between input and output types cannot be preserved using TypeScript's type checking alone.
3. **Encapsulation:** By confining the assertion inside the utility, callers can use it safely with ordinary type checking and zero `as` casts.

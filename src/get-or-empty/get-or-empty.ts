// The empty object stands for P only when P has no key and {} is assignable to it. keyof alone also lets through
// function types, constructor types and classes whose members are all private, which {} is not.
type Omittable<P> = [keyof P] extends [never] ? ([{}] extends [P] ? true : false) : false;

export type OmittableIfEmpty<F extends PropertyKey, P> = { readonly [_ in F]?: P } & (Omittable<P> extends true
  ? unknown
  : { readonly [_ in F]: P });

export const getOrEmpty = <const F extends PropertyKey, P extends object>(
  holder: OmittableIfEmpty<F, P>,
  field: F,
): P => {
  const value: P | undefined = holder[field];
  // When the field is missing, the holder's type admits that only for a P with no key that accepts {}.
  return value ?? (Object.freeze({}) as P);
};

export type Success<Value> = { readonly type: "Success"; readonly value: Value };
export type Failure<Error> = { readonly type: "Failure"; readonly error: Error };
export type Result<Value, Error> = Success<Value> | Failure<Error>;

export const success = <Value>(value: Value): Success<Value> => ({ type: "Success", value });
export const failure = <Error>(error: Error): Failure<Error> => ({ type: "Failure", error });

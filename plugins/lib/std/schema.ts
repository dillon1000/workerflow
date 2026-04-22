import { assert } from "./guards";

type Decoder<T> = (value: unknown) => T;

export function stringField(
  field: string,
  options: { minLength?: number; trim?: boolean } = {},
): Decoder<string> {
  return (value) => {
    const next = options.trim === false ? String(value ?? "") : String(value ?? "").trim();
    if (options.minLength != null) {
      assert(
        next.length >= options.minLength,
        `"${field}" must be at least ${options.minLength} characters.`,
      );
    }
    return next;
  };
}

export function numberField(
  field: string,
  options: { min?: number; max?: number } = {},
): Decoder<number> {
  return (value) => {
    const next = Number(value);
    assert(Number.isFinite(next), `"${field}" must be a number.`);
    if (options.min != null) {
      assert(next >= options.min, `"${field}" must be >= ${options.min}.`);
    }
    if (options.max != null) {
      assert(next <= options.max, `"${field}" must be <= ${options.max}.`);
    }
    return next;
  };
}

export function booleanField(): Decoder<boolean> {
  return (value) => value === true || value === "true";
}

export function optional<T>(decoder: Decoder<T>): Decoder<T | undefined> {
  return (value) =>
    value == null || value === "" ? undefined : decoder(value);
}

export function decodeObject<T extends Record<string, unknown>>(
  input: Record<string, unknown>,
  schema: { [K in keyof T]: Decoder<T[K]> },
) {
  const output = {} as T;
  for (const [key, decoder] of Object.entries(schema)) {
    output[key as keyof T] = decoder(input[key]) as T[keyof T];
  }
  return output;
}

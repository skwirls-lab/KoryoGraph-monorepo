import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Fns = Database["public"]["Functions"];

export class DbError extends Error {
  override name = "DbError";
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly details: string | undefined,
  ) {
    super(message);
  }
  static from(err: PostgrestError): DbError {
    return new DbError(err.message, err.code, err.details ?? undefined);
  }
}

/** Typed RPC call that throws DbError on failure instead of returning `{ error }`. */
export async function rpc<N extends keyof Fns & string>(
  client: SupabaseClient<Database>,
  name: N,
  args: Fns[N] extends { Args: infer A } ? A : never,
): Promise<Fns[N] extends { Returns: infer R } ? R : never> {
  // supabase-js overloads cannot be resolved against a generic name; the signature above is the contract.
  const call = client.rpc as unknown as (
    fn: string,
    a: unknown,
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  const { data, error } = await call.call(client, name, args);
  if (error) throw DbError.from(error);
  return data as Fns[N] extends { Returns: infer R } ? R : never;
}

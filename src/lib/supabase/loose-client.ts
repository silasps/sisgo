type QueryResult = {
  data: unknown
  count?: number | null
  error?: unknown
}

export type LooseQuery = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => LooseQuery
  insert: (...args: unknown[]) => LooseQuery
  update: (...args: unknown[]) => LooseQuery
  delete: (...args: unknown[]) => LooseQuery
  upsert: (...args: unknown[]) => LooseQuery
  eq: (...args: unknown[]) => LooseQuery
  in: (...args: unknown[]) => LooseQuery
  is: (...args: unknown[]) => LooseQuery
  not: (...args: unknown[]) => LooseQuery
  order: (...args: unknown[]) => LooseQuery
  limit: (...args: unknown[]) => LooseQuery
  maybeSingle: () => Promise<QueryResult>
  single: () => Promise<QueryResult>
}

export type LooseSupabaseClient = {
  from: (table: string) => LooseQuery
  rpc: (fn: string, args?: Record<string, unknown>) => LooseQuery
}

export function asLooseClient(client: unknown): LooseSupabaseClient {
  return client as LooseSupabaseClient
}

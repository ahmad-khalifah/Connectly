// A tiny in-memory stand-in for the parts of the Supabase client the payment
// code uses: from(table).insert/select/update/eq/maybeSingle/single and rpc().
// Each test supplies handlers; every call is recorded for assertions.

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Op = { table: string; action: 'insert' | 'select' | 'update'; values?: unknown; filters: [string, unknown][] };
export type Handler = (op: Op) => Result;

export function createFakeDb(handler: Handler, rpc: (fn: string, args: Record<string, unknown>) => Result = () => ({ data: null, error: null })) {
  const ops: Op[] = [];
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  const from = (table: string) => {
    const op: Op = { table, action: 'select', filters: [] };
    const run = () => {
      ops.push({ ...op, filters: [...op.filters] });
      return handler(op);
    };
    const chain: Record<string, unknown> = {
      insert(values: unknown) { op.action = 'insert'; op.values = values; return chain; },
      update(values: unknown) { op.action = 'update'; op.values = values; return chain; },
      select() { return chain; },
      eq(col: string, val: unknown) { op.filters.push([col, val]); return chain; },
      maybeSingle: () => Promise.resolve(run()),
      single: () => Promise.resolve(run()),
      then(resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return chain;
  };

  return {
    db: {
      from,
      rpc: (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve(rpc(fn, args));
      },
    },
    ops,
    rpcCalls,
  };
}

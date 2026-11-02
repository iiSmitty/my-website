// A stand-in for the Durable Object runtime, so the Worker and PcMood run in
// Node the same way the contact Worker's tests stub fetch. Storage is a real
// in-memory SQLite database (Node's built-in node:sqlite), so the SQL that
// runs here is the SQL that runs on Cloudflare.

import { DatabaseSync } from 'node:sqlite';
import { PcMood } from '../src/worker.js';

/** ctx.storage.sql, as far as PcMood uses it: exec(query, ...bindings).toArray() */
export function fakeStorage() {
  const db = new DatabaseSync(':memory:');
  const statements = [];
  return {
    db,
    statements,
    sql: {
      exec(query, ...bindings) {
        statements.push(query.replace(/\s+/g, ' ').trim());
        // Plain objects, like the rows Cloudflare returns
        const rows = db.prepare(query).all(...bindings).map((row) => ({ ...row }));
        return { toArray: () => rows };
      },
    },
  };
}

/**
 * env.PC_MOOD: hands every name the same object, the way one Durable Object
 * per name works. `restart()` throws the object away and makes a new one on
 * the same storage, like Cloudflare evicting it from memory.
 */
export function fakeNamespace(env) {
  const storage = fakeStorage();
  let object = new PcMood({ storage }, env);
  const names = [];
  return {
    storage,
    names,
    restart() {
      object = new PcMood({ storage }, env);
    },
    idFromName(name) {
      names.push(name);
      return { name };
    },
    get() {
      return { fetch: (url, init) => object.fetch(new Request(url, init)) };
    },
  };
}

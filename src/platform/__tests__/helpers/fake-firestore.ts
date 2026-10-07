/**
 * @fileOverview Minimal in-memory Firestore fake for platform tests.
 *
 * Supports exactly what the agent-step store and dispatcher use: nested collection/doc refs,
 * get/set/update/delete, batches, `runTransaction` with `getAll`/`get`/`set`/`update`/`delete`,
 * and queries with equality/`in`/`array-contains`/range filters, orderBy (numbers compare
 * numerically), startAfter, limit.
 * Transactions are serialized through a mutex, mirroring Firestore's guarantee that two
 * transactions touching the same documents cannot both commit on stale reads.
 */

import type { Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;

export class FakeDocRef {
  constructor(
    private readonly store: Map<string, Data>,
    readonly path: string
  ) {}

  get id(): string {
    return this.path.split('/').pop() ?? '';
  }

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.store, `${this.path}/${name}`);
  }

  async get(): Promise<FakeSnapshot> {
    return snapshotOf(this.store, this.path);
  }

  async set(data: Data): Promise<void> {
    this.store.set(this.path, structuredClone(data));
  }

  async update(data: Data): Promise<void> {
    applyUpdate(this.store, this.path, data);
  }

  async delete(): Promise<void> {
    this.store.delete(this.path);
  }
}

type FilterOp = '==' | 'in' | 'array-contains' | '<' | '<=' | '>' | '>=';
type Filter = { field: string; op: FilterOp; value: unknown };

function matches(data: Data, f: Filter): boolean {
  const v = data[f.field];
  switch (f.op) {
    case '==':
      return v === f.value;
    case 'in':
      return Array.isArray(f.value) && f.value.includes(v);
    case 'array-contains':
      return Array.isArray(v) && v.includes(f.value);
    case '<':
      return v !== undefined && compareValues(v, f.value) < 0;
    case '<=':
      return v !== undefined && compareValues(v, f.value) <= 0;
    case '>':
      return v !== undefined && compareValues(v, f.value) > 0;
    case '>=':
      return v !== undefined && compareValues(v, f.value) >= 0;
  }
}

/** Query over the direct children of a collection: equality/`in` filters, orderBy, limit. */
export class FakeQuery {
  constructor(
    protected readonly store: Map<string, Data>,
    readonly path: string,
    private readonly filters: Filter[] = [],
    private readonly order: { field: string; dir: 'asc' | 'desc' } | null = null,
    private readonly max: number | null = null,
    private readonly cursor: unknown = undefined
  ) {}

  where(field: string, op: FilterOp, value: unknown): FakeQuery {
    return new FakeQuery(this.store, this.path, [...this.filters, { field, op, value }], this.order, this.max, this.cursor);
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, { field, dir }, this.max, this.cursor);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, this.order, n, this.cursor);
  }

  /** Cursor on the current orderBy field (value form only). */
  startAfter(value: unknown): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, this.order, this.max, value);
  }

  async get(): Promise<{ empty: boolean; size: number; docs: FakeSnapshot[] }> {
    const prefix = `${this.path}/`;
    let rows = [...this.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .filter(([, data]) => this.filters.every((f) => matches(data, f)));
    if (this.order) {
      const { field, dir } = this.order;
      const sign = dir === 'asc' ? 1 : -1;
      rows = rows.sort(([, a], [, b]) => compareValues(a[field], b[field]) * sign);
      if (this.cursor !== undefined) {
        const cursor = this.cursor;
        rows = rows.filter(([, data]) => compareValues(data[field], cursor) * sign > 0);
      }
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    const docs = rows.map(([p]) => snapshotOf(this.store, p));
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

let autoId = 0;

export class FakeCollectionRef extends FakeQuery {
  constructor(store: Map<string, Data>, path: string) {
    super(store, path);
  }

  doc(id?: string): FakeDocRef {
    autoId += 1;
    return new FakeDocRef(this.store, `${this.path}/${id ?? `auto-${autoId}`}`);
  }

  async add(data: Data): Promise<FakeDocRef> {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

export interface FakeSnapshot {
  exists: boolean;
  id: string;
  ref: FakeDocRef;
  data: () => Data | undefined;
}

function snapshotOf(store: Map<string, Data>, path: string): FakeSnapshot {
  const value = store.get(path);
  return {
    exists: value !== undefined,
    id: path.split('/').pop() ?? '',
    ref: new FakeDocRef(store, path),
    data: () => (value === undefined ? undefined : structuredClone(value)),
  };
}

function applyUpdate(store: Map<string, Data>, path: string, data: Data): void {
  const existing = store.get(path);
  if (!existing) {
    throw new Error(`NOT_FOUND: No document to update: ${path}`);
  }
  store.set(path, { ...existing, ...structuredClone(data) });
}

export class FakeFirestore {
  readonly docs = new Map<string, Data>();
  private txQueue: Promise<unknown> = Promise.resolve();

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.docs, name);
  }

  read(path: string): Data | undefined {
    const value = this.docs.get(path);
    return value === undefined ? undefined : structuredClone(value);
  }

  write(path: string, data: Data): void {
    this.docs.set(path, structuredClone(data));
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      set: (ref: FakeDocRef, data: Data) => {
        ops.push(() => this.docs.set(ref.path, structuredClone(data)));
      },
      update: (ref: FakeDocRef, data: Data) => {
        ops.push(() => applyUpdate(this.docs, ref.path, data));
      },
      delete: (ref: FakeDocRef) => {
        ops.push(() => this.docs.delete(ref.path));
      },
      commit: async () => {
        ops.forEach((op) => op());
      },
    };
  }

  runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const run = this.txQueue.then(async () => {
      const writes: Array<() => void> = [];
      const tx: FakeTransaction = {
        getAll: async (...refs: FakeDocRef[]) => refs.map((ref) => snapshotOf(this.docs, ref.path)),
        get: async (ref: FakeDocRef) => snapshotOf(this.docs, ref.path),
        set: (ref: FakeDocRef, data: Data) => {
          writes.push(() => this.docs.set(ref.path, structuredClone(data)));
        },
        update: (ref: FakeDocRef, data: Data) => {
          writes.push(() => applyUpdate(this.docs, ref.path, data));
        },
        delete: (ref: FakeDocRef) => {
          writes.push(() => this.docs.delete(ref.path));
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w()); // commit only if fn resolved
      return result;
    });
    this.txQueue = run.catch(() => undefined);
    return run;
  }

  /** Typed view for code that expects the Admin SDK Firestore. */
  asFirestore(): Firestore {
    return this as unknown as Firestore;
  }
}

export interface FakeTransaction {
  getAll: (...refs: FakeDocRef[]) => Promise<FakeSnapshot[]>;
  get: (ref: FakeDocRef) => Promise<FakeSnapshot>;
  set: (ref: FakeDocRef, data: Data) => void;
  update: (ref: FakeDocRef, data: Data) => void;
  delete: (ref: FakeDocRef) => void;
}

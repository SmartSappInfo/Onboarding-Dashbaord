/**
 * @fileOverview Minimal in-memory Firestore fake for platform tests.
 *
 * Supports exactly what the agent-step store and dispatcher use: nested collection/doc refs,
 * get/set/update, batches, and `runTransaction` with `getAll`/`set`/`update`.
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

type Filter = { field: string; op: '==' | 'in'; value: unknown };

/** Query over the direct children of a collection: equality/`in` filters, orderBy, limit. */
export class FakeQuery {
  constructor(
    protected readonly store: Map<string, Data>,
    readonly path: string,
    private readonly filters: Filter[] = [],
    private readonly order: { field: string; dir: 'asc' | 'desc' } | null = null,
    private readonly max: number | null = null
  ) {}

  where(field: string, op: '==' | 'in', value: unknown): FakeQuery {
    return new FakeQuery(this.store, this.path, [...this.filters, { field, op, value }], this.order, this.max);
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, { field, dir }, this.max);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.store, this.path, this.filters, this.order, n);
  }

  async get(): Promise<{ empty: boolean; size: number; docs: FakeSnapshot[] }> {
    const prefix = `${this.path}/`;
    let rows = [...this.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .filter(([, data]) =>
        this.filters.every((f) => (f.op === '==' ? data[f.field] === f.value : Array.isArray(f.value) && f.value.includes(data[f.field])))
      );
    if (this.order) {
      const { field, dir } = this.order;
      rows = rows.sort(([, a], [, b]) => String(a[field]).localeCompare(String(b[field])) * (dir === 'asc' ? 1 : -1));
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    const docs = rows.map(([p]) => snapshotOf(this.store, p));
    return { empty: docs.length === 0, size: docs.length, docs };
  }
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
}

export interface FakeSnapshot {
  exists: boolean;
  id: string;
  data: () => Data | undefined;
}

function snapshotOf(store: Map<string, Data>, path: string): FakeSnapshot {
  const value = store.get(path);
  return {
    exists: value !== undefined,
    id: path.split('/').pop() ?? '',
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
}

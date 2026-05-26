// @ts-nocheck
/**
 * Reusable Firebase Admin Mock for Tests
 * 
 * Provides a configurable mock store that can be used across multiple test files
 */

export interface MockStore {
  entities: Map<string, any>;
  schools: Map<string, any>;
  workspace_entities: Map<string, any[]>;
  workspaces: Map<string, any>;
  users: Map<string, any>;
  activities: Map<string, any[]>;
  message_logs: Map<string, any[]>;
  tasks: Map<string, any[]>;
  pdfs: Map<string, any[]>;
  automations: Map<string, any[]>;
  forms: Map<string, any>;
  form_submissions: Map<string, any>;
  app_fields: Map<string, any>;
  field_groups: Map<string, any>;
  reset(): void;
  setEntity(id: string, data: any): void;
  setSchool(id: string, data: any): void;
  setWorkspaceEntity(workspaceId: string, data: any): void;
  setWorkspace(id: string, data: any): void;
}

export const createMockStore = (): MockStore => {
  const store: MockStore = {
    entities: new Map(),
    schools: new Map(),
    workspace_entities: new Map(),
    workspaces: new Map(),
    users: new Map(),
    activities: new Map(),
    message_logs: new Map(),
    tasks: new Map(),
    pdfs: new Map(),
    automations: new Map(),
    forms: new Map(),
    form_submissions: new Map(),
    app_fields: new Map(),
    field_groups: new Map(),
    
    reset() {
      this.entities.clear();
      this.schools.clear();
      this.workspace_entities.clear();
      this.workspaces.clear();
      this.users.clear();
      this.activities.clear();
      this.message_logs.clear();
      this.tasks.clear();
      this.pdfs.clear();
      this.automations.clear();
      this.forms.clear();
      this.form_submissions.clear();
      this.app_fields.clear();
      this.field_groups.clear();
    },
    
    setEntity(id: string, data: any) {
      this.entities.set(id, data);
    },
    
    setSchool(id: string, data: any) {
      this.schools.set(id, data);
    },
    
    setWorkspaceEntity(workspaceId: string, data: any) {
      const existing = this.workspace_entities.get(workspaceId) || [];
      existing.push(data);
      this.workspace_entities.set(workspaceId, existing);
    },
    
    setWorkspace(id: string, data: any) {
      this.workspaces.set(id, data);
    },
  };
  
  return store;
};

// Helper to resolve FieldValue.increment
function resolveFieldValue(oldVal: any, newVal: any) {
  // If newVal is a FieldValue.increment representation
  // in firebase-admin it is typically an object or class. We can detect if it has a signature/property
  if (newVal && typeof newVal === 'object' && newVal.constructor?.name === 'NumericIncrementTransform') {
    const amount = newVal.operand ?? 1;
    return (Number(oldVal) || 0) + amount;
  }
  // Or check custom object format
  if (newVal && typeof newVal === 'object' && (newVal._methodName === 'FieldValue.increment' || newVal.value !== undefined)) {
    const amount = newVal.value ?? 1;
    return (Number(oldVal) || 0) + amount;
  }
  return newVal;
}

export const createFirebaseAdminMock = (mockStore: MockStore) => {
  const getMapForCollection = (name: string): Map<string, any> | null => {
    switch (name) {
      case 'entities': return mockStore.entities;
      case 'schools': return mockStore.schools;
      case 'workspaces': return mockStore.workspaces;
      case 'users': return mockStore.users;
      case 'forms': return mockStore.forms;
      case 'form_submissions': return mockStore.form_submissions;
      case 'app_fields': return mockStore.app_fields;
      case 'field_groups': return mockStore.field_groups;
      default: return null;
    }
  };

  const dbMock: any = {
    collection: (name: string) => {
      const collectionMock: any = {
        doc: (id: string) => {
          const docRef = {
            id,
            parent: { id: name },
            get: async () => {
              const map = getMapForCollection(name);
              const data = map ? map.get(id) : undefined;
              return {
                exists: !!data,
                id,
                data: () => data,
                ref: docRef,
              };
            },
            set: async (data: any) => {
              const map = getMapForCollection(name);
              if (map) {
                // deep clone to simulate Firestore behavior
                map.set(id, JSON.parse(JSON.stringify(data)));
              }
            },
            update: async (data: any) => {
              const map = getMapForCollection(name);
              if (map) {
                const existing = map.get(id) || {};
                const updated = { ...existing };
                for (const [k, v] of Object.entries(data)) {
                  // check if it's a FieldValue.increment
                  if (v && typeof v === 'object' && (v.constructor?.name === 'NumericIncrementTransform' || v._methodName === 'FieldValue.increment')) {
                    const operand = v.operand ?? v.value ?? 1;
                    updated[k] = (Number(existing[k]) || 0) + operand;
                  } else {
                    updated[k] = v;
                  }
                }
                map.set(id, JSON.parse(JSON.stringify(updated)));
              }
            },
            delete: async () => {
              const map = getMapForCollection(name);
              if (map) {
                map.delete(id);
              }
            },
          };
          return docRef;
        },
        
        where: (field: string, op: string, value: any) => {
          let filters: Array<{ field: string; op: string; value: any }> = [{ field, op, value }];
          let orderByField: string | null = null;
          let orderByDir: 'asc' | 'desc' = 'asc';
          let limitCount: number | null = null;
          let startAfterVal: any = null;

          const queryMock: any = {
            where: (f: string, o: string, v: any) => {
              filters.push({ field: f, op: o, value: v });
              return queryMock;
            },
            orderBy: (f: string, direction?: string) => {
              orderByField = f;
              orderByDir = (direction as any) || 'asc';
              return queryMock;
            },
            limit: (l: number) => {
              limitCount = l;
              return queryMock;
            },
            startAfter: (val: any) => {
              startAfterVal = val;
              return queryMock;
            },
            get: async () => {
              const map = getMapForCollection(name);
              if (!map) {
                // Fallback for special mock collections (activities, tasks, message_logs, etc. stored as arrays)
                let arrayDocs: any[] = [];
                if (name === 'workspace_entities' && field === 'workspaceId') {
                  const weData = mockStore.workspace_entities.get(value) || [];
                  arrayDocs = weData.map((data) => ({ id: data.id, data: () => data }));
                } else if (name === 'activities' && field === 'workspaceId') {
                  const activities = mockStore.activities.get(value) || [];
                  arrayDocs = activities.map((data, idx) => ({ id: `activity_${idx}`, data: () => data }));
                } else if (name === 'message_logs' && field === 'workspaceId') {
                  const logs = mockStore.message_logs.get(value) || [];
                  arrayDocs = logs.map((data, idx) => ({ id: `log_${idx}`, data: () => data }));
                } else if (name === 'tasks' && field === 'workspaceId') {
                  const tasks = mockStore.tasks.get(value) || [];
                  arrayDocs = tasks.map((data, idx) => ({ id: `task_${idx}`, data: () => data }));
                }
                return { empty: arrayDocs.length === 0, docs: arrayDocs, size: arrayDocs.length };
              }

              // Normal Map-based collection queries
              let docs = Array.from(map.entries()).map(([id, data]) => ({ id, data }));

              // Apply filters
              for (const filter of filters) {
                docs = docs.filter(({ id, data }) => {
                  const val = data[filter.field];
                  if (filter.op === '==') return val === filter.value;
                  if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(val);
                  if (filter.op === 'array-contains') return Array.isArray(val) && val.includes(filter.value);
                  return true;
                });
              }

              // Apply orderBy
              if (orderByField) {
                docs.sort((a, b) => {
                  const valA = a.data[orderByField!];
                  const valB = b.data[orderByField!];
                  if (valA === valB) return 0;
                  if (valA === undefined || valA === null) return 1;
                  if (valB === undefined || valB === null) return -1;
                  const res = valA < valB ? -1 : 1;
                  return orderByDir === 'asc' ? res : -res;
                });
              }

              // Apply startAfter
              if (startAfterVal !== null) {
                // If orderByField is set, search for the item matching startAfterVal on that field
                if (orderByField) {
                  const idx = docs.findIndex(({ data }) => data[orderByField!] === startAfterVal);
                  if (idx !== -1) {
                    docs = docs.slice(idx + 1);
                  }
                }
              }

              // Apply limit
              if (limitCount !== null) {
                docs = docs.slice(0, limitCount);
              }

              const formattedDocs = docs.map(({ id, data }) => ({
                id,
                data: () => data,
                ref: collectionMock.doc(id),
              }));

              return {
                empty: formattedDocs.length === 0,
                docs: formattedDocs,
                size: formattedDocs.length,
              };
            },
          };
          return queryMock;
        },
        
        orderBy: (field: string, direction?: string) => {
          return collectionMock.where('_dummy', '==', null).orderBy(field, direction);
        },
        
        limit: (count: number) => {
          return collectionMock.where('_dummy', '==', null).limit(count);
        },
        
        get: async () => {
          const map = getMapForCollection(name);
          if (!map) return { empty: true, docs: [], size: 0 };
          const docs = Array.from(map.entries()).map(([id, data]) => ({
            id,
            data: () => data,
            ref: collectionMock.doc(id),
          }));
          return { empty: docs.length === 0, docs, size: docs.length };
        },
        
        add: async (data: any) => {
          const id = `${name}_${Date.now()}_${Math.random()}`;
          const map = getMapForCollection(name);
          if (map) {
            map.set(id, JSON.parse(JSON.stringify(data)));
          } else {
            // Fallback for arrays
            if (name === 'activities') {
              const activities = mockStore.activities.get(data.workspaceId) || [];
              activities.push({ ...data, id });
              mockStore.activities.set(data.workspaceId, activities);
            } else if (name === 'message_logs') {
              const logs = mockStore.message_logs.get(data.workspaceId) || [];
              logs.push({ ...data, id });
              mockStore.message_logs.set(data.workspaceId, logs);
            } else if (name === 'tasks') {
              const tasks = mockStore.tasks.get(data.workspaceId) || [];
              tasks.push({ ...data, id });
              mockStore.tasks.set(data.workspaceId, tasks);
            }
          }
          return { id, get: async () => ({ exists: true, data: () => data, id }) };
        },
      };
      
      return collectionMock;
    },

    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      const batchMock = {
        set: (ref: any, data: any) => {
          operations.push(async () => {
            await ref.set(data);
          });
          return batchMock;
        },
        update: (ref: any, data: any) => {
          operations.push(async () => {
            await ref.update(data);
          });
          return batchMock;
        },
        delete: (ref: any) => {
          operations.push(async () => {
            await ref.delete();
          });
          return batchMock;
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        },
      };
      return batchMock;
    },
  };

  return { adminDb: dbMock };
};

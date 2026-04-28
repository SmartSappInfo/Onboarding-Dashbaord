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

export const createFirebaseAdminMock = (mockStore: MockStore) => {
  return {
    adminDb: {
      collection: (name: string) => {
        const collectionMock: any = {
          doc: (id: string) => ({
            get: async () => {
              let data;
              switch (name) {
                case 'entities':
                  data = mockStore.entities.get(id);
                  break;
                case 'schools':
                  data = mockStore.schools.get(id);
                  break;
                case 'workspaces':
                  data = mockStore.workspaces.get(id);
                  break;
                case 'users':
                  data = mockStore.users.get(id);
                  break;
                default:
                  data = undefined;
              }
              return {
                exists: !!data,
                id,
                data: () => data,
              };
            },
            set: async (data: any) => {
              switch (name) {
                case 'entities':
                  mockStore.entities.set(id, data);
                  break;
                case 'schools':
                  mockStore.schools.set(id, data);
                  break;
                case 'workspaces':
                  mockStore.workspaces.set(id, data);
                  break;
              }
            },
            update: async (data: any) => {
              switch (name) {
                case 'entities':
                  const entity = mockStore.entities.get(id);
                  if (entity) mockStore.entities.set(id, { ...entity, ...data });
                  break;
                case 'schools':
                  const school = mockStore.schools.get(id);
                  if (school) mockStore.schools.set(id, { ...school, ...data });
                  break;
              }
            },
          }),
          
          where: (field: string, op: string, value: any) => {
            const queryMock: any = {
              where: (f: string, o: string, v: any) => queryMock,
              orderBy: (f: string, direction?: string) => queryMock,
              limit: (l: number) => queryMock,
              get: async () => {
                let docs: any[] = [];
                
                switch (name) {
                  case 'entities':
                    docs = Array.from(mockStore.entities.entries())
                      .filter(([id, data]) => {
                        if (field === 'legacySchoolId') return data.legacySchoolId === value;
                        if (field === 'organizationId') return data.organizationId === value;
                        return true;
                      })
                      .map(([id, data]) => ({ id, data: () => data }));
                    break;
                    
                  case 'schools':
                    docs = Array.from(mockStore.schools.entries())
                      .filter(([id, data]) => {
                        if (field === 'workspaceIds' && op === 'array-contains') {
                          return data.workspaceIds?.includes(value);
                        }
                        return true;
                      })
                      .map(([id, data]) => ({ id, data: () => data }));
                    break;
                    
                  case 'workspace_entities':
                    if (field === 'workspaceId') {
                      const weData = mockStore.workspace_entities.get(value) || [];
                      docs = weData.map((data) => ({ id: data.id, data: () => data }));
                    }
                    break;
                    
                  case 'activities':
                    if (field === 'workspaceId') {
                      const activities = mockStore.activities.get(value) || [];
                      docs = activities.map((data, idx) => ({ 
                        id: `activity_${idx}`, 
                        data: () => data 
                      }));
                    }
                    break;
                    
                  case 'message_logs':
                    if (field === 'workspaceId') {
                      const logs = mockStore.message_logs.get(value) || [];
                      docs = logs.map((data, idx) => ({ 
                        id: `log_${idx}`, 
                        data: () => data 
                      }));
                    }
                    break;
                    
                  case 'tasks':
                    if (field === 'workspaceId') {
                      const tasks = mockStore.tasks.get(value) || [];
                      docs = tasks.map((data, idx) => ({ 
                        id: `task_${idx}`, 
                        data: () => data 
                      }));
                    }
                    break;
                }
                
                return { empty: docs.length === 0, docs };
              },
            };
            return queryMock;
          },
          
          orderBy: (field: string, direction?: string) => {
            return collectionMock.where('_dummy', '==', null);
          },
          
          limit: (count: number) => {
            return collectionMock.where('_dummy', '==', null);
          },
          
          get: async () => {
            let docs: any[] = [];
            
            switch (name) {
              case 'entities':
                docs = Array.from(mockStore.entities.entries())
                  .map(([id, data]) => ({ id, data: () => data }));
                break;
              case 'schools':
                docs = Array.from(mockStore.schools.entries())
                  .map(([id, data]) => ({ id, data: () => data }));
                break;
            }
            
            return { empty: docs.length === 0, docs };
          },
          
          add: async (data: any) => {
            const id = `${name}_${Date.now()}_${Math.random()}`;
            switch (name) {
              case 'activities':
                const activities = mockStore.activities.get(data.workspaceId) || [];
                activities.push({ ...data, id });
                mockStore.activities.set(data.workspaceId, activities);
                break;
              case 'message_logs':
                const logs = mockStore.message_logs.get(data.workspaceId) || [];
                logs.push({ ...data, id });
                mockStore.message_logs.set(data.workspaceId, logs);
                break;
              case 'tasks':
                const tasks = mockStore.tasks.get(data.workspaceId) || [];
                tasks.push({ ...data, id });
                mockStore.tasks.set(data.workspaceId, tasks);
                break;
            }
            return { id };
          },
        };
        
        return collectionMock;
      },
    },
  };
};

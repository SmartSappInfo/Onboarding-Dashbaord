'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where, updateDoc } from 'firebase/firestore';
import type { UserProfile, Workspace, Organization, AppPermissionId } from '@/lib/types';

/**
 * @fileOverview Tenant Context Provider (Sovereignty Layer).
 * Resolves the user's active Organization and authorized Workspaces.
 * - Super Admins: Can switch between all Organizations.
 * - Org Admins/Users: Locked to their assigned Org, can switch between authorized Workspaces.
 */

type TenantContextType = {
  activeOrganizationId: string;
  activeOrganization?: Organization;
  activeWorkspaceId: string;
  activeWorkspace?: Workspace;
  setActiveOrganization: (orgId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  switchOrganizationAndWorkspace: (orgId: string, workspaceId: string) => void;
  availableOrganizations: Organization[];
  accessibleWorkspaces: Workspace[];
  allAccessibleWorkspaces: Workspace[];
  allowedWorkspaces: Workspace[]; // Alias for backward compatibility
  isSuperAdmin: boolean;
  hasPermission: (perm: AppPermissionId) => boolean;
  permissionsSchema?: import('@/lib/types').PermissionsSchema;
  /** Get the permissions schema for any workspace (used by workspace switcher interception) */
  getPermissionsSchemaForWorkspace: (workspaceId: string) => import('@/lib/types').PermissionsSchema | undefined;
  isLoading: boolean;
};
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Promise timed out after ${ms}ms`);
      resolve(fallback);
    }, ms);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      console.error('Promise execution failed:', err);
      resolve(fallback);
    });
  });
}

async function resolveWorkspaceFromPathname(pathname: string, firestore: unknown): Promise<string | null> {
  if (!pathname || !firestore) return null;
  const segments = pathname.split('/');
  
  if (segments[1] === 'admin') {
    const section = segments[2];
    const targetId = segments[3];
    
    // Ignore action keywords
    const keywords = ['new', 'edit', 'settings', 'import', 'upload', 'logs', 'analytics', 'reports', 'profile'];
    if (!targetId || keywords.includes(targetId)) return null;

    const { getDoc, doc } = await import('firebase/firestore');
    const typedFirestore = firestore as import('firebase/firestore').Firestore;
    
    let collectionName = '';
    if (section === 'automations') collectionName = 'automations';
    else if (section === 'surveys') collectionName = 'surveys';
    else if (section === 'pdfs') collectionName = 'pdfs';
    else if (section === 'meetings') collectionName = 'meetings';
    else if (section === 'entities') collectionName = 'workspace_entities';
    else if (section === 'finance' && segments[3] === 'contracts' && segments[4] && !keywords.includes(segments[4])) {
      collectionName = 'contracts';
      const contractId = segments[4];
      try {
        const docRef = doc(typedFirestore, collectionName, contractId);
        const fetchPromise = getDoc(docRef).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            return (data?.workspaceId || data?.workspaceIds?.[0] || null) as string | null;
          }
          return null;
        });
        return withTimeout(fetchPromise, 2500, null);
      } catch (e) {
        console.warn('Failed to resolve workspace from contracts pathname:', e);
        return null;
      }
    }

    if (!collectionName) return null;

    try {
      const docRef = doc(typedFirestore, collectionName, targetId);
      const fetchPromise = getDoc(docRef).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          return (data?.workspaceId || data?.workspaceIds?.[0] || null) as string | null;
        }
        return null;
      });
      return withTimeout(fetchPromise, 2500, null);
    } catch (e) {
      console.warn(`Failed to resolve workspace from pathname for collection ${collectionName}:`, e);
      return null;
    }
  }
  return null;
}

const TenantContext = React.createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeOrganizationId, setActiveOrganizationIdState] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeOrganizationId') || '';
    }
    return '';
  });
  const [activeWorkspaceId, setActiveWorkspaceIdState] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeWorkspaceId') || '';
    }
    return '';
  });
  const [isInitialized, setIsInitialized] = React.useState(false);

  // 1. Fetch User Profile for Permission and Org resolution
  const userRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, 'users', user.uid) : null, 
  [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userRef);

  const isSuperAdmin = React.useMemo(() => {
    return profile?.permissions?.includes('system_admin' as any) || false;
  }, [profile]);

  const hasPermission = React.useCallback((perm: AppPermissionId) => {
    // If we have an active workspace, check its specific permissions first. 
    // Fall back to global permissions for backwards compatibility during migration.
    const wsPermissions = activeWorkspaceId ? profile?.workspacePermissions?.[activeWorkspaceId] : undefined;
    const effectivePermissions = wsPermissions || profile?.permissions;
    return effectivePermissions?.includes(perm) || effectivePermissions?.includes('system_admin' as any) || false;
  }, [profile, activeWorkspaceId]);

  // 2. Fetch Organizations (Superadmins list all, regular users fetch their own org doc)
  const orgsQuery = useMemoFirebase(() => {
    if (!firestore || !user || isProfileLoading || !isSuperAdmin) return null;
    return query(collection(firestore, 'organizations'), orderBy('name', 'asc'));
  }, [firestore, user, isProfileLoading, isSuperAdmin]);
  const { data: allOrgs, isLoading: isAllOrgsLoading } = useCollection<Organization>(orgsQuery);

  const orgDocRef = useMemoFirebase(() => {
    // Prefer the profile's org; fall back to the resolved active org so the org
    // document (brand colors, switcher) still loads for users whose profile has
    // no organizationId but whose org was recovered from their workspace.
    const orgId = profile?.organizationId || activeOrganizationId;
    if (!firestore || !user || isProfileLoading || isSuperAdmin || !orgId) return null;
    return doc(firestore, 'organizations', orgId);
  }, [firestore, user, isProfileLoading, isSuperAdmin, profile?.organizationId, activeOrganizationId]);
  const { data: singleOrg, isLoading: isSingleOrgLoading } = useDoc<Organization>(orgDocRef);

  const organizations = React.useMemo(() => {
    if (isSuperAdmin) {
      return allOrgs || [];
    } else if (singleOrg) {
      return [singleOrg];
    }
    return [];
  }, [isSuperAdmin, allOrgs, singleOrg]);

  const isOrgsLoading = isSuperAdmin ? isAllOrgsLoading : isSingleOrgLoading;

  // 3. Fetch Workspaces belonging to organization context (Fetched globally for superadmins)
  const workspacesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !profile || !profile.isAuthorized) return null;
    
    if (isSuperAdmin) {
      return query(
          collection(firestore, 'workspaces'), 
          orderBy('name', 'asc')
      );
    }
    
    return query(
         collection(firestore, 'workspaces'), 
        where('organizationId', '==', activeOrganizationId),
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId, user, profile, isSuperAdmin]);
  const { data: orgWorkspaces, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);

  // 3b. Deadlock breaker: when an active workspace is known but the organization
  // hasn't resolved (e.g. the user's profile has no organizationId, so the
  // org-filtered workspaces query above returns nothing), fetch the workspace doc
  // directly by id to recover its organizationId. Without this the org can never
  // resolve for such users — the org-filtered query needs the org that it would
  // itself provide. Only runs while the org is unresolved, so it adds no steady
  // -state reads.
  const orphanWorkspaceRef = useMemoFirebase(() =>
    firestore && activeWorkspaceId && !activeOrganizationId
      ? doc(firestore, 'workspaces', activeWorkspaceId)
      : null,
  [firestore, activeWorkspaceId, activeOrganizationId]);
  const { data: orphanWorkspace } = useDoc<Workspace>(orphanWorkspaceRef);

  React.useEffect(() => {
    if (activeOrganizationId || !orphanWorkspace?.organizationId) return;
    setActiveOrganizationIdState(orphanWorkspace.organizationId);
    localStorage.setItem('activeOrganizationId', orphanWorkspace.organizationId);
  }, [activeOrganizationId, orphanWorkspace]);

  // 4. Initial Context Synchronization
  React.useEffect(() => {
    if (isOrgsLoading || isProfileLoading || isUserLoading || !organizations || !profile) return;
    
    if (!isInitialized) {
        // Resolve Active Organization
        const storedOrg = localStorage.getItem('activeOrganizationId');
        let initialOrgId = profile.organizationId; // Default to user's assigned org

        if (isSuperAdmin && storedOrg && organizations.find(o => o.id === storedOrg)) {
            initialOrgId = storedOrg;
        } else if (profile.lastActiveOrganizationId && organizations.find(o => o.id === profile.lastActiveOrganizationId)) {
            initialOrgId = profile.lastActiveOrganizationId;
        } else if (!isSuperAdmin) {
            initialOrgId = profile.organizationId; // Force non-super-admins to their assigned org
        }

        if (isSuperAdmin && !initialOrgId) {
            if (profile.organizationId && organizations.find(o => o.id === profile.organizationId)) {
                initialOrgId = profile.organizationId;
            } else if (organizations.length > 0) {
                initialOrgId = organizations[0].id;
            }
        }

        setActiveOrganizationIdState(initialOrgId || '');

        // Resolve Active Workspace
        const urlTrack = searchParams.get('track') || null;
        const storedWs = localStorage.getItem('activeWorkspaceId');
        
        const currentOrg = organizations?.find(o => o.id === initialOrgId);
        const orgDefaultWsId = currentOrg?.defaultWorkspaceId;
        
        let initialWsId = '';
        if (urlTrack) {
            initialWsId = urlTrack;
        } else if (profile.defaultWorkspaceId) {
            initialWsId = profile.defaultWorkspaceId;
        } else if (orgDefaultWsId) {
            initialWsId = orgDefaultWsId;
        } else if (storedWs) {
            initialWsId = storedWs;
        } else if (profile.lastActiveWorkspaceId) {
            initialWsId = profile.lastActiveWorkspaceId;
        }

        setActiveWorkspaceIdState(initialWsId);
        setIsInitialized(true);
    }
  }, [isOrgsLoading, isProfileLoading, isUserLoading, organizations, profile, isSuperAdmin, isInitialized, searchParams]);

  // 5. Resolve Accessible Workspaces
  const accessibleWorkspaces = React.useMemo(() => {
    if (!orgWorkspaces || !profile) return [];
    
    // Filter by Organization first
    const orgFiltered = orgWorkspaces.filter(w => w.organizationId === activeOrganizationId);

    if (isSuperAdmin) return orgFiltered;

    // Further restrict to user's assigned workspace list
    return orgFiltered.filter(w => profile.workspaceIds?.includes(w.id));
  }, [orgWorkspaces, profile, isSuperAdmin, activeOrganizationId]);

  const allAccessibleWorkspaces = React.useMemo(() => {
    if (!orgWorkspaces || !profile) return [];
    if (isSuperAdmin) return orgWorkspaces;
    return orgWorkspaces.filter(w => profile.workspaceIds?.includes(w.id));
  }, [orgWorkspaces, profile, isSuperAdmin]);

  const activeOrganization = React.useMemo(() => 
    organizations?.find(o => o.id === activeOrganizationId),
  [organizations, activeOrganizationId]);

  const activeWorkspace = React.useMemo(() => 
    orgWorkspaces?.find(w => w.id === activeWorkspaceId),
  [orgWorkspaces, activeWorkspaceId]);

  // Apply brand colors to CSS custom properties for the admin panel
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const primary = activeOrganization?.brandPrimaryColor || '#3B5FFF';
    const secondary = activeOrganization?.brandSecondaryColor || '#8B5CF6';
    root.style.setProperty('--org-primary', primary);
    root.style.setProperty('--org-secondary', secondary);
  }, [activeOrganization?.brandPrimaryColor, activeOrganization?.brandSecondaryColor]);

  // Auto-resolve organization based on active workspace (essential for cross-org workspace switching)
  React.useEffect(() => {
    if (!orgWorkspaces || !activeWorkspaceId) return;
    const ws = orgWorkspaces.find(w => w.id === activeWorkspaceId);
    if (ws && ws.organizationId && ws.organizationId !== activeOrganizationId) {
      setActiveOrganizationIdState(ws.organizationId);
      localStorage.setItem('activeOrganizationId', ws.organizationId);
    }
  }, [orgWorkspaces, activeWorkspaceId, activeOrganizationId]);

  // 6. Final Workspace Correction & URL Sync
  React.useEffect(() => {
    // Only perform fallback/correction once workspaces have finished loading.
    // This prevents aggressive resetting to the default workspace during partial cache hits.
    if (isInitialized && !isWorkspacesLoading && orgWorkspaces && orgWorkspaces.length > 0 && accessibleWorkspaces.length > 0) {
        const isMatchingOrg = orgWorkspaces.every(w => w.organizationId === activeOrganizationId);
        if (!isMatchingOrg) return; // Wait for query to reload matching org workspaces

        let currentId = activeWorkspaceId;
        
        // 6.1. If we don't have a valid ID selected in state, pick an accessible one
        if (!activeWorkspaceId || !accessibleWorkspaces.find(w => w.id === activeWorkspaceId)) {
            // Fallback: personal default -> organization default -> first accessible
            if (profile?.defaultWorkspaceId && accessibleWorkspaces.find(w => w.id === profile.defaultWorkspaceId)) {
                currentId = profile.defaultWorkspaceId;
            } else if (activeOrganization?.defaultWorkspaceId && accessibleWorkspaces.find(w => w.id === activeOrganization.defaultWorkspaceId)) {
                currentId = activeOrganization.defaultWorkspaceId;
            } else {
                currentId = accessibleWorkspaces[0].id;
            }
            setActiveWorkspaceIdState(currentId);
            localStorage.setItem('activeWorkspaceId', currentId);
        }

        // 6.2. URL Enforcement: Ensure the 'track' param matches the active workspace globally.
        // This prevents back-navigation or old links from silently changing the active workspace.
        if (pathname.startsWith('/admin') && currentId) {
            const urlTrack = searchParams.get('track');
            if (!urlTrack || urlTrack !== currentId) {
                const params = new URLSearchParams(searchParams.toString());
                params.set('track', currentId);
                router.replace(`${pathname}?${params.toString()}`);
            }
        }
    }
  }, [isInitialized, isWorkspacesLoading, orgWorkspaces, accessibleWorkspaces, activeWorkspaceId, pathname, searchParams, router, activeOrganization, profile, activeOrganizationId]);

  // Handlers
  const setActiveOrganization = React.useCallback((orgId: string) => {
    if (!isSuperAdmin) return;
    setActiveOrganizationIdState(orgId);
    localStorage.setItem('activeOrganizationId', orgId);
    // When switching Org, we reset Workspace choice
    setActiveWorkspaceIdState('');
    localStorage.removeItem('activeWorkspaceId');

    // Persist to user profile on change
    if (firestore && user && profile && profile.lastActiveOrganizationId !== orgId) {
      updateDoc(doc(firestore, 'users', user.uid), {
        lastActiveOrganizationId: orgId,
        lastActiveWorkspaceId: ''
      }).catch(err => console.error("Failed to save organization persistence: ", err));
    }
  }, [isSuperAdmin, firestore, user, profile]);

  const setActiveWorkspace = React.useCallback((workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
    localStorage.setItem('activeWorkspaceId', workspaceId);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('track', workspaceId);
    router.replace(`${pathname}?${params.toString()}`);

    // Persist to user profile on change
    if (firestore && user && profile && profile.lastActiveWorkspaceId !== workspaceId) {
      updateDoc(doc(firestore, 'users', user.uid), {
        lastActiveWorkspaceId: workspaceId
      }).catch(err => console.error("Failed to save workspace persistence: ", err));
    }
  }, [pathname, router, searchParams, firestore, user, profile]);

  const switchOrganizationAndWorkspace = React.useCallback((orgId: string, workspaceId: string) => {
    if (isSuperAdmin) {
      setActiveOrganizationIdState(orgId);
      localStorage.setItem('activeOrganizationId', orgId);
    }
    setActiveWorkspaceIdState(workspaceId);
    localStorage.setItem('activeWorkspaceId', workspaceId);

    // Persist to user profile on change
    if (firestore && user && profile && 
       (profile.lastActiveOrganizationId !== orgId || profile.lastActiveWorkspaceId !== workspaceId)) {
      const updates: Record<string, any> = { lastActiveWorkspaceId: workspaceId };
      if (isSuperAdmin) {
        updates.lastActiveOrganizationId = orgId;
      }
      updateDoc(doc(firestore, 'users', user.uid), updates)
        .catch(err => console.error("Failed to save org/workspace persistence: ", err));
    }
  }, [isSuperAdmin, firestore, user, profile]);

  const effectivePermissionsSchema = React.useMemo(() => {
    const wsSchema = activeWorkspaceId ? profile?.workspacePermissionsSchemas?.[activeWorkspaceId] : undefined;
    return wsSchema || profile?.permissionsSchema;
  }, [profile, activeWorkspaceId]);

  const getPermissionsSchemaForWorkspace = React.useCallback((workspaceId: string) => {
    return profile?.workspacePermissionsSchemas?.[workspaceId] || profile?.permissionsSchema;
  }, [profile]);

  const value = React.useMemo(() => ({
    activeOrganizationId,
    activeOrganization,
    activeWorkspaceId,
    activeWorkspace,
    setActiveOrganization,
    setActiveWorkspace,
    switchOrganizationAndWorkspace,
    availableOrganizations: organizations || [],
    accessibleWorkspaces,
    allAccessibleWorkspaces,
    allowedWorkspaces: accessibleWorkspaces,
    isSuperAdmin,
    hasPermission,
    permissionsSchema: effectivePermissionsSchema,
    getPermissionsSchemaForWorkspace,
    isLoading: !isInitialized || isUserLoading || isProfileLoading || isOrgsLoading || isWorkspacesLoading
  }), [
    activeOrganizationId, activeOrganization, activeWorkspaceId, activeWorkspace, 
    setActiveOrganization, setActiveWorkspace, switchOrganizationAndWorkspace, organizations, accessibleWorkspaces, allAccessibleWorkspaces, 
    isSuperAdmin, hasPermission, effectivePermissionsSchema, getPermissionsSchemaForWorkspace,
    isInitialized, isUserLoading, isProfileLoading, isOrgsLoading, isWorkspacesLoading
  ]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = React.useContext(TenantContext);
  if (context === undefined) {
    // Return a safe fallback object for contexts outside a TenantProvider
    // (such as the Superadmin Backoffice control plane pages) to prevent runtime crashes.
    return {
      activeOrganizationId: '',
      activeWorkspaceId: '',
      setActiveOrganization: () => {},
      setActiveWorkspace: () => {},
      switchOrganizationAndWorkspace: () => {},
      availableOrganizations: [],
      accessibleWorkspaces: [],
      allAccessibleWorkspaces: [],
      allowedWorkspaces: [],
      isSuperAdmin: true, // Superadmin controls inside shared tools should run freely in backoffice
      hasPermission: () => true, // Bypass local tenant restrictions in the global control plane
      getPermissionsSchemaForWorkspace: () => undefined,
      isLoading: false
    };
  }
  return context;
}

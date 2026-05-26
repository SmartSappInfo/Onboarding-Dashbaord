'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
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
  availableOrganizations: Organization[];
  accessibleWorkspaces: Workspace[];
  allowedWorkspaces: Workspace[]; // Alias for backward compatibility
  isSuperAdmin: boolean;
  hasPermission: (perm: AppPermissionId) => boolean;
  permissionsSchema?: import('@/lib/types').PermissionsSchema;
  /** Get the permissions schema for any workspace (used by workspace switcher interception) */
  getPermissionsSchemaForWorkspace: (workspaceId: string) => import('@/lib/types').PermissionsSchema | undefined;
  isLoading: boolean;
};

const TenantContext = React.createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeOrganizationId, setActiveOrganizationIdState] = React.useState<string>('');
  const [activeWorkspaceId, setActiveWorkspaceIdState] = React.useState<string>('');
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
    if (!firestore || !user || isProfileLoading || isSuperAdmin || !profile?.organizationId) return null;
    return doc(firestore, 'organizations', profile.organizationId);
  }, [firestore, user, isProfileLoading, isSuperAdmin, profile?.organizationId]);
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

  // 3. Fetch all Workspaces belonging to the active Organization (Bypassed if unauthorized)
  const workspacesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId || !user || !profile || !profile.isAuthorized) return null;
    return query(
        collection(firestore, 'workspaces'), 
        where('organizationId', '==', activeOrganizationId),
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId, user, profile]);
  const { data: orgWorkspaces, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);

  // 4. Initial Context Synchronization
  React.useEffect(() => {
    if (isOrgsLoading || isProfileLoading || isUserLoading || !organizations || !profile) return;
    
    if (!isInitialized) {
        // Resolve Active Organization
        const storedOrg = localStorage.getItem('activeOrganizationId');
        let initialOrgId = profile.organizationId; // Default to user's assigned org

        if (isSuperAdmin && storedOrg && organizations.find(o => o.id === storedOrg)) {
            initialOrgId = storedOrg;
        } else if (!isSuperAdmin) {
            initialOrgId = profile.organizationId; // Force non-super-admins to their assigned org
        }

        if (isSuperAdmin && !initialOrgId && organizations.length > 0) {
            initialOrgId = organizations[0].id;
        }

        setActiveOrganizationIdState(initialOrgId || '');

        // Resolve Active Workspace
        const storedWs = localStorage.getItem('activeWorkspaceId');
        const urlTrack = searchParams.get('track') || null;
        
        let initialWsId = '';
        // Prioritize the URL track param if present to allow link sharing,
        // otherwise fall back to the previously open workspace from localStorage.
        if (urlTrack) {
            initialWsId = urlTrack;
        } else if (storedWs) {
            initialWsId = storedWs;
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

  // 6. Final Workspace Correction & URL Sync
  React.useEffect(() => {
    // Only perform fallback/correction once workspaces have finished loading.
    // This prevents aggressive resetting to the default workspace during partial cache hits.
    if (isInitialized && !isWorkspacesLoading && accessibleWorkspaces.length > 0) {
        let currentId = activeWorkspaceId;
        
        // 6.1. If we don't have a valid ID selected in state, pick an accessible one
        if (!activeWorkspaceId || !accessibleWorkspaces.find(w => w.id === activeWorkspaceId)) {
            // Check if organization has a default workspace and user has access to it
            if (activeOrganization?.defaultWorkspaceId && accessibleWorkspaces.find(w => w.id === activeOrganization.defaultWorkspaceId)) {
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
  }, [isInitialized, accessibleWorkspaces, activeWorkspaceId, pathname, searchParams, router]);

  // Handlers
  const setActiveOrganization = React.useCallback((orgId: string) => {
    if (!isSuperAdmin) return;
    setActiveOrganizationIdState(orgId);
    localStorage.setItem('activeOrganizationId', orgId);
    // When switching Org, we reset Workspace choice
    setActiveWorkspaceIdState('');
    localStorage.removeItem('activeWorkspaceId');
  }, [isSuperAdmin]);

  const setActiveWorkspace = React.useCallback((workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
    localStorage.setItem('activeWorkspaceId', workspaceId);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('track', workspaceId);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const activeOrganization = React.useMemo(() => 
    organizations?.find(o => o.id === activeOrganizationId),
  [organizations, activeOrganizationId]);

  const activeWorkspace = React.useMemo(() => 
    orgWorkspaces?.find(w => w.id === activeWorkspaceId),
  [orgWorkspaces, activeWorkspaceId]);

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
    availableOrganizations: organizations || [],
    accessibleWorkspaces,
    allowedWorkspaces: accessibleWorkspaces,
    isSuperAdmin,
    hasPermission,
    permissionsSchema: effectivePermissionsSchema,
    getPermissionsSchemaForWorkspace,
    isLoading: !isInitialized || isUserLoading || isProfileLoading || isOrgsLoading || isWorkspacesLoading
  }), [
    activeOrganizationId, activeOrganization, activeWorkspaceId, activeWorkspace, 
    setActiveOrganization, setActiveWorkspace, organizations, accessibleWorkspaces, 
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
      availableOrganizations: [],
      accessibleWorkspaces: [],
      allowedWorkspaces: [],
      isSuperAdmin: true, // Superadmin controls inside shared tools should run freely in backoffice
      hasPermission: () => true, // Bypass local tenant restrictions in the global control plane
      getPermissionsSchemaForWorkspace: () => undefined,
      isLoading: false
    };
  }
  return context;
}

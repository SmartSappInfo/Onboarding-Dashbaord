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
    return profile?.permissions?.includes(perm) || profile?.permissions?.includes('system_admin' as any) || false;
  }, [profile]);

  // 2. Fetch Organizations
  const orgsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Super Admins see everything. Others only see their assigned org via rules.
    return query(collection(firestore, 'organizations'), orderBy('name', 'asc'));
  }, [firestore]);
  const { data: organizations, isLoading: isOrgsLoading } = useCollection<Organization>(orgsQuery);

  // 3. Fetch all Workspaces belonging to the active Organization
  const workspacesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
        collection(firestore, 'workspaces'), 
        where('organizationId', '==', activeOrganizationId),
        orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);
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
        // Note: Accessible workspaces will be filtered in the next step, 
        // we just need an ID to start with.
        if (urlTrack) initialWsId = urlTrack;
        else if (storedWs) initialWsId = storedWs;

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
    if (isInitialized && accessibleWorkspaces.length > 0) {
        let currentId = activeWorkspaceId;
        
        // 6.1. If we don't have a valid ID selected in state, pick the first accessible one
        if (!activeWorkspaceId || !accessibleWorkspaces.find(w => w.id === activeWorkspaceId)) {
            currentId = accessibleWorkspaces[0].id;
            setActiveWorkspaceIdState(currentId);
            localStorage.setItem('activeWorkspaceId', currentId);
        }

        // 6.2. URL Enforcement: If on dashboard and 'track' param is missing, add it.
        // This ensures Server Components (like the Dashboard Page) see the client's resolved workspace.
        if (pathname === '/admin' && currentId) {
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
    permissionsSchema: profile?.permissionsSchema,
    isLoading: !isInitialized || isUserLoading || isProfileLoading || isOrgsLoading || isWorkspacesLoading
  }), [
    activeOrganizationId, activeOrganization, activeWorkspaceId, activeWorkspace, 
    setActiveOrganization, setActiveWorkspace, organizations, accessibleWorkspaces, 
    isSuperAdmin, hasPermission, profile?.permissionsSchema, isInitialized, isUserLoading, isProfileLoading, isOrgsLoading, isWorkspacesLoading
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
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

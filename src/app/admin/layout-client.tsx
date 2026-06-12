'use client';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QuickComposeButton = dynamic(() => import('@/components/messaging/QuickComposeButton'), { ssr: false });

import { 
    LogOut, 
    User as UserIcon,
} from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { AdminSidebar } from './components/AdminSidebar';
import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import AuthorizationLoader from './components/authorization-loader';
import { enforceSuperAdminProfileAction } from '@/app/actions/onboarding-actions';
import NotificationBell from './components/NotificationBell';
import NotificationCenter from './components/NotificationCenter';
import UnifiedOrgWorkspaceSwitcher from './components/UnifiedOrgWorkspaceSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NavigationProvider } from '@/context/NavigationContext';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { IndustryProvider } from '@/context/IndustryContext';
import { GlobalFilterProvider } from '@/context/GlobalFilterProvider';
import { EntityCacheProvider } from '@/context/EntityCacheContext';
import { BreadcrumbNav } from './components/BreadcrumbNav';
import { useTerminology } from '@/hooks/use-terminology';
import { useFeatures } from '@/hooks/use-features';
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';
import type { AppFeatureId, Role } from '@/lib/types';
import { usePermissions } from '@/hooks/use-permissions';
import { useBackofficeAccess } from '@/hooks/use-backoffice-access';
import { UnsavedChangesProvider } from '@/context/UnsavedChangesContext';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

/**
 * Route to profile-setup, carrying any pending invite code stashed before auth
 * so an invited admin who lands on /admin isn't sent to a code-less setup form.
 */
const profileSetupHref = (): string => {
  if (typeof window === 'undefined') return '/profile-setup';
  const code = sessionStorage.getItem('pendingJoinCode');
  return code ? `/profile-setup?code=${encodeURIComponent(code)}` : '/profile-setup';
};

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { singular, plural, dealPlural } = useTerminology();
  const { activeWorkspaceId } = useTenant();
  const { isFeatureEnabled } = useFeatures();
  
  const [mounted, setMounted] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [loaderStatus, setLoaderStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');
  const [userRolesData, setUserRolesData] = React.useState<{ id: string, name: string }[]>([]);
  const { can, isSystemAdmin } = usePermissions();
  const { hasBackofficeAccess } = useBackofficeAccess();

  // 1. Hydration Guard
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Authorization Engine
  React.useEffect(() => {
    if (isUserLoading || !mounted) return;

    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);

      // Add a 10s timeout so the loader never hangs forever
      const timeoutId = setTimeout(() => {
        console.warn("Auth check timed out - proceeding with basic access");
        setLoaderStatus('success');
        setTimeout(() => setIsReady(true), 600);
      }, 10000);

      getDoc(userDocRef)
        .then(async (docSnap) => {
          clearTimeout(timeoutId);
          // Allow access if doc exists (isAuthorized may not be set on all accounts)
          if (docSnap.exists()) {
            const data = docSnap.data();
            const isSuperAdminUser = data.permissions?.includes('system_admin') || false;

            // 1. Check if user has completed their profile setup (Bypassed for Superadmins)
            if (!isSuperAdminUser && (data.profileCompleted === false || !data.profileCompleted)) {
              setLoaderStatus('success');
              router.push(profileSetupHref());
              return;
            }

            // 1.1 Check if organization is configured (Bypassed for Superadmins)
            if (!isSuperAdminUser && data.organizationId && data.organizationId !== 'smartsapp-hq') {
              try {
                const orgDocRef = doc(firestore, 'organizations', data.organizationId);
                const orgSnap = await getDoc(orgDocRef);
                if (orgSnap.exists()) {
                  const orgData = orgSnap.data();
                  if (orgData.isConfigured === false) {
                    setLoaderStatus('success');
                    router.push('/onboarding/setup');
                    return;
                  }
                }
              } catch (orgErr) {
                console.error("Error checking organization configuration status:", orgErr);
              }
            }

            // 2. Check authorization (Bypassed for Superadmins)
            if (!isSuperAdminUser && data.isAuthorized === false) {
              if (data.approvalStatus === 'pending') {
                setLoaderStatus('success');
                router.push('/awaiting-approval');
                return;
              } else {
                setLoaderStatus('failed');
                toast({ variant: "destructive", title: 'Authorization Required', description: 'Access restricted to approved personnel.' });
                setTimeout(() => { 
                  auth.signOut(); 
                  router.push('/login'); 
                }, 1500);
                return;
              }
            }

            let perms = data.permissions || [];
            const roleIds = data.roles || [];
            
            const resolvedRoles = await Promise.all(
                roleIds.map(async (id: string) => {
                    const snap = await getDoc(doc(firestore, 'roles', id));
                    return snap.exists() ? { id: snap.id, name: (snap.data() as Role).name } : null;
                })
            ).then(results => results.filter((r): r is { id: string, name: string } => r !== null));
            setUserRolesData(resolvedRoles);
            setLoaderStatus('success');
            
            // Allow success animation to complete before revealing the dashboard
            const timer = setTimeout(() => setIsReady(true), 600);
            return () => clearTimeout(timer);
          } else {
            // User doc doesn't exist yet - check if this user is a superadmin first before redirecting to onboarding
            if (user.email) {
              const checkSuper = await enforceSuperAdminProfileAction(user.uid, user.email, user.displayName || '');
              if (checkSuper.success && checkSuper.isSuperAdmin) {
                // Re-fetch document or reload page to let them in
                window.location.reload();
                return;
              }
            }

            setLoaderStatus('success');
            router.push(profileSetupHref());
          }
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          console.error("Auth Fetch Error:", err);
          // On error, allow access rather than blocking - Firestore rules will protect data
          setLoaderStatus('success');
          setTimeout(() => setIsReady(true), 600);
        });
    } else if (!isUserLoading) {
        setLoaderStatus('failed');
        setIsReady(false);
        router.push('/login');
    }
  }, [isUserLoading, user, mounted, firestore, auth, router, toast]);

  if (!mounted) {
 return <div className="min-h-screen w-full bg-background" suppressHydrationWarning />;
  }

  if (!isReady) {
    return <AuthorizationLoader status={loaderStatus} />;
  }

  const operationsPaths = [
    '/admin', '/admin/entities', '/admin/pipeline', '/admin/tasks', 
    '/admin/meetings', '/admin/automations', '/admin/reports'
  ];
  const isOperationsPage = operationsPaths.some(path => {
    return pathname === path || pathname.startsWith(path + '/');
  });

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar />
      <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden relative">
        {/* Subtle radial gradient accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.04),transparent_50%)] pointer-events-none" />
        <header className="sticky top-0 z-50 h-16 flex shrink-0 items-center gap-4 px-6 border-b border-border bg-background/80 backdrop-blur-xl print:hidden">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="flex-1 min-w-0"><BreadcrumbNav /></div>
          <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className="text-[8px] uppercase font-bold tracking-[0.15em] px-2.5 h-5 bg-primary/10 border-primary/20 text-primary hidden sm:flex"
              >
                {plural}
              </Badge>
              <ThemeToggle />
              <QuickComposeButton />
              <NotificationBell />
              <NotificationCenter />
              <div className="h-6 w-px bg-border mx-1" />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
 <Button variant="ghost" className="relative h-10 w-10 rounded-xl p-0 hover:bg-primary/5 transition-all">
 <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-sm">
                      <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName || 'User'} />
 <AvatarFallback className="bg-primary/5 text-primary font-semibold text-xs">{getInitials(user?.displayName || undefined)}</AvatarFallback>
                  </Avatar>
                  </Button>
              </DropdownMenuTrigger>
 <DropdownMenuContent className="w-64 p-2 rounded-2xl border-border bg-card shadow-lg animate-in zoom-in-95 duration-200" align="end">
 <DropdownMenuLabel className="font-normal px-2 py-3">
 <div className="flex flex-col space-y-1 text-left">
 <p className="text-sm font-semibold tracking-tight leading-none text-foreground">{user?.displayName}</p>
 <p className="text-[10px] leading-none text-muted-foreground font-bold tracking-tight">{user?.email}</p>
 <div className="flex flex-wrap gap-1 mt-3">
                        {userRolesData.map(role => (
                            <Badge key={role.id} variant="outline" className="text-[7px] uppercase font-bold px-1.5 h-4 bg-primary/10 border-primary/20 text-primary">{role.name}</Badge>
                        ))}
                      </div>
                  </div>
                  </DropdownMenuLabel>
 <DropdownMenuSeparator className="my-1" />
                  {isSystemAdmin && (
                    <>
                      <AssignedUserGlobalFilter />
 <DropdownMenuSeparator className="my-1" />
                    </>
                  )}
 <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer"><Link href="/admin/profile"><UserIcon className="h-4 w-4 text-primary" /><span className="font-bold text-xs ">My Profile</span></Link></DropdownMenuItem>
 <DropdownMenuSeparator className="my-1" />
 <DropdownMenuItem onClick={() => auth.signOut()} className="rounded-xl p-2.5 gap-3 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"><LogOut className="h-4 w-4" /><span className="font-bold text-xs ">Log out</span></DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-auto relative w-full">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  return (
      <NavigationProvider>
        <UnsavedChangesProvider>
          <TenantProvider>
            <EntityCacheProvider>
              <GlobalFilterProvider>
                <IndustryProvider>
                  <AdminLayoutContent>{children}</AdminLayoutContent>
                </IndustryProvider>
              </GlobalFilterProvider>
            </EntityCacheProvider>
          </TenantProvider>
        </UnsavedChangesProvider>
      </NavigationProvider>
  );
}

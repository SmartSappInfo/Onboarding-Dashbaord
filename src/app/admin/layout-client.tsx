'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
    LayoutDashboard, 
    Layout,
    School, 
    Settings, 
    Calendar, 
    ExternalLink, 
    Film, 
    ClipboardList, 
    Users, 
    LogOut, 
    User as UserIcon, 
    Workflow, 
    History, 
    FileText, 
    MessageSquareText,
    Globe,
    CheckSquare,
    Zap,
    BarChart3,
    Receipt,
    Package,
    Timer,
    Settings2,
    FileCheck,
    Target,
    Tags,
    ClipboardSignature,
    Database,
    ShieldEllipsis
} from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import AuthorizationLoader from './components/authorization-loader';
import NotificationBell from './components/NotificationBell';
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
import { GlobalFilterProvider } from '@/context/GlobalFilterProvider';
import { BreadcrumbNav } from './components/BreadcrumbNav';
import { useTerminology } from '@/hooks/use-terminology';
import { useFeatures } from '@/hooks/use-features';
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';
import type { AppFeatureId, Role } from '@/lib/types';
import { usePermissions } from '@/hooks/use-permissions';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { plural } = useTerminology();
  const { activeWorkspaceId } = useTenant();
  const { isFeatureEnabled } = useFeatures();
  
  const [mounted, setMounted] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [loaderStatus, setLoaderStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');
  const [userRolesData, setUserRolesData] = React.useState<{ id: string, name: string }[]>([]);
  const { can, isSystemAdmin } = usePermissions();

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
            // Only block if explicitly set to false
            if (data.isAuthorized === false) {
              setLoaderStatus('failed');
              toast({ variant: "destructive", title: 'Authorization Required', description: 'Access restricted to approved personnel.' });
              setTimeout(() => { 
                auth.signOut(); 
                router.push('/login'); 
              }, 1500);
              return;
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
            // User doc doesn't exist yet - allow access anyway (new user)
            setLoaderStatus('success');
            setTimeout(() => setIsReady(true), 600);
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
        setTimeout(() => router.push('/login'), 500);
    }
  }, [isUserLoading, user, mounted, firestore, auth, router, toast]);

  if (!mounted) {
 return <div className="min-h-screen w-full bg-background" suppressHydrationWarning />;
  }

  if (!isReady) {
    return <AuthorizationLoader status={loaderStatus} />;
  }

  // Feature-aware visibility: visible = permission check AND feature toggle
  const isVisible = (hasPermission: boolean, featureId?: AppFeatureId) => {
    if (!hasPermission) return false;
    if (!featureId) return true;
    return isFeatureEnabled(featureId);
  };

  const wrapHref = (href: string) => {
    if (!activeWorkspaceId) return href;
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}track=${activeWorkspaceId}`;
  };

  const coreNavItems = [
    { href: wrapHref('/admin'), icon: LayoutDashboard, label: 'Dashboard', visible: isVisible(can('operations', 'dashboard', 'view')) },
    { href: wrapHref('/admin/entities'), icon: School, label: plural, visible: isVisible(can('operations', 'campuses', 'view'), 'entities') },
    { href: wrapHref('/admin/pipeline'), icon: Workflow, label: 'Pipeline', visible: isVisible(can('operations', 'pipeline', 'view'), 'pipeline') },
    { href: wrapHref('/admin/tasks'), icon: CheckSquare, label: 'Tasks', visible: isVisible(can('operations', 'tasks', 'view'), 'tasks') },
    { href: wrapHref('/admin/meetings'), icon: Calendar, label: 'Meetings', visible: isVisible(can('operations', 'meetings', 'view'), 'meetings') },
    { href: wrapHref('/admin/automations'), icon: Zap, label: 'Automations', visible: isVisible(can('operations', 'automations', 'view'), 'automations') },
    { href: wrapHref('/admin/reports'), icon: BarChart3, label: 'Intelligence', visible: isVisible(can('operations', 'intelligence', 'view'), 'reports') },
  ];

  const studioNavItems = [
    { href: wrapHref('/admin/portals'), icon: Globe, label: 'Public Portals', visible: isVisible(can('studios', 'publicPortals', 'view'), 'portals') },
    { href: wrapHref('/admin/pages'), icon: Layout, label: 'Landing Pages', visible: isVisible(can('studios', 'landingPages', 'view'), 'portals') },
    { href: wrapHref('/admin/media'), icon: Film, label: 'Media', visible: isVisible(can('studios', 'media', 'view'), 'media') },
    { href: wrapHref('/admin/surveys'), icon: ClipboardList, label: 'Surveys', visible: isVisible(can('studios', 'surveys', 'view'), 'surveys') },
    { href: wrapHref('/admin/pdfs'), icon: FileText, label: 'Doc Signing', visible: isVisible(can('studios', 'docSigning', 'view'), 'pdfs') },
    { href: wrapHref('/admin/messaging'), icon: MessageSquareText, label: 'Messaging', visible: isVisible(can('studios', 'messaging', 'view'), 'messaging') },
    { href: wrapHref('/admin/forms'), icon: ClipboardSignature, label: 'Forms', visible: isVisible(can('studios', 'forms', 'view'), 'forms') },
    { href: wrapHref('/admin/contacts/tags'), icon: Tags, label: 'Tags', visible: isVisible(can('studios', 'tags', 'view'), 'tags') },
  ];

  const financeNavItems = [
    { href: wrapHref('/admin/finance/contracts'), icon: FileCheck, label: 'Agreements', visible: isVisible(can('finance', 'agreements', 'view'), 'agreements') },
    { href: wrapHref('/admin/finance/invoices'), icon: Receipt, label: 'Invoices', visible: isVisible(can('finance', 'invoices', 'view'), 'invoices') },
    { href: wrapHref('/admin/finance/packages'), icon: Package, label: 'Packages', visible: isVisible(can('finance', 'packages', 'view'), 'packages') },
    { href: wrapHref('/admin/finance/periods'), icon: Timer, label: 'Cycles', visible: isVisible(can('finance', 'cycles', 'view'), 'billing_periods') },
    { href: wrapHref('/admin/finance/settings'), icon: Settings2, label: 'Billing Setup', visible: isVisible(can('finance', 'billingSetup', 'view'), 'billing_setup') },
  ];

  const systemNavItems = [
    { href: wrapHref('/admin/activities'), icon: History, label: 'Activities', visible: can('management', 'activities', 'view') },
    { href: wrapHref('/admin/users'), icon: Users, label: 'Users', visible: can('management', 'users', 'view') },
    { href: wrapHref('/admin/users/roles'), icon: ShieldEllipsis, label: 'Roles & Permissions', visible: isSystemAdmin },
    { href: wrapHref('/admin/settings/fields'), icon: Database, label: 'Fields & Variables', visible: can('management', 'fields', 'view') },
    { href: wrapHref('/admin/settings'), icon: Settings, label: 'System', visible: can('management', 'systemSettings', 'view') },
  ];

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="bg-card text-foreground border-r border-border shadow-2xl print:hidden">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
           <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
        </SidebarHeader>
        
        <SidebarContent className="mt-4 overflow-x-hidden">
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="text-left text-primary/60 dark:text-primary/40 font-semibold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden">Operations</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {coreNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))} tooltip={item.label} className="text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-lg data-[active=true]:shadow-primary/5 rounded-xl h-11 transition-all duration-200">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" /> 
                        <span className="font-semibold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4 px-0">
            <SidebarGroupLabel className="text-left text-primary/60 dark:text-primary/40 font-semibold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden">Finance Hub</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {financeNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-lg data-[active=true]:shadow-primary/5 rounded-xl h-11 transition-all duration-200">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-semibold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
              </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4 px-0">
            <SidebarGroupLabel className="text-left text-primary/60 dark:text-primary/40 font-semibold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden">Studios</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {studioNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-lg data-[active=true]:shadow-primary/5 rounded-xl h-11 transition-all duration-200">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-semibold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-auto pt-8 mb-4 px-0">
            <SidebarGroupLabel className="text-left text-primary/60 dark:text-primary/40 font-semibold text-[10px] mb-2 px-6 uppercase tracking-widest group-data-[collapsible=icon]:hidden">Management</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {systemNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-lg data-[active=true]:shadow-primary/5 rounded-xl h-11 transition-all duration-200">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-semibold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
              </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter className="p-4 border-t border-border bg-black/5 dark:bg-black/20">
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Go to public site" className="text-muted-foreground hover:text-foreground transition-all h-10 group-data-[collapsible=icon]:justify-center">
                        <Link href="/" target="_blank"><ExternalLink className="h-4 w-4 shrink-0" /><span className="font-semibold text-[10px] group-data-[collapsible=icon]:hidden">Live Site</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-background relative">
        {/* Subtle radial gradient accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.04),transparent_50%)] pointer-events-none" />
        <header className="h-16 flex shrink-0 items-center gap-4 px-6 border-b border-border bg-background/80 backdrop-blur-xl print:hidden">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="flex-1 min-w-0"><BreadcrumbNav /></div>
          <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className="text-[8px] uppercase font-bold tracking-[0.15em] px-2.5 h-5 bg-primary/10 border-primary/20 text-primary hidden sm:flex"
              >
                Workspace
              </Badge>
              <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
              <ThemeToggle />
              <NotificationBell />
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
        <main className="flex-1 flex flex-col overflow-auto relative p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  return (
      <NavigationProvider>
        <GlobalFilterProvider>
          <TenantProvider>
            <AdminLayoutContent>{children}</AdminLayoutContent>
          </TenantProvider>
        </GlobalFilterProvider>
      </NavigationProvider>
  );
}

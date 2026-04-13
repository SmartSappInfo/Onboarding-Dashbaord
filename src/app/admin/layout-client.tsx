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
    Layout,
    ClipboardSignature,
    Database
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
import type { AppPermissionId, AppFeatureId, Role } from '@/lib/types';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { plural } = useTerminology();
  const { isFeatureEnabled } = useFeatures();
  
  const [mounted, setMounted] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [loaderStatus, setLoaderStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');
  const [userPermissions, setUserPermissions] = React.useState<AppPermissionId[]>([]);
  const [userRolesData, setUserRolesData] = React.useState<{ id: string, name: string }[]>([]);

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
            setUserPermissions(perms);
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

  const hasPerm = (perm: AppPermissionId) => userPermissions.includes(perm) || userPermissions.includes('system_admin' as any);

  // Feature-aware visibility: visible = permission check AND feature toggle
  const isVisible = (hasPerm: boolean, featureId?: AppFeatureId) => {
    if (!hasPerm) return false;
    if (!featureId) return true;
    return isFeatureEnabled(featureId);
  };

  const coreNavItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', visible: true },
    { href: '/admin/entities', icon: School, label: plural, visible: isVisible(hasPerm('schools_view'), 'entities') },
    { href: '/admin/pipeline', icon: Workflow, label: 'Pipeline', visible: isVisible(hasPerm('schools_view') || hasPerm('prospects_view'), 'pipeline') },
    { href: '/admin/tasks', icon: CheckSquare, label: 'Tasks', visible: isVisible(hasPerm('tasks_manage'), 'tasks') },
    { href: '/admin/meetings', icon: Calendar, label: 'Meetings', visible: isVisible(hasPerm('meetings_manage'), 'meetings') },
    { href: '/admin/automations', icon: Zap, label: 'Automations', visible: isVisible(hasPerm('system_admin'), 'automations') },
    { href: '/admin/reports', icon: BarChart3, label: 'Intelligence', visible: isVisible(hasPerm('activities_view'), 'reports') },
  ];

  const studioNavItems = [
    { href: '/admin/portals', icon: Globe, label: 'Public Portals', visible: isVisible(hasPerm('studios_view'), 'portals') },
    { href: '/admin/pages', icon: Layout, label: 'Landing Pages', visible: isVisible(hasPerm('studios_view'), 'portals') },
    { href: '/admin/media', icon: Film, label: 'Media', visible: isVisible(true, 'media') },
    { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys', visible: isVisible(hasPerm('studios_view'), 'surveys') },
    { href: '/admin/pdfs', icon: FileText, label: 'Doc Signing', visible: isVisible(hasPerm('studios_view'), 'pdfs') },
    { href: '/admin/messaging', icon: MessageSquareText, label: 'Messaging', visible: isVisible(hasPerm('studios_view'), 'messaging') },
    { href: '/admin/forms', icon: ClipboardSignature, label: 'Forms', visible: isVisible(hasPerm('forms_manage'), 'forms') },
    { href: '/admin/contacts/tags', icon: Tags, label: 'Tags', visible: isVisible(hasPerm('tags_view'), 'tags') },
  ];

  const financeNavItems = [
    { href: '/admin/finance/contracts', icon: FileCheck, label: 'Agreements', visible: isVisible(hasPerm('finance_view'), 'agreements') },
    { href: '/admin/finance/invoices', icon: Receipt, label: 'Invoices', visible: isVisible(hasPerm('finance_view'), 'invoices') },
    { href: '/admin/finance/packages', icon: Package, label: 'Packages', visible: isVisible(hasPerm('finance_view'), 'packages') },
    { href: '/admin/finance/periods', icon: Timer, label: 'Cycles', visible: isVisible(hasPerm('finance_view'), 'billing_periods') },
    { href: '/admin/finance/settings', icon: Settings2, label: 'Billing Setup', visible: isVisible(hasPerm('finance_manage'), 'billing_setup') },
  ];

  const systemNavItems = [
    { href: '/admin/activities', icon: History, label: 'Activities', visible: hasPerm('activities_view') },
    { href: '/admin/users', icon: Users, label: 'Users', visible: hasPerm('system_admin') },
    { href: '/admin/settings/fields', icon: Database, label: 'Fields & Variables', visible: hasPerm('fields_manage') },
    { href: '/admin/settings', icon: Settings, label: 'System', visible: hasPerm('system_admin') },
  ];

  return (
    <SidebarProvider defaultOpen={true}>
 <Sidebar collapsible="icon" className="bg-[#0A1427] text-white border-r-0 shadow-2xl print:hidden">
 <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
           <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
        </SidebarHeader>
        
 <SidebarContent className="mt-4 overflow-x-hidden">
 <SidebarGroup className="px-0">
 <SidebarGroupLabel className="text-left text-white/40 font-semibold text-[10px] mb-2 px-6 group-data-[collapsible=icon]:hidden">Operations</SidebarGroupLabel>
 <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {coreNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
 <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-card/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
 <item.icon className="h-5 w-5 shrink-0" /> 
 <span className="font-bold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

 <SidebarGroup className="mt-4 px-0">
 <SidebarGroupLabel className="text-left text-white/40 font-semibold text-[10px] mb-2 px-6 group-data-[collapsible=icon]:hidden">Finance Hub</SidebarGroupLabel>
 <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {financeNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
 <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-card/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
 <item.icon className="h-5 w-5 shrink-0" />
 <span className="font-bold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
              </SidebarMenu>
          </SidebarGroup>

 <SidebarGroup className="mt-4 px-0">
 <SidebarGroupLabel className="text-left text-white/40 font-semibold text-[10px] mb-2 px-6 group-data-[collapsible=icon]:hidden">Studios</SidebarGroupLabel>
 <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {studioNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
 <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-card/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
 <item.icon className="h-5 w-5 shrink-0" />
 <span className="font-bold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

 <SidebarGroup className="mt-auto pt-8 mb-4 px-0">
 <SidebarGroupLabel className="text-left text-white/40 font-semibold text-[10px] mb-2 px-6 group-data-[collapsible=icon]:hidden">Management</SidebarGroupLabel>
 <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {systemNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
 <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-card/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
 <item.icon className="h-5 w-5 shrink-0" />
 <span className="font-bold text-xs tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
              </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
 <SidebarFooter className="p-6 border-t border-white/5 bg-black/20">
            <SidebarMenu>
                <SidebarMenuItem>
 <SidebarMenuButton asChild tooltip="Go to public site" className="text-white/40 hover:text-white transition-all h-10 group-data-[collapsible=icon]:justify-center">
 <Link href="/" target="_blank"><ExternalLink className="h-4 w-4 shrink-0" /><span className="font-semibold text-[10px] group-data-[collapsible=icon]:hidden">Live Site</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
 <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-background relative">
        {/* Dark Mode Background Aura */}
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,95,255,0.05),transparent_50%)] pointer-events-none hidden dark:block" />
 <header className="glass-header h-16 flex shrink-0 items-center gap-4 px-6 print:hidden">
 <SidebarTrigger className="-ml-1" />
 <div className="flex-1 min-w-0"><BreadcrumbNav /></div>
 <div className="flex items-center gap-3 shrink-0">
              <ThemeToggle />
              <NotificationBell />
 <div className="h-8 w-px bg-border mx-1" />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
 <Button variant="ghost" className="relative h-10 w-10 rounded-xl p-0 hover:bg-primary/5 transition-all">
 <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-sm">
                      <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName || 'User'} />
 <AvatarFallback className="bg-primary/5 text-primary font-semibold text-xs">{getInitials(user?.displayName || undefined)}</AvatarFallback>
                  </Avatar>
                  </Button>
              </DropdownMenuTrigger>
 <DropdownMenuContent className="w-64 p-2 rounded-2xl border-none shadow-2xl animate-in zoom-in-95 duration-200" align="end">
 <DropdownMenuLabel className="font-normal px-2 py-3">
 <div className="flex flex-col space-y-1 text-left">
 <p className="text-sm font-semibold tracking-tight leading-none text-foreground">{user?.displayName}</p>
 <p className="text-[10px] leading-none text-muted-foreground font-bold tracking-tight">{user?.email}</p>
 <div className="flex flex-wrap gap-1 mt-3">
                        {userRolesData.map(role => (
                            <Badge key={role.id} variant="outline" className="text-[8px] uppercase font-semibold px-1.5 h-4 bg-primary/5 border-primary/20 text-primary">{role.name}</Badge>
                        ))}
                      </div>
                  </div>
                  </DropdownMenuLabel>
 <DropdownMenuSeparator className="my-1" />
                  {hasPerm('system_user_switch') && (
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

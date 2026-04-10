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
    Tags
} from 'lucide-react';
import { SmartSappLogo as Logo, SmartSappIcon } from '@/components/icons';
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
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';
import type { AppPermissionId, Role } from '@/lib/types';

const getInitials = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
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
      getDoc(userDocRef)
        .then(async (docSnap) => {
          if (docSnap.exists() && docSnap.data().isAuthorized === true) {
            const data = docSnap.data();
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
            setLoaderStatus('failed');
            toast({ variant: "destructive", title: 'Authorization Required', description: 'Access restricted to approved personnel.' });
            setTimeout(() => { 
              auth.signOut(); 
              router.push('/login'); 
            }, 1500);
          }
        })
        .catch((err) => {
          console.error("Auth Fetch Error:", err);
          setLoaderStatus('failed');
          setTimeout(() => { 
            auth.signOut(); 
            router.push('/login'); 
          }, 1500);
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

  const coreNavItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', visible: true },
    { href: '/admin/entities', icon: School, label: 'Schools', visible: hasPerm('schools_view') },
    // { href: '/admin/prospects', icon: Target, label: 'Prospects', visible: hasPerm('prospects_view') }, // TODO: Implement prospects page
    { href: '/admin/pipeline', icon: Workflow, label: 'Pipeline', visible: hasPerm('schools_view') || hasPerm('prospects_view') },
    { href: '/admin/tasks', icon: CheckSquare, label: 'Tasks', visible: hasPerm('tasks_manage') },
    { href: '/admin/meetings', icon: Calendar, label: 'Meetings', visible: hasPerm('meetings_manage') },
    { href: '/admin/automations', icon: Zap, label: 'Automations', visible: hasPerm('system_admin') },
    { href: '/admin/reports', icon: BarChart3, label: 'Intelligence', visible: hasPerm('activities_view') },
  ];

  const studioNavItems = [
    { href: '/admin/portals', icon: Globe, label: 'Public Portals', visible: hasPerm('studios_view') },
    { href: '/admin/media', icon: Film, label: 'Media', visible: true },
    { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys', visible: hasPerm('studios_view') },
    { href: '/admin/pdfs', icon: FileText, label: 'Doc Signing', visible: hasPerm('studios_view') },
    { href: '/admin/messaging', icon: MessageSquareText, label: 'Messaging', visible: hasPerm('studios_view') },
    { href: '/admin/contacts/tags', icon: Tags, label: 'Tags', visible: hasPerm('tags_view') },
  ];

  const financeNavItems = [
    { href: '/admin/finance/contracts', icon: FileCheck, label: 'Agreements', visible: hasPerm('finance_view') },
    { href: '/admin/finance/invoices', icon: Receipt, label: 'Invoices', visible: hasPerm('finance_view') },
    { href: '/admin/finance/packages', icon: Package, label: 'Packages', visible: hasPerm('finance_view') },
    { href: '/admin/finance/periods', icon: Timer, label: 'Cycles', visible: hasPerm('finance_view') },
    { href: '/admin/finance/settings', icon: Settings2, label: 'Billing Setup', visible: hasPerm('finance_manage') },
  ];

  const systemNavItems = [
    { href: '/admin/activities', icon: History, label: 'Activities', visible: hasPerm('activities_view') },
    { href: '/admin/users', icon: Users, label: 'Users', visible: hasPerm('system_admin') },
    { href: '/admin/settings', icon: Settings, label: 'System', visible: hasPerm('system_admin') },
  ];

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="bg-[#0A1427] text-white border-r-0 shadow-2xl print:hidden">
        <SidebarHeader className="p-6 group-data-[collapsible=icon]:p-2">
          <Link href="/admin" className="flex items-center gap-3 font-semibold group">
            <div className="bg-white rounded-xl p-1.5 shadow-xl group-hover:scale-110 transition-transform shrink-0">
              <SmartSappIcon variant="primary" className="h-6 w-6" />
            </div>
            <span className="text-xl font-black uppercase tracking-tighter text-white group-data-[collapsible=icon]:hidden">SmartSapp</span>
          </Link>
        </SidebarHeader>
        
        <SidebarContent className="mt-4 overflow-x-hidden">
          <SidebarGroup className="px-0">
            <SidebarGroupLabel className="text-left text-white/40 font-black uppercase text-[10px] tracking-[0.2em] mb-2 px-6 group-data-[collapsible=icon]:hidden">Operations</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {coreNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-white/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" /> 
                        <span className="font-bold text-xs uppercase tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4 px-0">
              <SidebarGroupLabel className="text-left text-white/40 font-black uppercase text-[10px] tracking-[0.2em] mb-2 px-6 group-data-[collapsible=icon]:hidden">Finance Hub</SidebarGroupLabel>
              <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {financeNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-white/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              ))}
              </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4 px-0">
            <SidebarGroupLabel className="text-left text-white/40 font-black uppercase text-[10px] tracking-widest mb-2 px-6 group-data-[collapsible=icon]:hidden">Studios</SidebarGroupLabel>
            <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {studioNavItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-white/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-auto pt-8 mb-4 px-0">
              <SidebarGroupLabel className="text-left text-white/40 font-black uppercase text-[10px] tracking-widest mb-2 px-6 group-data-[collapsible=icon]:hidden">Management</SidebarGroupLabel>
              <SidebarMenu className="gap-1 px-3 group-data-[collapsible=icon]:px-2">
              {systemNavItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label} className="text-white/70 hover:text-white hover:bg-white/10 data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-lg rounded-xl h-11 transition-all">
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wide group-data-[collapsible=icon]:hidden">{item.label}</span>
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
                        <Link href="/" target="_blank"><ExternalLink className="h-4 w-4 shrink-0" /><span className="font-black text-[10px] uppercase tracking-widest group-data-[collapsible=icon]:hidden">Live Site</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur-md shadow-sm print:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1 min-w-0"><BreadcrumbNav /></div>
          <div className="flex items-center gap-3 shrink-0">
              <UnifiedOrgWorkspaceSwitcher />
              {hasPerm('system_user_switch') && <AssignedUserGlobalFilter />}
              <NotificationBell />
              <div className="h-8 w-px bg-border mx-1" />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-xl p-0 hover:bg-primary/5 transition-all">
                  <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-sm">
                      <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName || 'User'} />
                      <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{getInitials(user?.displayName || undefined)}</AvatarFallback>
                  </Avatar>
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2 rounded-2xl border-none shadow-2xl animate-in zoom-in-95 duration-200" align="end">
                  <DropdownMenuLabel className="font-normal px-2 py-3">
                  <div className="flex flex-col space-y-1 text-left">
                      <p className="text-sm font-black uppercase tracking-tight leading-none text-foreground">{user?.displayName}</p>
                      <p className="text-[10px] leading-none text-muted-foreground font-bold tracking-tight">{user?.email}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {userRolesData.map(role => (
                            <Badge key={role.id} variant="outline" className="text-[8px] uppercase font-black px-1.5 h-4 bg-primary/5 border-primary/20 text-primary">{role.name}</Badge>
                        ))}
                      </div>
                  </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3 cursor-pointer"><Link href="/admin/profile"><UserIcon className="h-4 w-4 text-primary" /><span className="font-bold text-xs uppercase">My Profile</span></Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onClick={() => auth.signOut()} className="rounded-xl p-2.5 gap-3 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"><LogOut className="h-4 w-4" /><span className="font-bold text-xs uppercase">Log out</span></DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-auto relative p-4 sm:p-6 md:p-8">
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

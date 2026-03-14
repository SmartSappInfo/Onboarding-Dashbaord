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
    RefreshCw, 
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
    GraduationCap,
    ShieldAlert,
    Target
} from 'lucide-react';
import { SmartSappLogo as Logo, SmartSappIcon } from '@/components/icons';
import { useUser, useAuth, useFirestore } from '@/firebase';
import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeProvider } from '@/components/theme-provider';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import AuthorizationLoader from './components/authorization-loader';
import NotificationBell from './components/NotificationBell';
import PerspectiveSwitcher from './components/PerspectiveSwitcher';
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
import { GlobalFilterProvider } from '@/context/GlobalFilterProvider';
import { NavigationProvider } from '@/context/NavigationContext';
import { PerspectiveProvider } from '@/context/PerspectiveContext';
import { BreadcrumbNav } from './components/BreadcrumbNav';
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';
import type { UserRole, AppPermissionId, Role } from '@/lib/types';

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <UserIcon size={16} />;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [isReady, setIsReady] = React.useState(false);
  const [loaderStatus, setLoaderStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');
  const [userPermissions, setUserPermissions] = React.useState<AppPermissionId[]>([]);
  const [userRolesData, setUserRolesData] = React.useState<{ id: string, name: string }[]>([]);

  React.useEffect(() => {
    if (isUserLoading) return;

    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef)
        .then(async (docSnap) => {
          if (docSnap.exists() && docSnap.data().isAuthorized === true) {
            const data = docSnap.data();
            
            // 1. Resolve Permissions
            let perms = data.permissions || [];
            
            // 2. Fetch Role Names for Display
            const roleIds = data.roles || [];
            const roleDocs = await Promise.all(
                roleIds.map((id: string) => getDoc(doc(firestore, 'roles', id)))
            );
            
            const resolvedRoles = roleDocs
                .filter(d => d.exists())
                .map(d => ({ id: d.id, name: (d.data() as Role).name }));
            
            setUserRolesData(resolvedRoles);
            setUserPermissions(perms);
            
            setLoaderStatus('success');
            setTimeout(() => setIsReady(true), 800);
          } else {
            setLoaderStatus('failed');
            toast({
              variant: "destructive",
              title: 'Authorization Required',
              description: 'Your account is not authorized to access this area.',
            });
            setTimeout(() => {
              auth.signOut();
              router.push('/login');
            }, 1200);
          }
        })
        .catch(error => {
          console.error("Authorization check failed:", error);
          setLoaderStatus('failed');
          setTimeout(() => { auth.signOut(); router.push('/login'); }, 1200);
        });
    } else if (userError) {
        router.push('/login');
    } else {
      setLoaderStatus('failed');
      setTimeout(() => { router.push('/login'); }, 1000);
    }
  }, [isUserLoading, user, userError, router, firestore, auth, toast]);

  if (!isReady) {
    return (
        <div className="relative h-screen w-full">
            <AuthorizationLoader status={loaderStatus} />
        </div>
    );
  }

  const hasPerm = (perm: AppPermissionId) => userPermissions.includes(perm) || userPermissions.includes('system_admin' as any);

  const coreNavItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', visible: true },
    { href: '/admin/schools', icon: School, label: 'Schools', visible: hasPerm('schools_view') },
    { href: '/admin/prospects', icon: Target, label: 'Prospects', visible: hasPerm('prospects_view') },
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NavigationProvider>
        <GlobalFilterProvider>
          <PerspectiveProvider>
            <SidebarProvider defaultOpen={false}>
              <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
                <Sidebar collapsible="icon" className="border-r rounded-tr-lg rounded-br-lg print:hidden">
                  <SidebarHeader className="p-2 text-left">
                    <div className="flex h-10 items-center justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 px-2">
                        <Link href="/admin" className="flex items-center gap-2 font-semibold">
                          <Logo variant="white" className="h-8 w-auto group-data-[collapsible=icon]:hidden" />
                          <SmartSappIcon variant="white" className="h-8 w-8 hidden group-data-[collapsible=icon]:block" />
                          <span className="sr-only">SmartSapp</span>
                        </Link>
                    </div>
                  </SidebarHeader>
                  <SidebarContent className="text-left">
                    <SidebarGroup>
                      <div className="flex h-10 items-center justify-between group-data-[collapsible=icon]:justify-center">
                        <SidebarGroupLabel className="text-left">Operations</SidebarGroupLabel>
                        <SidebarTrigger className="hidden md:flex mr-2 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[state=collapsed]:justify-center"/>
                      </div>
                      <SidebarMenu>
                        {coreNavItems.filter(i => i.visible).map((item) => (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))} tooltip={item.label}>
                                <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroup>

                    {hasPerm('finance_view') && (
                      <SidebarGroup>
                          <SidebarGroupLabel className="text-left">Finance Hub</SidebarGroupLabel>
                          <SidebarMenu>
                          {financeNavItems.filter(i => i.visible).map((item) => (
                              <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                  <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                              </SidebarMenuButton>
                              </SidebarMenuItem>
                          ))}
                          </SidebarMenu>
                      </SidebarGroup>
                    )}

                    <SidebarGroup>
                      <SidebarGroupLabel className="text-left">Studios</SidebarGroupLabel>
                      <SidebarMenu>
                        {studioNavItems.filter(i => i.visible).map((item) => (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroup>

                    <SidebarGroup className="mt-auto">
                        <SidebarGroupLabel className="text-left">Management</SidebarGroupLabel>
                        <SidebarMenu>
                        {systemNavItems.filter(i => i.visible).map((item) => (
                            <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                        </SidebarMenu>
                    </SidebarGroup>
                  </SidebarContent>
                  <SidebarFooter className="text-left">
                      <SidebarMenu>
                          <SidebarMenuItem>
                              <SidebarMenuButton asChild tooltip="Go to public site">
                                  <Link href="/" target="_blank"><ExternalLink/><span>Go to site</span></Link>
                              </SidebarMenuButton>
                          </SidebarMenuItem>
                      </SidebarMenu>
                  </SidebarFooter>
                </Sidebar>
                
                <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden">
                  <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur-sm print:hidden">
                    <SidebarTrigger className="md:hidden" />
                    <div className="flex-1 min-w-0"><BreadcrumbNav /></div>
                    <div className="flex items-center gap-2 shrink-0">
                        <PerspectiveSwitcher />
                        {hasPerm('system_user_switch') && <AssignedUserGlobalFilter />}
                        <NotificationBell />
                        <ThemeToggle />
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                            </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 text-left" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-black leading-none">{user?.displayName}</p>
                                <p className="text-[10px] leading-none text-muted-foreground font-bold">{user?.email}</p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {userRolesData.map(role => (
                                      <Badge key={role.id} variant="outline" className="text-[8px] uppercase font-black px-1.5 h-4 bg-primary/5 border-primary/20 text-primary">{role.name}</Badge>
                                  ))}
                                </div>
                            </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild><Link href="/admin/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></Link></DropdownMenuItem>
                            {hasPerm('system_admin') && (
                              <>
                                  <DropdownMenuItem asChild><Link href="/admin/users"><Users className="mr-2 h-4 w-4" /><span>Users</span></Link></DropdownMenuItem>
                                  <DropdownMenuItem asChild><Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link></DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => auth.signOut()}><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </header>
                  <main className="flex-1 flex flex-col overflow-auto bg-background relative">{children}</main>
                </SidebarInset>
              </div>
            </SidebarProvider>
          </PerspectiveProvider>
        </GlobalFilterProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
}

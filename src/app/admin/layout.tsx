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
    GraduationCap
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
import { BreadcrumbNav } from './components/BreadcrumbNav';
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';
import type { UserRole } from '@/lib/types';

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
  const [userRoles, setUserRoles] = React.useState<UserRole[]>([]);

  React.useEffect(() => {
    if (isUserLoading) return;

    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef)
        .then(docSnap => {
          if (docSnap.exists() && docSnap.data().isAuthorized === true) {
            const data = docSnap.data();
            // Handle both legacy role and new roles array
            const roles = data.roles || (data.role ? [data.role] : ['cse']);
            setUserRoles(roles);
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

  const hasRole = (role: UserRole) => userRoles.includes(role) || userRoles.includes('admin');

  const isAdmin = hasRole('admin');
  const isFinance = hasRole('finance');
  const isSupervisor = hasRole('supervisor');
  const isTrainer = hasRole('trainer');

  const coreNavItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', visible: true },
    { href: '/admin/schools', icon: School, label: 'Schools', visible: true },
    { href: '/admin/pipeline', icon: Workflow, label: 'Pipeline', visible: true },
    { href: '/admin/tasks', icon: CheckSquare, label: 'Tasks', visible: true },
    { href: '/admin/meetings', icon: Calendar, label: 'Meetings', visible: true },
    { href: '/admin/automations', icon: Zap, label: 'Automations', visible: isAdmin },
    { href: '/admin/reports', icon: BarChart3, label: 'Intelligence', visible: isSupervisor || isAdmin },
  ];

  const studioNavItems = [
    { href: '/admin/portals', icon: Globe, label: 'Public Portals', visible: isSupervisor || isAdmin },
    { href: '/admin/media', icon: Film, label: 'Media', visible: true },
    { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys', visible: isSupervisor || isFinance || isAdmin },
    { href: '/admin/pdfs', icon: FileText, label: 'Doc Signing', visible: isSupervisor || isFinance || isAdmin },
    { href: '/admin/messaging', icon: MessageSquareText, label: 'Messaging', visible: isSupervisor || isAdmin },
  ];

  const financeNavItems = [
    { href: '/admin/finance/contracts', icon: FileCheck, label: 'Agreements', visible: isFinance || isAdmin },
    { href: '/admin/finance/invoices', icon: Receipt, label: 'Invoices', visible: isFinance || isAdmin },
    { href: '/admin/finance/packages', icon: Package, label: 'Packages', visible: isFinance || isAdmin },
    { href: '/admin/finance/periods', icon: Timer, label: 'Cycles', visible: isFinance || isAdmin },
    { href: '/admin/finance/settings', icon: Settings2, label: 'Billing Setup', visible: isFinance || isAdmin },
  ];

  const systemNavItems = [
    { href: '/admin/activities', icon: History, label: 'Activities', visible: isSupervisor || isAdmin },
    { href: '/admin/users', icon: Users, label: 'Users', visible: isAdmin },
    { href: '/admin/settings', icon: Settings, label: 'System', visible: isAdmin },
  ];

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NavigationProvider>
        <GlobalFilterProvider>
          <SidebarProvider defaultOpen={false}>
            <div className="flex h-screen w-full bg-background text-foreground">
              <Sidebar collapsible="icon" className="border-r rounded-tr-lg rounded-br-lg print:hidden">
                <SidebarHeader className="p-2">
                   <div className="flex h-10 items-center justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 px-2">
                      <Link href="/admin" className="flex items-center gap-2 font-semibold">
                        <Logo variant="white" className="h-8 w-auto group-data-[collapsible=icon]:hidden" />
                        <SmartSappIcon variant="white" className="h-8 w-8 hidden group-data-[collapsible=icon]:block" />
                        <span className="sr-only">SmartSapp</span>
                      </Link>
                   </div>
                </SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <div className="flex h-10 items-center justify-between group-data-[collapsible=icon]:justify-center">
                      <SidebarGroupLabel>Operations</SidebarGroupLabel>
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

                  {(isFinance || isAdmin) && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Finance Hub</SidebarGroupLabel>
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
                    <SidebarGroupLabel>Studios</SidebarGroupLabel>
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
                      <SidebarGroupLabel>Management</SidebarGroupLabel>
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
                <SidebarFooter>
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
                      <AssignedUserGlobalFilter />
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
                      <DropdownMenuContent className="w-56" align="end" forceMount>
                          <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                              <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {userRoles.map(role => (
                                    <Badge key={role} variant="outline" className="text-[8px] uppercase font-black px-1.5 h-4">{role}</Badge>
                                ))}
                              </div>
                          </div>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild><Link href="/admin/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></Link></DropdownMenuItem>
                          {isAdmin && (
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
                <main className="flex-1 flex flex-col overflow-auto bg-background">{children}</main>
              </SidebarInset>
            </div>
          </SidebarProvider>
        </GlobalFilterProvider>
      </NavigationProvider>
    </ThemeProvider>
  );
}

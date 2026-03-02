
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
import { LayoutDashboard, School, Settings, Calendar, ExternalLink, Film, ClipboardList, Users, LogOut, User as UserIcon, Workflow, History, FileText, RefreshCw, MessageSquareText } from 'lucide-react';
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
import { GlobalFilterProvider } from '@/context/GlobalFilterProvider';
import AssignedUserGlobalFilter from './components/AssignedUserGlobalFilter';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schools', icon: School, label: 'Schools' },
  { href: '/admin/pipeline', icon: Workflow, label: 'Pipeline' },
  { href: '/admin/meetings', icon: Calendar, label: 'Meetings' },
  { href: '/admin/media', icon: Film, label: 'Media' },
  { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys' },
  { href: '/admin/pdfs', icon: FileText, label: 'Doc Signing' },
  { href: '/admin/messaging', icon: MessageSquareText, label: 'Messaging' },
  { href: '/admin/activities', icon: History, label: 'Activities' },
];

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
  const [retryCount, setRetryCount] = React.useState(0);

  const pageTitle = React.useMemo(() => {
    if (pathname.startsWith('/admin/settings')) return 'Settings';
    if (pathname.startsWith('/admin/users')) return 'Users';
    if (pathname.startsWith('/admin/profile')) return 'Profile';
    
    const activeItem = [...navItems].reverse().find(item => pathname.startsWith(item.href));
    return activeItem?.label || 'Dashboard';
  }, [pathname]);

  React.useEffect(() => {
    if (pageTitle) {
      document.title = `Onboarding Workspace - ${pageTitle}`;
    }
  }, [pageTitle]);

  React.useEffect(() => {
    if (isUserLoading) {
      return;
    }

    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef)
        .then(docSnap => {
          if (docSnap.exists() && docSnap.data().isAuthorized === true) {
            setLoaderStatus('success');
            setTimeout(() => {
              setIsReady(true);
            }, 1000);
          } else {
            // User exists but is not authorized
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
          
          const isNetworkError = error.message?.includes('network-request-failed') || error.code === 'unavailable';
          
          if (isNetworkError) {
            // Don't sign out on network errors. Let the user retry or wait.
            setLoaderStatus('failed');
            toast({
              variant: "destructive",
              title: 'Connection Error',
              description: 'Failed to connect to the server. Please check your connection.',
            });
          } else {
            // For other critical errors, proceed with logout
            setLoaderStatus('failed');
            toast({
              variant: "destructive",
              title: 'Error',
              description: 'Failed to check your authorization status.',
            });
            setTimeout(() => {
              auth.signOut();
              router.push('/login');
            }, 1200);
          }
        });
    } else if (userError) {
        // Auth service level error
        console.error("Auth listener error:", userError);
        if (userError.message?.includes('network-request-failed')) {
            setLoaderStatus('failed');
            toast({
                variant: "destructive",
                title: 'Auth Connection Failure',
                description: 'The authentication service is temporarily unavailable.',
            });
        } else {
            router.push('/login');
        }
    } else {
      // User is logged out
      setLoaderStatus('failed');
      setTimeout(() => {
        router.push('/login');
      }, 1000);
    }
  }, [isUserLoading, user, userError, router, firestore, auth, toast, retryCount]);

  if (!isReady) {
    return (
        <div className="relative h-screen w-full">
            <AuthorizationLoader status={loaderStatus} />
            {loaderStatus === 'failed' && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-4">
                    <Button onClick={() => setRetryCount(prev => prev + 1)} className="gap-2 shadow-2xl">
                        <RefreshCw className="h-4 w-4" /> Retry Connection
                    </Button>
                    <Button variant="ghost" onClick={() => auth.signOut()} className="text-muted-foreground text-xs underline">
                        Back to Login
                    </Button>
                </div>
            )}
        </div>
    );
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
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
                    <SidebarGroupLabel>Onboarding Workspace</SidebarGroupLabel>
                    <SidebarTrigger className="hidden md:flex mr-2 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full group-data-[state=collapsed]:justify-center"/>
                  </div>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))}
                            tooltip={item.label}
                          >
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
                            </Link>
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
                              <Link href="/" target="_blank">
                                  <ExternalLink/>
                                  <span>Go to site</span>
                              </Link>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                  </SidebarMenu>
              </SidebarFooter>
            </Sidebar>
            
            <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b bg-card/95 px-4 backdrop-blur-sm print:hidden">
                <SidebarTrigger className="md:hidden" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
                </div>
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
                        </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                        <Link href="/admin/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                        <Link href="/admin/users"><Users className="mr-2 h-4 w-4" /><span>Users</span></Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                        <Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => auth.signOut()}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </header>
      
              <main className="flex-1 flex flex-col overflow-auto bg-background">
                {children}
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </GlobalFilterProvider>
    </ThemeProvider>
  );
}

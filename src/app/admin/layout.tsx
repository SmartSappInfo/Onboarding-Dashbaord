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
import { LayoutDashboard, School, Settings, Calendar, ExternalLink, Film, ClipboardList, Users } from 'lucide-react';
import { SmartSappLogo as Logo, SmartSappIcon } from '@/components/icons';
import { useUser, useAuth, useFirestore } from '@/firebase';
import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeProvider } from '@/components/theme-provider';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import AuthorizationLoader from './components/authorization-loader';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schools', icon: School, label: 'Schools' },
  { href: '/admin/meetings', icon: Calendar, label: 'Meetings' },
  { href: '/admin/media', icon: Film, label: 'Media' },
  { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys' },
];


export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [isReady, setIsReady] = React.useState(false);
  const [loaderStatus, setLoaderStatus] = React.useState<'checking' | 'success' | 'failed'>('checking');

  const pageTitle = React.useMemo(() => {
    if (pathname.startsWith('/admin/settings')) return 'Settings';
    if (pathname.startsWith('/admin/users')) return 'Users';
    
    const activeItem = [...navItems].reverse().find(item => pathname.startsWith(item.href));
    return activeItem?.label || 'Dashboard';
  }, [pathname]);

  React.useEffect(() => {
    // If the user state is still loading from Firebase, just wait.
    // The loader is already showing the "checking" state.
    if (isUserLoading) {
      setLoaderStatus('checking');
      return;
    }

    // If there is no user, fail authorization and redirect.
    if (!user) {
      setLoaderStatus('failed');
      setTimeout(() => {
        router.push('/login');
      }, 1000); // Wait 1s to show message
      return;
    }

    // If there is a user, check their authorization status in Firestore.
    const userDocRef = doc(firestore, 'users', user.uid);
    getDoc(userDocRef).then(docSnap => {
      if (docSnap.exists() && docSnap.data().isAuthorized === true) {
        // User is authorized. Show success and then the dashboard.
        setLoaderStatus('success');
        setTimeout(() => {
          setIsReady(true); // Render the dashboard
        }, 1000); // Wait 1s to show message
      } else {
        // User is not authorized. Show failure, sign out, and redirect.
        setLoaderStatus('failed');
        toast({
          variant: "destructive",
          title: 'Authorization Required',
          description: 'Your account is not authorized to access this area.',
        });
        setTimeout(() => {
          auth.signOut();
          router.push('/login');
        }, 1200); // Wait a bit longer to show message
      }
    }).catch(error => {
      // Error fetching Firestore document. Fail authorization.
      console.error("Authorization check failed:", error);
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
    });

  }, [isUserLoading, user, router, firestore, auth, toast]);

  // The main conditional rendering logic.
  // If not ready, show the loader. Otherwise, show the full admin dashboard.
  if (!isReady) {
    return <AuthorizationLoader status={loaderStatus} />;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Sidebar collapsible="icon" className="border-r rounded-tr-lg rounded-br-lg">
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
                        <SidebarMenuButton 
                            asChild
                            isActive={pathname.startsWith('/admin/users')}
                            tooltip="Users"
                        >
                            <Link href="/admin/users">
                                <Users/>
                                <span>Users</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            asChild
                            isActive={pathname.startsWith('/admin/settings')}
                            tooltip="Settings"
                        >
                            <Link href="/admin/settings">
                                <Settings/>
                                <span>Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
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
          
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4">
              <SidebarTrigger className="md:hidden" />
              <div className="w-full flex-1">
                <h1 className="text-lg font-semibold">{pageTitle}</h1>
              </div>
              <ThemeToggle />
            </header>
    
            <main className="flex-1 p-4 sm:p-6 md:p-8">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}

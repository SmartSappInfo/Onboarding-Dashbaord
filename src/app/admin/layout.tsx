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
import { LayoutDashboard, School, Settings, Calendar, ExternalLink, Film, ClipboardList } from 'lucide-react';
import { SmartSappLogo as Logo, SmartSappIcon } from '@/components/icons';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/schools', icon: School, label: 'Schools' },
  { href: '/admin/meetings', icon: Calendar, label: 'Meetings' },
  { href: '/admin/media', icon: Film, label: 'Media' },
  { href: '/admin/surveys', icon: ClipboardList, label: 'Surveys' },
];


function AdminDashboardSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
        <div className="hidden md:flex flex-col gap-4 border-r bg-background p-2 w-72">
            <div className="p-2 h-14 flex items-center justify-center">
                <Skeleton className="h-8 w-32" />
            </div>
            <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
        <div className="flex-1">
             <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4">
                <Skeleton className="h-8 w-8" />
            </header>
            <main className="flex-1 p-4 sm:p-6 md:p-8">
                <Skeleton className="h-screen w-full" />
            </main>
        </div>
    </div>
  );
}


export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const pageTitle = React.useMemo(() => {
    if (pathname.startsWith('/admin/settings')) {
      return 'Settings';
    }

    // Reverse to match more specific paths first e.g. '/admin/schools' before '/admin'
    const activeItem = [...navItems].reverse().find(item => pathname.startsWith(item.href));
    
    return activeItem?.label || 'Dashboard';
  }, [pathname]);

  React.useEffect(() => {
    // If loading is finished and there's no user, redirect to login.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  // While loading or if there's no user (before redirect happens), show a skeleton.
  if (isUserLoading || !user) {
    return <AdminDashboardSkeleton />;
  }


  return (
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
             <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarMenu>
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
             </SidebarGroup>
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
  );
}

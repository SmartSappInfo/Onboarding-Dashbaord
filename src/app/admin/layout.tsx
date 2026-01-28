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
} from '@/components/ui/sidebar';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, School, Settings, Calendar, ExternalLink, Film } from 'lucide-react';
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
];


function AdminDashboardSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-muted/30">
        <div className="hidden md:flex flex-col gap-4 border-r bg-background p-2 w-72">
            <div className="p-2 h-14 flex items-center justify-center">
                <Skeleton className="h-8 w-32" />
            </div>
            <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
        <div className="flex-1">
             <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
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
      <div className="flex min-h-screen w-full bg-muted/30">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-2">
             <div className="flex h-10 items-center justify-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 px-2">
                <Link href="/admin" className="flex items-center gap-2 font-semibold">
                  <Logo className="h-8 w-auto group-data-[collapsible=icon]:hidden" />
                  <SmartSappIcon className="h-8 w-8 hidden group-data-[collapsible=icon]:block" />
                  <span className="sr-only">SmartSapp</span>
                </Link>
             </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
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
          </SidebarContent>
          <SidebarFooter className="p-2">
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
          </SidebarFooter>
        </Sidebar>
        
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="w-full flex-1">
              {/* Maybe breadcrumbs here */}
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

"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AudioWaveform,
  BarChart,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Command,
  CreditCard,
  Eye,
  FileText,
  Frame,
  GalleryVerticalEnd,
  GitBranch,
  Handshake,
  Heart,
  Home,
  LifeBuoy,
  Map,
  Megaphone,
  PieChart,
  Scale,
  School,
  Settings2,
  SquareTerminal,
  Target,
  TestTube,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useIndustry } from "@/context/IndustryContext"
import type { SidebarItem } from "@/lib/industry-config"

// Icon mapping for industry sidebar items
const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Users,
  TestTube,
  CreditCard,
  Heart,
  LifeBuoy,
  School,
  GitBranch,
  FileText,
  UserCheck,
  Scale,
  Briefcase,
  Calendar,
  Clock,
  Megaphone,
  Target,
  BarChart,
  Home,
  Eye,
  Handshake,
  TrendingUp,
}

// This is sample data for teams and user
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
}

/**
 * Industry-aware navigation component
 * Renders sidebar items based on workspace industry configuration
 */
function IndustryNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || Building2
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                <Link href={item.href}>
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * AppSidebar component with industry-specific navigation
 * 
 * Requirements:
 * - 17.1-17.10: Display industry-specific sidebar items based on workspace industry
 * - 2.4: Display industry-specific terminology in Workspace UI
 * 
 * Features:
 * - Dynamically renders sidebar items from industry configuration
 * - Highlights active route based on current pathname
 * - Supports collapsible icon mode
 * - Integrates with IndustryContext for workspace-scoped configuration
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarItems, isLoading } = useIndustry()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        {!isLoading && <IndustryNav items={sidebarItems} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

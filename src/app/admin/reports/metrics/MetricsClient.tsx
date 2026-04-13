'use client';

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Users,
  Building2,
  UserCircle,
  Home,
  Share2,
  Filter,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { EntityType } from '@/lib/types';
import {
  getUniqueEntityMetrics,
  getWorkspaceMembershipMetrics,
  getPipelineMetrics,
  getSharedContactMetrics,
  type EntityMetrics,
  type WorkspaceMembershipMetrics,
  type PipelineMetrics,
  type SharedContactMetrics,
} from '@/lib/metrics-actions';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  institution: 'Institutions',
  family: 'Families',
  person: 'People',
};

const ENTITY_TYPE_ICONS: Record<EntityType, React.ComponentType<any>> = {
  institution: Building2,
  family: Home,
  person: UserCircle,
};

export default function MetricsClient() {
  const { activeOrganizationId } = useTenant();
  const organizationId = activeOrganizationId || '';

  const [entityMetrics, setEntityMetrics] = React.useState<EntityMetrics | null>(null);
  const [workspaceMetrics, setWorkspaceMetrics] = React.useState<WorkspaceMembershipMetrics[]>([]);
  const [pipelineMetrics, setPipelineMetrics] = React.useState<PipelineMetrics[]>([]);
  const [sharedContacts, setSharedContacts] = React.useState<SharedContactMetrics[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<string>('all');
  const [selectedEntityType, setSelectedEntityType] = React.useState<EntityType | 'all'>('all');

  // Load metrics
  React.useEffect(() => {
    if (!organizationId) return;

    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        const [entities, workspaces, pipeline, shared] = await Promise.all([
          getUniqueEntityMetrics(
            organizationId,
            selectedEntityType === 'all' ? undefined : selectedEntityType
          ),
          getWorkspaceMembershipMetrics(
            organizationId,
            selectedWorkspace === 'all' ? undefined : selectedWorkspace,
            selectedEntityType === 'all' ? undefined : selectedEntityType
          ),
          getPipelineMetrics(
            organizationId,
            selectedWorkspace === 'all' ? undefined : selectedWorkspace,
            selectedEntityType === 'all' ? undefined : selectedEntityType
          ),
          getSharedContactMetrics(
            organizationId,
            selectedEntityType === 'all' ? undefined : selectedEntityType
          ),
        ]);

        setEntityMetrics(entities);
        setWorkspaceMetrics(workspaces);
        setPipelineMetrics(pipeline);
        setSharedContacts(shared);
      } catch (error) {
        console.error('Error loading metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [organizationId, selectedWorkspace, selectedEntityType]);

  // Prepare chart data
  const entityTypeChartData = React.useMemo(() => {
    if (!entityMetrics) return [];
    return Object.entries(entityMetrics.totalByType).map(([type, count]) => ({
      name: ENTITY_TYPE_LABELS[type as EntityType],
      value: count,
      type: type as EntityType,
    }));
  }, [entityMetrics]);

  const workspaceChartData = React.useMemo(() => {
    return workspaceMetrics.map((w) => ({
      name: w.workspaceName,
      memberships: w.totalMemberships,
      institution: w.byType.institution,
      family: w.byType.family,
      person: w.byType.person,
    }));
  }, [workspaceMetrics]);

  const pipelineChartData = React.useMemo(() => {
    return pipelineMetrics.map((p) => ({
      name: p.workspaceName,
      active: p.activeInPipeline,
      institution: p.byType.institution,
      family: p.byType.family,
      person: p.byType.person,
    }));
  }, [pipelineMetrics]);

  if (isLoading) {
    return (
 <div className="p-8 space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 <Skeleton className="h-[400px] rounded-[2.5rem]" />
 <Skeleton className="h-[400px] rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  return (
 <div className="h-full overflow-y-auto  bg-background text-left">
 <div className=" space-y-12 pb-32">
        {/* Header */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
 <h1 className="text-4xl font-semibold tracking-tighter flex items-center gap-4 text-foreground ">
 <TrendingUp className="h-10 w-10 text-primary" />
              Contact Metrics
            </h1>
 <p className="text-muted-foreground font-medium text-lg mt-1">
              Distinct metrics for entities, workspace memberships, and shared contacts.
            </p>
          </div>

          {/* Filters */}
 <div className="flex items-center gap-3">
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
 <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Workspaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                {workspaceMetrics.map((w) => (
                  <SelectItem key={w.workspaceId} value={w.workspaceId}>
                    {w.workspaceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedEntityType}
              onValueChange={(v) => setSelectedEntityType(v as EntityType | 'all')}
            >
 <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="institution">Institutions</SelectItem>
                <SelectItem value="family">Families</SelectItem>
                <SelectItem value="person">People</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards - Requirement 21.1 */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Unique Entities"
            value={entityMetrics?.totalUnique || 0}
            sub="Total distinct contacts"
            icon={Users}
            color="text-primary"
            bg="bg-primary/10"
          />
          <StatCard
            label="Workspace Memberships"
            value={workspaceMetrics.reduce((sum, w) => sum + w.totalMemberships, 0)}
            sub="Total workspace links"
            icon={Building2}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <StatCard
            label="Active in Pipeline"
            value={pipelineMetrics.reduce((sum, p) => sum + p.activeInPipeline, 0)}
            sub="Entities with pipeline stage"
            icon={TrendingUp}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatCard
            label="Shared Contacts"
            value={sharedContacts.length}
            sub="In 2+ workspaces"
            icon={Share2}
            color="text-purple-600"
            bg="bg-purple-50"
          />
        </div>

 <Tabs defaultValue="overview" className="space-y-8">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workspaces">By Workspace</TabsTrigger>
            <TabsTrigger value="shared">Shared Contacts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
 <TabsContent value="overview" className="space-y-8">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Unique Entities by Type */}
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
 <CardHeader className="bg-background border-b pb-6 px-8 pt-8">
 <CardTitle className="text-sm font-semibold tracking-wide">
                    Unique Entities by Type
                  </CardTitle>
 <CardDescription className="text-xs">
                    Total distinct entities in the system
                  </CardDescription>
                </CardHeader>
 <CardContent className="p-8 h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={entityTypeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {entityTypeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Workspace Memberships */}
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
 <CardHeader className="bg-background border-b pb-6 px-8 pt-8">
 <CardTitle className="text-sm font-semibold tracking-wide">
                    Workspace Memberships
                  </CardTitle>
 <CardDescription className="text-xs">
                    Total workspace_entities records per workspace
                  </CardDescription>
                </CardHeader>
 <CardContent className="p-8 h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workspaceChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="memberships" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Workspaces Tab */}
 <TabsContent value="workspaces" className="space-y-8">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pipeline Activity */}
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
 <CardHeader className="bg-background border-b pb-6 px-8 pt-8">
 <CardTitle className="text-sm font-semibold tracking-wide">
                    Active in Pipeline
                  </CardTitle>
 <CardDescription className="text-xs">
                    Entities with assigned pipeline stages
                  </CardDescription>
                </CardHeader>
 <CardContent className="p-8 h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="active" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Workspace Details Table */}
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
 <CardHeader className="bg-background border-b pb-6 px-8 pt-8">
 <CardTitle className="text-sm font-semibold tracking-wide">
                    Workspace Details
                  </CardTitle>
 <CardDescription className="text-xs">
                    Breakdown by entity type
                  </CardDescription>
                </CardHeader>
 <CardContent className="p-8">
 <div className="space-y-4">
                    {workspaceMetrics.map((workspace) => (
                      <div
                        key={workspace.workspaceId}
 className="flex items-center justify-between p-4 bg-background rounded-xl"
                      >
                        <div>
 <p className="font-bold text-sm">{workspace.workspaceName}</p>
 <div className="flex gap-3 mt-2">
                            <Badge variant="outline" className="text-xs">
 <Building2 className="h-3 w-3 mr-1" />
                              {workspace.byType.institution} Institutions
                            </Badge>
                            <Badge variant="outline" className="text-xs">
 <Home className="h-3 w-3 mr-1" />
                              {workspace.byType.family} Families
                            </Badge>
                            <Badge variant="outline" className="text-xs">
 <UserCircle className="h-3 w-3 mr-1" />
                              {workspace.byType.person} People
                            </Badge>
                          </div>
                        </div>
 <div className="text-right">
 <p className="text-2xl font-semibold text-primary">
                            {workspace.totalMemberships}
                          </p>
 <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Shared Contacts Tab - Requirement 21.5 */}
 <TabsContent value="shared" className="space-y-8">
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
 <CardHeader className="bg-background border-b pb-6 px-8 pt-8">
 <CardTitle className="text-sm font-semibold tracking-wide">
                  Shared Contacts Report
                </CardTitle>
 <CardDescription className="text-xs">
                  Entities appearing in multiple workspaces with per-workspace details
                </CardDescription>
              </CardHeader>
 <CardContent className="p-8">
                {sharedContacts.length === 0 ? (
 <div className="py-20 text-center text-muted-foreground">
                    No shared contacts found
                  </div>
                ) : (
 <div className="space-y-6">
                    {sharedContacts.map((contact) => {
                      const Icon = ENTITY_TYPE_ICONS[contact.entityType];
                      return (
                        <div
                          key={contact.entityId}
 className="p-6 bg-background rounded-xl space-y-4"
                        >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-lg">
 <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
 <p className="font-bold text-base">{contact.entityName}</p>
 <p className="text-xs text-muted-foreground">
                                  {ENTITY_TYPE_LABELS[contact.entityType]}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-sm">
 <Share2 className="h-3 w-3 mr-1" />
                              {contact.workspaceCount} Workspaces
                            </Badge>
                          </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
                            {contact.workspaces.map((workspace) => (
                              <div
                                key={workspace.workspaceId}
 className="p-3 bg-card rounded-lg border text-sm"
                              >
 <p className="font-semibold">{workspace.workspaceName}</p>
                                {workspace.stageName && (
 <p className="text-xs text-muted-foreground mt-1">
                                    Stage: {workspace.stageName}
                                  </p>
                                )}
                                {workspace.assignedTo && (
 <p className="text-xs text-muted-foreground">
                                    Assigned: {workspace.assignedTo}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: any;
  color: string;
  bg: string;
}) {
  return (
 <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-card overflow-hidden group hover:ring-primary/20 transition-all">
 <CardContent className="p-6 flex items-center gap-5">
        <div
 className={cn(
            'p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner',
            bg,
            color
          )}
        >
 <Icon className="h-7 w-7" />
        </div>
 <div className="text-left">
 <p className="text-[9px] font-semibold text-muted-foreground leading-none mb-1.5">
            {label}
          </p>
 <p className="text-3xl font-semibold tabular-nums tracking-tighter leading-none">{value}</p>
 <p className="text-[10px] font-bold text-muted-foreground/60 tracking-tighter mt-1">
            {sub}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

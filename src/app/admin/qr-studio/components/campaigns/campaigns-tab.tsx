/**
 * @fileoverview Campaigns Hub Tab Component for QR Studio
 * Displays active marketing campaigns, KPI cards, creation wizard, and member management.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs micro-animations and active press states (active:scale-[0.97]).
 * - Tag selector strictly uses TagSelector component.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  FolderPlus,
  BarChart3,
  Search,
  Filter,
  Plus,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  Link,
  Layers,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import {
  getQRCampaigns,
  updateQRCampaign,
  deleteQRCampaign,
} from '@/lib/qr-campaign-actions';
import type { QRCampaign, QRCode, QRCampaignStatus } from '@/lib/types';
import NewCampaignDialog from './new-campaign-dialog';
import AddQRsToCampaignDialog from './add-qrs-to-campaign-dialog';
import CampaignAnalyticsDrawer from '../analytics/campaign-analytics-drawer';
import { motion } from 'framer-motion';

interface CampaignsTabProps {
  availableQRCodes: QRCode[];
}

export default function CampaignsTab({ availableQRCodes }: CampaignsTabProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();

  const [campaigns, setCampaigns] = React.useState<QRCampaign[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Dialog triggers
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [managingCampaign, setManagingCampaign] = React.useState<QRCampaign | null>(null);
  const [analyzingCampaign, setAnalyzingCampaign] = React.useState<QRCampaign | null>(null);

  const fetchCampaigns = React.useCallback(async () => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await getQRCampaigns(activeOrganizationId, activeWorkspaceId);
      setCampaigns(data);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load campaigns.' });
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganizationId, activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleToggleStatus = async (campaign: QRCampaign) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    const nextStatus: QRCampaignStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      await updateQRCampaign(activeOrganizationId, activeWorkspaceId, campaign.id, { status: nextStatus });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, status: nextStatus } : c))
      );
      toast({ title: 'Status Updated', description: `Campaign is now ${nextStatus}.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update campaign status.' });
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    try {
      await deleteQRCampaign(activeOrganizationId, activeWorkspaceId, campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      toast({ title: 'Campaign Deleted', description: 'Campaign removed and member QRs disassociated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete campaign.' });
    }
  };

  const filteredCampaigns = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return campaigns.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.objective.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  const totalScansAllCampaigns = React.useMemo(
    () => campaigns.reduce((acc, c) => acc + c.metrics.totalScans, 0),
    [campaigns]
  );
  const activeCampaignCount = React.useMemo(
    () => campaigns.filter((c) => c.status === 'active').length,
    [campaigns]
  );

  return (
    <div className="space-y-6">
      {/* Action Header & KPI Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">QR Campaigns</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize multi-location QR codes into unified campaigns to track aggregate conversions and attribution.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="rounded-xl h-10 px-5 font-semibold text-xs shadow-lg shadow-primary/20 active:scale-[0.97] transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Campaigns</p>
          <p className="text-2xl font-black text-foreground mt-1">{activeCampaignCount}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Campaign Scans</p>
          <p className="text-2xl font-black text-primary mt-1">{totalScansAllCampaigns}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tracked QRs</p>
          <p className="text-2xl font-black text-emerald-500 mt-1">
            {campaigns.reduce((acc, c) => acc + c.qrCodeIds.length, 0)}
          </p>
        </Card>
        <Card className="p-4 rounded-2xl border-none ring-1 ring-border bg-card shadow-sm">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Conversion</p>
          <p className="text-2xl font-black text-violet-500 mt-1">
            {campaigns.length > 0
              ? `${Math.round(campaigns.reduce((acc, c) => acc + (c.metrics.conversionRate || 0), 0) / campaigns.length)}%`
              : '0%'}
          </p>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns by name or objective..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'paused', 'completed'] as const).map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="h-10 rounded-xl text-xs font-semibold capitalize active:scale-[0.97]"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Campaign Grid */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Loading campaigns...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-dashed border-border flex flex-col items-center justify-center gap-3">
          <Target className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-bold text-foreground">No Campaigns Found</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
              Create a campaign to group related QR codes across flyers, table tents, and banners to measure total reach.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="rounded-xl h-9 px-4 text-xs font-semibold mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Campaign
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCampaigns.map((camp) => (
            <motion.div
              key={camp.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary mb-1">
                      {camp.objective.replace('_', ' ')}
                    </Badge>
                    <h3 className="text-base font-bold text-foreground line-clamp-1">{camp.name}</h3>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                      <DropdownMenuItem onClick={() => setAnalyzingCampaign(camp)} className="text-xs">
                        <BarChart3 className="h-3.5 w-3.5 mr-2 text-primary" />
                        View Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setManagingCampaign(camp)} className="text-xs">
                        <Link className="h-3.5 w-3.5 mr-2 text-blue-500" />
                        Manage QRs ({camp.qrCodeIds.length})
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(camp)} className="text-xs">
                        {camp.status === 'active' ? (
                          <>
                            <Pause className="h-3.5 w-3.5 mr-2 text-amber-500" /> Pause Campaign
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Activate Campaign
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(camp.id)} className="text-xs text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Campaign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {camp.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {camp.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {camp.qrCodeIds.length} QR codes
                  </Badge>
                  <span className="text-[11px] font-medium capitalize">
                    Status: <span className={camp.status === 'active' ? 'text-emerald-500 font-bold' : 'font-bold'}>{camp.status}</span>
                  </span>
                </div>
              </div>

              {/* Metrics Footer */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">Total Scans</span>
                  <span className="text-base font-black text-foreground">{camp.metrics.totalScans}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnalyzingCampaign(camp)}
                  className="rounded-xl h-8 px-3 text-xs font-semibold active:scale-[0.97]"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1 text-primary" />
                  Analytics
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* New Campaign Dialog */}
      <NewCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        availableQRCodes={availableQRCodes}
        onSuccess={fetchCampaigns}
      />

      {/* Add QRs to Campaign Dialog */}
      <AddQRsToCampaignDialog
        open={!!managingCampaign}
        onOpenChange={(open) => !open && setManagingCampaign(null)}
        campaign={managingCampaign}
        availableQRCodes={availableQRCodes}
        onSuccess={fetchCampaigns}
      />

      {/* Campaign Analytics Drawer */}
      <CampaignAnalyticsDrawer
        open={!!analyzingCampaign}
        onOpenChange={(open) => !open && setAnalyzingCampaign(null)}
        campaign={analyzingCampaign}
      />
    </div>
  );
}

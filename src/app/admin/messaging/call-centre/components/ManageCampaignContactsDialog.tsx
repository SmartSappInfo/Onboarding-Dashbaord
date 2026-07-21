'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, Phone, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useCallQueueItems } from '@/lib/call-centre-hooks';
import { useWorkspaceEntities } from '@/lib/entity-hooks';
import { removeContactsFromCampaignAction } from '@/lib/call-centre-actions';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import type { CallCampaign } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

interface ManageCampaignContactsDialogProps {
  campaign: CallCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCampaignContactsDialog({ campaign, open, onOpenChange }: ManageCampaignContactsDialogProps) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  
  const { queueItems, isLoading: queueLoading } = useCallQueueItems(campaign?.id || '');
  // Fetch entities to map names if needed (though queueItems usually has entityName)
  const { entities } = useWorkspaceEntities(activeWorkspaceId || '');

  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isRemoving, setIsRemoving] = React.useState(false);

  // Reset selection when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearch('');
    }
  }, [open]);

  if (!campaign) return null;

  const validStatuses = ['scheduled', 'callback_scheduled', 'deferred'];

  const filteredItems = (queueItems || []).filter(item => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.contactName?.toLowerCase().includes(term)) ||
      (item.entityName?.toLowerCase().includes(term)) ||
      (item.entityPhone?.toLowerCase().includes(term)) ||
      (item.entityEmail?.toLowerCase().includes(term))
    );
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allRemovableIds = filteredItems
        .filter(i => validStatuses.includes(i.status))
        .map(i => i.id);
      setSelectedIds(new Set(allRemovableIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleRemove = async (ids: string[]) => {
    if (!activeWorkspaceId || !user) return;
    
    setIsRemoving(true);
    try {
      const result = await removeContactsFromCampaignAction(
        campaign.id,
        ids,
        activeWorkspaceId,
        user.uid
      );
      
      if (result.success) {
        toast({ title: 'Contacts Removed', description: `Successfully removed ${result.count} contact(s) from campaign.` });
        setSelectedIds(new Set());
        // Do not auto-close unless empty
      } else {
        toast({ title: 'Removal Failed', description: result.error || 'Failed to remove contacts', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsRemoving(false);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 uppercase text-[10px] tracking-wider">Scheduled</Badge>;
      case 'callback_scheduled': return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 uppercase text-[10px] tracking-wider">Callback</Badge>;
      case 'deferred': return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 uppercase text-[10px] tracking-wider">Deferred</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 uppercase text-[10px] tracking-wider">Completed</Badge>;
      case 'skipped': return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 uppercase text-[10px] tracking-wider">Skipped</Badge>;
      case 'in_progress': return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 uppercase text-[10px] tracking-wider">In Progress</Badge>;
      default: return <Badge variant="outline" className="uppercase text-[10px] tracking-wider">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-background border-border shadow-2xl p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border shrink-0 bg-muted/20">
          <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            Manage Campaign Audience
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Review and remove queued contacts for <strong className="text-foreground">{campaign.name}</strong>. 
            <span className="block mt-1 text-xs text-amber-600 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 inline-flex items-center gap-1.5 mt-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Note: Contacts that are currently running or already completed cannot be removed to preserve analytics.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-card/30">
          {/* Toolbar */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0 bg-background/50 backdrop-blur-sm">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, entity, email, phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-background h-9 text-sm rounded-xl border-border focus-visible:ring-1"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || isRemoving}
                onClick={() => handleRemove(Array.from(selectedIds))}
                className="rounded-lg h-9 font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-[0.98] w-full sm:w-auto"
              >
                {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remove Selected
              </Button>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-auto">
            {queueLoading ? (
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No contacts found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {search ? 'Try adjusting your search query.' : 'There are no contacts in this campaign queue.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[40px] px-4">
                      <Checkbox 
                        checked={selectedIds.size > 0 && selectedIds.size === filteredItems.filter(i => validStatuses.includes(i.status)).length}
                        onCheckedChange={handleSelectAll}
                        disabled={filteredItems.filter(i => validStatuses.includes(i.status)).length === 0}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Entity / Company</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground px-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const isRemovable = validStatuses.includes(item.status);
                    
                    return (
                      <TableRow key={item.id} className={`border-border transition-colors ${selectedIds.has(item.id) ? 'bg-primary/5' : ''} ${!isRemovable ? 'opacity-60 bg-muted/10' : ''}`}>
                        <TableCell className="px-4">
                          <Checkbox 
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => handleToggleSelect(item.id)}
                            disabled={!isRemovable}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-sm text-foreground">{item.contactName || 'Primary Contact'}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {item.entityPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {item.entityPhone}
                                </span>
                              )}
                              {item.entityEmail && (
                                <span className="flex items-center gap-1 hidden md:flex">
                                  <Mail className="h-3 w-3" />
                                  {item.entityEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">{item.entityName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.contactRole || 'Contact'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {renderStatus(item.status)}
                        </TableCell>
                        <TableCell className="text-right px-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!isRemovable || isRemoving}
                            onClick={() => handleRemove([item.id])}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

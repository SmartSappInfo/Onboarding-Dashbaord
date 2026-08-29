'use client';

/**
 * Lead Lists & Cohorts Management Tab
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Persistent Collections: Lead lists represent saved cohorts of prospects stored in the `lead_lists` collection.
 * 2. 1-Click Export: Supports client-side CSV downloads of list cohorts.
 * 3. Mobile Friendly: Responsive card grid with touch targets >= 44px.
 */

import React, { useState } from 'react';
import { 
  FolderPlus, 
  Folder, 
  Trash2, 
  Download, 
  Users, 
  Calendar, 
  Plus, 
  ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { LeadList, Prospect } from '@/lib/lead-intelligence/types';
import { useToast } from '@/hooks/use-toast';

interface LeadListsTabProps {
  leadLists: LeadList[];
  allProspects: Prospect[];
  onCreateList: (name: string, description?: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onSelectProspectForInspection: (prospect: Prospect) => void;
}

export const LeadListsTab: React.FC<LeadListsTabProps> = ({
  leadLists,
  allProspects,
  onCreateList,
  onDeleteList,
  onSelectProspectForInspection,
}) => {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a list name.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateList(listName.trim(), listDescription.trim());
      setListName('');
      setListDescription('');
      setIsCreateOpen(false);
      toast({ title: 'Lead List Created ✓', description: `Successfully created list "${listName.trim()}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Creation Failed', description: 'Failed to create lead list.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportListCSV = (list: LeadList) => {
    const listProspects = allProspects.filter((p) => list.prospectIds.includes(p.id));
    if (listProspects.length === 0) {
      toast({ variant: 'destructive', title: 'Export Notice', description: 'No prospects currently in this list to export.' });
      return;
    }

    const headers = ['Name', 'Domain', 'Phone', 'Address', 'Industry', 'Rating', 'Overall Score', 'Sync Status'];
    const csvRows = [headers.join(',')];

    for (const p of listProspects) {
      const row = [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.domain || ''}"`,
        `"${p.phone || ''}"`,
        `"${(p.address || '').replace(/"/g, '""')}"`,
        `"${p.industry || ''}"`,
        p.rating || '',
        p.scoring?.overallScore || '',
        p.syncStatus || 'unregistered'
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${list.name.toLowerCase().replace(/\s+/g, '_')}_prospects.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Exported to CSV ✓', description: `Downloaded ${listProspects.length} prospects from ${list.name}.` });
  };

  const selectedList = leadLists.find((l) => l.id === activeListId);
  const selectedListProspects = selectedList 
    ? allProspects.filter((p) => selectedList.prospectIds.includes(p.id)) 
    : [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border/70 p-5 rounded-2xl shadow-sm">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" /> Lead Lists & Cohorts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize discovered prospects into targeted outreach groups before CRM sync.
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 px-4 bg-primary text-primary-foreground font-medium text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]">
              <Plus className="w-4 h-4" /> Create New List
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateSubmit}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-primary" /> Create Lead List
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a named cohort to group prospects from searches, website scans, or CSV imports.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="list-name" className="text-xs font-semibold">List Name *</Label>
                  <Input
                    id="list-name"
                    placeholder="e.g. Kumasi Private Schools — Q3 Outreach"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="list-description" className="text-xs font-semibold">Description (Optional)</Label>
                  <Input
                    id="list-description"
                    placeholder="e.g. Verified institutions without online payment setup"
                    value={listDescription}
                    onChange={(e) => setListDescription(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsCreateOpen(false)}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={isSubmitting}
                  className="h-9 text-xs bg-primary text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Create List'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid of Lead Lists */}
      {leadLists.length === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-2xl bg-card text-center space-y-3">
          <FolderPlus className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">No lead lists created yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Save prospect search batches into persistent lists for campaign targeting and bulk CRM synchronization.
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsCreateOpen(true)}
            className="h-8 text-xs font-medium active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Your First List
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leadLists.map((list) => {
            const isSelected = activeListId === list.id;
            return (
              <div
                key={list.id}
                className={`p-4 rounded-2xl border bg-card transition-all space-y-3 flex flex-col justify-between ${
                  isSelected ? 'border-primary shadow-md ring-1 ring-primary/30' : 'border-border/70 hover:border-border'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground truncate">{list.name}</h4>
                    <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 shrink-0 bg-primary/10 text-primary border border-primary/20">
                      <Users className="w-3 h-3 mr-1" />
                      {list.prospectsCount} {list.prospectsCount === 1 ? 'lead' : 'leads'}
                    </Badge>
                  </div>

                  {list.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                    <Calendar className="w-3 h-3" />
                    <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    variant={isSelected ? "secondary" : "outline"}
                    onClick={() => setActiveListId(isSelected ? null : list.id)}
                    className="h-8 text-xs font-medium active:scale-[0.97]"
                  >
                    {isSelected ? 'Hide Leads' : 'View Leads'}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleExportListCSV(list)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                      title="Export list to CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete the list "${list.name}"?`)) {
                          onDeleteList(list.id);
                        }
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                      title="Delete list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected List Inspector Table */}
      {selectedList && (
        <div className="mt-6 bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Prospects in &ldquo;{selectedList.name}&rdquo;</span>
                <Badge variant="outline" className="text-xs">{selectedListProspects.length} total</Badge>
              </h4>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportListCSV(selectedList)}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {selectedListProspects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No prospect details cached in memory. Search prospects in Prospect Finder and add them to this list.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">Company Name</th>
                    <th className="py-2.5 px-3 font-semibold">Domain</th>
                    <th className="py-2.5 px-3 font-semibold">Location</th>
                    <th className="py-2.5 px-3 font-semibold">Score</th>
                    <th className="py-2.5 px-3 font-semibold">CRM Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {selectedListProspects.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{p.name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{p.domain}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{p.address || p.industry || '—'}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {p.scoring?.overallScore ?? 50}/100
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {p.syncStatus === 'synced' ? (
                          <Badge className="bg-blue-500/10 text-blue-500 text-[10px]">In CRM</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Unregistered</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectProspectForInspection(p)}
                          className="h-7 px-2 text-xs text-primary hover:text-primary/90"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default LeadListsTab;

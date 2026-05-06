'use client';

import * as React from 'react';
import { Loader2, Lock, Pencil, Trash2, MoreVertical, Copy, CheckCircle2 } from 'lucide-react';
import { listQRTemplates, saveQRTemplate, updateQRTemplate, deleteQRTemplate } from '@/lib/qr-actions';
import { GLOBAL_QR_TEMPLATES } from '@/lib/qr-constants';
import type { QRDesign, QRCodeTemplate } from '@/lib/types';
import QRPreview from '../qr-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TemplateControlsProps {
  orgId: string;
  wsId: string;
  currentDesign: QRDesign;
  updateDesign: (patch: Partial<QRDesign>) => void;
}

type EditMode = 'create' | 'update';

export default function TemplateControls({ orgId, wsId, currentDesign, updateDesign }: TemplateControlsProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<QRCodeTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Save/edit dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState<EditMode>('create');
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);
  const [editSourceId, setEditSourceId] = React.useState<string | undefined>(undefined);
  const [templateName, setTemplateName] = React.useState('');

  // Delete confirm dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<QRCodeTemplate | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await listQRTemplates(orgId, wsId);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, wsId]);

  React.useEffect(() => {
    load();
    window.addEventListener('qr-template-saved', load);
    return () => window.removeEventListener('qr-template-saved', load);
  }, [load]);

  // ── Apply a template design to the designer ──
  const applyDesign = (design: Partial<QRDesign>) => {
    updateDesign(design);
  };

  // ── Open dialog to CUSTOMIZE a system preset ──
  const handleCustomize = (systemTemplate: { id: string; name: string; design: QRDesign }) => {
    applyDesign(systemTemplate.design);
    setEditMode('create');
    setEditTargetId(null);
    setEditSourceId(systemTemplate.id);
    setTemplateName(`${systemTemplate.name} (Custom)`);
    setDialogOpen(true);
  };

  // ── Open dialog to UPDATE an existing custom template ──
  const handleEdit = (template: QRCodeTemplate) => {
    applyDesign(template.design);
    setEditMode('update');
    setEditTargetId(template.id);
    setEditSourceId(template.sourceTemplateId);
    setTemplateName(template.name);
    setDialogOpen(true);
  };

  // ── Confirm save (create or update) ──
  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      if (editMode === 'update' && editTargetId) {
        await updateQRTemplate(orgId, wsId, editTargetId, {
          name: templateName,
          design: currentDesign,
        });
        toast({ title: 'Template Updated', description: 'Your custom template has been saved.' });
      } else {
        await saveQRTemplate(orgId, wsId, {
          name: templateName,
          category: 'Custom',
          design: currentDesign,
          createdBy: 'user',
          sourceTemplateId: editSourceId,
        });
        toast({ title: 'Template Saved', description: 'Design added to your workspace templates.' });
      }
      window.dispatchEvent(new CustomEvent('qr-template-saved'));
      setDialogOpen(false);
      await load();
    } catch {
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the template.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Initiate delete flow ──
  const handleDeleteRequest = (template: QRCodeTemplate) => {
    setDeleteTarget(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQRTemplate(orgId, wsId, deleteTarget.id);
      toast({ title: 'Template Deleted' });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await load();
    } catch {
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the template.' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── System Presets ── */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-1">System Presets</p>
          <div className="grid grid-cols-2 gap-3">
            {GLOBAL_QR_TEMPLATES.map((t) => {
              const isCustomized = templates.some((ws) => ws.sourceTemplateId === t.id);
              return (
                <div key={t.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => applyDesign(t.design)}
                    className="w-full p-2 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all bg-card text-left"
                  >
                    <div className="bg-white rounded-lg p-2 mb-2 shadow-sm pointer-events-none flex justify-center border border-border/50 group-hover:border-primary/20">
                      <QRPreview data="https://smartsapp.com" design={t.design} size={80} />
                    </div>
                    <div className="flex items-center gap-1 px-1">
                      <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <p className="text-[10px] font-semibold text-foreground truncate flex-1">{t.name}</p>
                      {isCustomized && (
                        <span className="text-[8px] font-bold bg-primary/10 text-primary rounded-full px-1.5 py-0.5 shrink-0">
                          Customized
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Context menu */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-sm hover:bg-muted/50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs min-w-[160px]">
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => applyDesign(t.design)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Apply to Designer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => handleCustomize(t)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Customize & Save Copy
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── My Templates (Workspace) ── */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-1">My Templates</p>
          {templates.length === 0 ? (
            <div className="p-6 border border-dashed border-border rounded-xl bg-muted/10 text-center">
              <p className="text-[11px] text-muted-foreground">
                No custom templates yet. Use "Customize &amp; Save Copy" on a system preset, or click "Save as Template" after designing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1 pb-1">
              {templates.map((t) => (
                <div key={t.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => applyDesign(t.design)}
                    className="w-full p-2 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all bg-card text-left"
                  >
                    <div className="bg-white rounded-lg p-2 mb-2 shadow-sm pointer-events-none flex justify-center border border-border/50 group-hover:border-primary/20">
                      <QRPreview data="https://smartsapp.com" design={t.design} size={80} />
                    </div>
                    <div className="flex items-center gap-1 px-1">
                      <p className="text-[10px] font-semibold text-foreground truncate flex-1">{t.name}</p>
                      {t.sourceTemplateId ? (
                        <span className="text-[8px] font-bold bg-amber-500/10 text-amber-600 rounded-full px-1.5 py-0.5 shrink-0">
                          Custom
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold bg-green-500/10 text-green-600 rounded-full px-1.5 py-0.5 shrink-0">
                          Saved
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Context menu */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-6 w-6 flex items-center justify-center bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-sm hover:bg-muted/50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs min-w-[160px]">
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => applyDesign(t.design)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Apply to Designer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => handleEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit &amp; Update
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-destructive focus:text-destructive"
                          onClick={() => handleDeleteRequest(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Save / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>{editMode === 'update' ? 'Update Template' : 'Save as Template'}</DialogTitle>
            <DialogDescription>
              {editMode === 'update'
                ? 'Update this template with your current design. This will replace the saved version.'
                : 'Name this design to save it as a workspace template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Summer Campaign Style"
              className="rounded-xl h-10 font-medium"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && templateName.trim()) handleSave(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-semibold">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !templateName.trim()} className="rounded-xl font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMode === 'update' ? 'Update Template' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl font-semibold">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting} className="rounded-xl font-bold">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

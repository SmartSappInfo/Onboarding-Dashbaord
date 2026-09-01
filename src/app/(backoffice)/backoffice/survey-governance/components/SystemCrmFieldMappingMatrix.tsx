'use client';

/**
 * @fileOverview Backoffice Platform Control Plane — Survey-to-CRM Global Field Governance Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Global Standard Dictionary:
 *    - Governs default CRM mapping templates across all tenant workspaces.
 * 2. Protection Invariant:
 *    - System protected templates cannot be deleted.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { SystemCrmFieldMappingTemplate, CrmTargetEntityType, CrmFieldWriteMode } from '@/lib/types';
import {
  getSystemCrmFieldMappingTemplatesAction,
  saveSystemCrmFieldMappingTemplatesAction,
} from '@/lib/surveys/survey-crm-sync-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Database,
  Plus,
  Trash2,
  Lock,
  Save,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function SystemCrmFieldMappingMatrix() {
  const { toast } = useToast();

  const [templates, setTemplates] = React.useState<SystemCrmFieldMappingTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchTemplates = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemCrmFieldMappingTemplatesAction();
      if (res.success && res.templates) {
        setTemplates(res.templates);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load system CRM mapping templates',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const addTemplate = () => {
    const newTpl: SystemCrmFieldMappingTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      archetype: 'custom',
      standardQuestionTitle: 'New Standard Question',
      suggestedTargetType: 'contact',
      suggestedTargetField: 'name',
      suggestedWriteMode: 'fill_if_empty',
      isProtected: false,
    };
    setTemplates((prev) => [...prev, newTpl]);
  };

  const updateTemplate = (id: string, patch: Partial<SystemCrmFieldMappingTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTemplate = (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (target?.isProtected) {
      toast({
        variant: 'destructive',
        title: 'Protected Template',
        description: 'System standard templates are protected and cannot be deleted.',
      });
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveSystemCrmFieldMappingTemplatesAction(templates);
      if (res.success) {
        toast({
          title: 'Templates Saved',
          description: 'Global CRM field mapping dictionary updated across all workspaces.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save templates',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving templates.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Global Survey-to-CRM Field Mapping Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Govern default standard field mapping suggestions for all tenant surveys across the platform.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTemplate}
              className="h-9 px-3.5 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-bold w-[25%]">Standard Question Pattern</TableHead>
                  <TableHead className="text-xs font-bold w-[18%]">Archetype</TableHead>
                  <TableHead className="text-xs font-bold w-[15%]">Target Type</TableHead>
                  <TableHead className="text-xs font-bold w-[20%]">Suggested CRM Field</TableHead>
                  <TableHead className="text-xs font-bold w-[12%]">Write Mode</TableHead>
                  <TableHead className="text-xs font-bold w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Input
                        value={tpl.standardQuestionTitle}
                        onChange={(e) => updateTemplate(tpl.id, { standardQuestionTitle: e.target.value })}
                        className="h-8 text-xs font-semibold rounded-lg"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        value={tpl.archetype}
                        onChange={(e) => updateTemplate(tpl.id, { archetype: e.target.value })}
                        className="h-8 text-xs font-mono rounded-lg"
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={tpl.suggestedTargetType}
                        onValueChange={(val) => updateTemplate(tpl.id, { suggestedTargetType: val as CrmTargetEntityType })}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contact" className="text-xs">Contact</SelectItem>
                          <SelectItem value="entity" className="text-xs">Entity</SelectItem>
                          <SelectItem value="deal" className="text-xs">Deal</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={tpl.suggestedTargetField}
                        onChange={(e) => updateTemplate(tpl.id, { suggestedTargetField: e.target.value })}
                        className="h-8 text-xs font-mono rounded-lg"
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={tpl.suggestedWriteMode}
                        onValueChange={(val) => updateTemplate(tpl.id, { suggestedWriteMode: val as CrmFieldWriteMode })}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fill_if_empty" className="text-xs">Fill if Empty</SelectItem>
                          <SelectItem value="always_overwrite" className="text-xs font-bold text-amber-600">Always Overwrite</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right">
                      {tpl.isProtected ? (
                        <span className="p-2 text-muted-foreground inline-block" title="Protected System Template">
                          <Lock className="h-4 w-4" />
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTemplate(tpl.id)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

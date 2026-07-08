'use client';

import * as React from 'react';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Info, AlertCircle, Check } from 'lucide-react';
import { PlatformTemplate, PlatformTemplateType } from '@/lib/backoffice/backoffice-types';
import { createTemplateAction, updateTemplateAction } from '@/lib/backoffice/backoffice-template-actions';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { getEnabledIndustries } from '@/lib/industry-config';

interface TemplateDialogProps {
  readonly template: PlatformTemplate | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
}

const TEMPLATE_TYPES: PlatformTemplateType[] = [
  'page',
  'section',
  'block',
  'messaging',
  'form',
  'survey',
  'pdf',
  'automation',
  'pipeline',
  'task',
  'theme',
  'role_architecture'
];

export default function TemplateDialog({ template, open, onOpenChange, onSuccess }: TemplateDialogProps) {
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [type, setType] = React.useState<PlatformTemplateType>('page');
  const [defaultForNewOrgs, setDefaultForNewOrgs] = React.useState(false);
  const [selectedVerticals, setSelectedVerticals] = React.useState<string[]>([]);
  const [jsonText, setJsonText] = React.useState('{}');
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [changelog, setChangelog] = React.useState('');

  const enabledIndustries = React.useMemo(() => getEnabledIndustries(), []);

  React.useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setCategory(template.category);
      setType(template.type);
      setDefaultForNewOrgs(template.defaultForNewOrgs);
      setSelectedVerticals(template.visibilityRules?.workspaceTypes || []);
      setJsonText(JSON.stringify(template.content, null, 2));
      setJsonError(null);
      setChangelog('');
    } else {
      setName('');
      setDescription('');
      setCategory('General');
      setType('page');
      setDefaultForNewOrgs(false);
      setSelectedVerticals([]);
      setJsonText('{\n  "sections": []\n}');
      setJsonError(null);
      setChangelog('');
    }
  }, [template, open]);

  // JSON Validation check
  const handleJsonChange = (val: string) => {
    setJsonText(val);
    try {
      if (val.trim() === '') {
        setJsonError('JSON payload cannot be empty');
        return;
      }
      JSON.parse(val);
      setJsonError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON format';
      setJsonError(msg);
    }
  };

  const handleToggleVertical = (vertical: string) => {
    setSelectedVerticals(prev => 
      prev.includes(vertical) 
        ? prev.filter(v => v !== vertical) 
        : [...prev, vertical]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonError) {
      toast({ variant: 'destructive', title: 'Invalid JSON', description: 'Please resolve JSON format errors before saving.' });
      return;
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(jsonText);
    } catch {
      toast({ variant: 'destructive', title: 'Invalid JSON', description: 'Failed to parse JSON text content.' });
      return;
    }

    setLoading(true);
    try {
      const idToken = await getToken();
      
      const payload = {
        name,
        description,
        category,
        type,
        content: parsedContent,
        defaultForNewOrgs,
        visibilityRules: {
          orgIds: template?.visibilityRules?.orgIds || [],
          workspaceTypes: selectedVerticals
        }
      };

      if (template) {
        // Edit mode
        const result = await updateTemplateAction(template.id, {
          ...payload,
          changelog: changelog || undefined
        }, idToken);

        if (result.success) {
          toast({ title: 'Template updated', description: 'Successfully saved template changes.' });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ variant: 'destructive', title: 'Update failed', description: result.error ?? 'Unknown error occurred.' });
        }
      } else {
        // Create mode
        const result = await createTemplateAction(payload, idToken);

        if (result.success) {
          toast({ title: 'Template created', description: 'Successfully created new platform template.' });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ variant: 'destructive', title: 'Creation failed', description: result.error ?? 'Unknown error occurred.' });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Authentication error', description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-muted border border-border text-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {template ? 'Edit Template' : 'Create New Platform Preset'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Admin tool to define global system layouts, messaging presets, or structures.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5 py-2">
          {/* Base Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-semibold text-muted-foreground">Template Name</Label>
              <Input
                id="tpl-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-10 bg-background border-border text-foreground rounded-xl text-sm"
                placeholder="e.g. SaaS Hero Split"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-category" className="text-xs font-semibold text-muted-foreground">Category/Goal</Label>
              <Input
                id="tpl-category"
                required
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="h-10 bg-background border-border text-foreground rounded-xl text-sm"
                placeholder="e.g. hero, testimonial, FAQ, survey"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              id="tpl-desc"
              required
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-background border-border text-foreground rounded-xl text-sm min-h-[50px]"
              placeholder="Explain the layout, scope, and compatibility targets..."
            />
          </div>

          {/* Type & Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-type" className="text-xs font-semibold text-muted-foreground">Template Type</Label>
              <Select value={type} onValueChange={(v: PlatformTemplateType) => setType(v)}>
                <SelectTrigger id="tpl-type" className="h-10 bg-background border-border text-foreground rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {TEMPLATE_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize text-sm">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3 pt-6">
              <Checkbox
                id="tpl-default"
                checked={defaultForNewOrgs}
                onCheckedChange={checked => setDefaultForNewOrgs(!!checked)}
                className="border-border data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="tpl-default" className="text-xs font-semibold text-foreground cursor-pointer">
                Apply as default for all new organizations
              </Label>
            </div>
          </div>

          {/* Scoped Verticals */}
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-xs font-semibold text-muted-foreground block">Industry Vertical Scope</Label>
            <div className="flex gap-2 flex-wrap">
              {enabledIndustries.map(ind => {
                const isSelected = selectedVerticals.includes(ind);
                return (
                  <Button
                    key={ind}
                    type="button"
                    variant="outline"
                    onClick={() => handleToggleVertical(ind)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border-border transition-colors ${
                      isSelected 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                        : 'bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 mr-1" />}
                    {ind}
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1">
              <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              If no verticals are selected, the template scopes as universally available to all organizations.
            </p>
          </div>

          {/* JSON Schema Content Editor */}
          <div className="space-y-1.5 border-t border-border pt-4">
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="tpl-content" className="text-xs font-semibold text-muted-foreground">JSON Payload Configuration</Label>
              {jsonError ? (
                <span className="text-[10px] text-red-400 flex items-center gap-1 font-mono">
                  <AlertCircle className="h-3.5 w-3.5" />
                  JSON Error
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Check className="h-3.5 w-3.5" />
                  JSON Valid
                </span>
              )}
            </div>
            <Textarea
              id="tpl-content"
              required
              rows={8}
              value={jsonText}
              onChange={e => handleJsonChange(e.target.value)}
              className={`font-mono text-[11px] bg-background text-foreground rounded-xl leading-relaxed ${
                jsonError ? 'border-red-500/30 focus:border-red-500/50' : 'border-border focus:border-emerald-500/50'
              }`}
              placeholder={'{\n  "sections": []\n}'}
            />
            {jsonError && (
              <p className="text-[10px] text-red-400 font-mono bg-red-500/5 p-2 rounded-lg border border-red-500/10 mt-1">
                {jsonError}
              </p>
            )}
          </div>

          {/* Edit Changelog */}
          {template && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <Label htmlFor="tpl-changelog" className="text-xs font-semibold text-muted-foreground">Release Notes / Changelog</Label>
              <Input
                id="tpl-changelog"
                value={changelog}
                onChange={e => setChangelog(e.target.value)}
                className="h-10 bg-background border-border text-foreground rounded-xl text-sm"
                placeholder="Describe your template content edits (e.g. Added video element)..."
              />
            </div>
          )}

          {/* Footer Actions */}
          <DialogFooter className="border-t border-border pt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="border-border text-foreground hover:bg-accent rounded-xl h-10 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || jsonError !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4 cursor-pointer"
            >
              {loading ? 'Saving...' : template ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

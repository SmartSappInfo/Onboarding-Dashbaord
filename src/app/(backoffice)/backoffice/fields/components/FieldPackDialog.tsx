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
import { X, Plus, Info } from 'lucide-react';
import { PlatformFieldPack } from '@/lib/backoffice/backoffice-types';
import { IndustryVertical, EntityType } from '@/lib/types';
import { saveFieldPack } from '@/lib/backoffice/backoffice-field-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import { useToast } from '@/hooks/use-toast';

interface FieldPackDialogProps {
  pack: Partial<PlatformFieldPack> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INDUSTRIES: IndustryVertical[] = ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'];
const ENTITY_TYPES: EntityType[] = ['institution', 'person'];

export default function FieldPackDialog({ pack, open, onOpenChange, onSuccess }: FieldPackDialogProps) {
  const { profile } = useBackoffice();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<PlatformFieldPack>>({
    name: '',
    description: '',
    industryCompatibility: [],
    entityCompatibility: [],
    isDefaultForNewWorkspaces: false,
    fields: [],
  });

  React.useEffect(() => {
    if (pack) {
      setFormData({
        ...pack,
        industryCompatibility: pack.industryCompatibility || [],
        entityCompatibility: pack.entityCompatibility || [],
        fields: pack.fields || [],
      });
    } else {
      setFormData({
        name: '',
        description: '',
        industryCompatibility: [],
        entityCompatibility: [],
        isDefaultForNewWorkspaces: false,
        fields: [],
      });
    }
  }, [pack, open]);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name is required' });
      return;
    }
    if (!profile?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Authentication required' });
      return;
    }

    setLoading(true);
    try {
      const actor: any = {
        userId: profile.id,
        name: profile.name || 'Unknown Admin',
        email: profile.email || '',
        role: profile.backofficeRoles?.[0] || 'super_admin'
      };

      const res = await saveFieldPack(formData as PlatformFieldPack, actor);
      if (res.success) {
        toast({ title: 'Success', description: `Field pack ${pack ? 'updated' : 'created'} successfully.` });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to save field pack' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleIndustry = (industry: IndustryVertical) => {
    setFormData(prev => ({
      ...prev,
      industryCompatibility: prev.industryCompatibility?.includes(industry)
        ? prev.industryCompatibility.filter(i => i !== industry)
        : [...(prev.industryCompatibility || []), industry]
    }));
  };

  const toggleEntityType = (type: EntityType) => {
    setFormData(prev => ({
      ...prev,
      entityCompatibility: prev.entityCompatibility?.includes(type)
        ? prev.entityCompatibility.filter(t => t !== type)
        : [...(prev.entityCompatibility || []), type]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border rounded-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{pack ? 'Edit' : 'Create'} Field Pack</DialogTitle>
          <DialogDescription>
            Field packs are automatically seeded into new workspaces based on their industry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pack-name">Pack Name</Label>
              <Input
                id="pack-name"
                placeholder="e.g. Real Estate Core"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="bg-muted/50 border-border rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pack-desc">Description</Label>
              <Textarea
                id="pack-desc"
                placeholder="Describe what this pack provides..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="bg-muted/50 border-border rounded-xl min-h-[100px]"
              />
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-xl bg-accent/20 border border-border">
              <Checkbox
                id="is-default"
                checked={formData.isDefaultForNewWorkspaces}
                onCheckedChange={val => setFormData({ ...formData, isDefaultForNewWorkspaces: !!val })}
              />
              <label htmlFor="is-default" className="text-xs font-medium cursor-pointer">
                Global Default for New Workspaces
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Industry Compatibility</Label>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRIES.map(industry => (
                  <button
                    key={industry}
                    type="button"
                    onClick={() => toggleIndustry(industry)}
                    className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      formData.industryCompatibility?.includes(industry)
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-muted/30 border-border text-muted-foreground hover:border-emerald-500/20'
                    }`}
                  >
                    {industry}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entity Compatibility</Label>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleEntityType(type)}
                    className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      formData.entityCompatibility?.includes(type)
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-muted/30 border-border text-muted-foreground hover:border-blue-500/20'
                    }`}
                  >
                    {type === 'institution' ? 'Organizations' : 'Persons'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3 text-amber-500/80">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">
                Field content for this pack is currently managed via Firestore directly in this version. Use this dialog to manage high-level compatibility and default status.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 p-4 -mx-6 -mb-6 border-t border-border">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl px-8"
          >
            {loading ? 'Saving...' : pack ? 'Update Pack' : 'Create Pack'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

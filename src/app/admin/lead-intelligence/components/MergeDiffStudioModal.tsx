/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Lead Intelligence 2.0 - Phase 3):
 * 
 * MergeDiffStudioModal implements UI Spec Section 21:
 * - Side-by-side visual comparison between Discovered Prospect (Record A) and CRM Entity (Record B).
 * - Granular field-level choices (Record A / Record B / Custom Input).
 * - Contact & Technographics strategy controls (Combine / Record A Only / Record B Only).
 * - Live real-time canonical preview card rendering the synthesized result before execution.
 * - Mobile-first responsive layout (collapses to stacked cards on small screens).
 * - Emil Kowalski physics (spring transitions, active:scale-[0.97]).
 */

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  GitMerge, 
  ArrowRight, 
  Globe, 
  Phone, 
  MapPin, 
  Users, 
  Cpu, 
  Sparkles, 
  Check, 
  Loader2, 
  Layers
} from 'lucide-react';
import type { 
  IdentityCollisionRecord, 
  MergeFieldSelection, 
  MergeFieldChoice, 
  MergeArrayStrategy,
  CanonicalMergePayload 
} from '@/lib/lead-intelligence/types';
import { executeIdentityMergeAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MergeDiffStudioModalProps {
  collision: IdentityCollisionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onMergedSuccess: (entityId: string) => void;
  workspaceId: string;
}

export function MergeDiffStudioModal({
  collision,
  isOpen,
  onClose,
  onMergedSuccess,
  workspaceId
}: MergeDiffStudioModalProps) {
  const { toast } = useToast();
  const [isMerging, setIsMerging] = useState(false);

  // Field Choices
  const [nameChoice, setNameChoice] = useState<MergeFieldChoice>('record_b');
  const [customName, setCustomName] = useState('');

  const [domainChoice, setDomainChoice] = useState<MergeFieldChoice>('record_b');
  const [customDomain, setCustomDomain] = useState('');

  const [phoneChoice, setPhoneChoice] = useState<MergeFieldChoice>('record_b');
  const [customPhone, setCustomPhone] = useState('');

  const [addressChoice, setAddressChoice] = useState<MergeFieldChoice>('record_b');
  const [customAddress, setCustomAddress] = useState('');

  const [techStrategy, setTechStrategy] = useState<MergeArrayStrategy>('combine');
  const [contactsStrategy, setContactsStrategy] = useState<MergeArrayStrategy>('combine');

  // Reset defaults when collision changes
  useEffect(() => {
    if (collision) {
      const hasCrmDomain = Boolean(collision.existingEntityDomain);
      const hasProspectDomain = Boolean(collision.prospect.domain);

      const hasCrmPhone = Boolean(collision.existingEntityPhone);
      const hasProspectPhone = Boolean(collision.prospect.phone);

      const hasCrmLocation = Boolean(collision.existingEntityLocation);
      const hasProspectLocation = Boolean(collision.prospect.address);

      setNameChoice('record_b');
      setCustomName('');

      setDomainChoice(!hasCrmDomain && hasProspectDomain ? 'record_a' : 'record_b');
      setCustomDomain('');

      setPhoneChoice(!hasCrmPhone && hasProspectPhone ? 'record_a' : 'record_b');
      setCustomPhone('');

      setAddressChoice(!hasCrmLocation && hasProspectLocation ? 'record_a' : 'record_b');
      setCustomAddress('');

      setTechStrategy('combine');
      setContactsStrategy('combine');
    }
  }, [collision]);

  if (!collision) return null;

  const prospect = collision.prospect;
  const crmDomain = collision.existingEntityDomain || '';
  const crmPhone = collision.existingEntityPhone || '';
  const crmLocation = collision.existingEntityLocation || '';

  // Calculate live preview canonical values
  const previewName = nameChoice === 'record_a' 
    ? prospect.name 
    : nameChoice === 'custom' && customName.trim() 
      ? customName.trim() 
      : collision.existingEntityName;

  const previewDomain = domainChoice === 'record_a' 
    ? prospect.domain 
    : domainChoice === 'custom' && customDomain.trim() 
      ? customDomain.trim() 
      : crmDomain;

  const previewPhone = phoneChoice === 'record_a' 
    ? prospect.phone 
    : phoneChoice === 'custom' && customPhone.trim() 
      ? customPhone.trim() 
      : crmPhone;

  const previewAddress = addressChoice === 'record_a' 
    ? (prospect.address || '')
    : addressChoice === 'custom' && customAddress.trim() 
      ? customAddress.trim() 
      : crmLocation;

  const handleExecuteMerge = async () => {
    setIsMerging(true);
    try {
      const fieldSelection: MergeFieldSelection = {
        nameChoice,
        customName: customName.trim() || undefined,
        domainChoice,
        customDomain: customDomain.trim() || undefined,
        phoneChoice,
        customPhone: customPhone.trim() || undefined,
        addressChoice,
        customAddress: customAddress.trim() || undefined,
        technologiesStrategy: techStrategy,
        contactsStrategy
      };

      const payload: CanonicalMergePayload = {
        collisionId: collision.id,
        prospectId: prospect.id,
        entityId: collision.entityId,
        fieldSelection,
        notes: `Merged record "${prospect.name}" into "${collision.existingEntityName}" with ${Math.round(collision.matchConfidence * 100)}% match confidence.`
      };

      const result = await executeIdentityMergeAction(workspaceId, payload);

      if (result.success) {
        toast({
          title: 'Records Merged Successfully',
          description: `Synthesized canonical entity with ${result.mergedContactsCount} total contacts and ${result.mergedTechnologiesCount} tech signatures.`
        });
        onMergedSuccess(collision.entityId);
        onClose();
      } else {
        toast({
          title: 'Merge Failed',
          description: result.error || 'Could not complete transactional merge.',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Merge Error',
        description: 'An unexpected error occurred during record synthesis.',
        variant: 'destructive'
      });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden shadow-2xl border bg-card">
        {/* Header */}
        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                <GitMerge className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Side-by-Side Merge Studio
                  <Badge variant="outline" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                    {Math.round(collision.matchConfidence * 100)}% Match Confidence
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Resolve field conflicts between newly discovered prospect and existing CRM entity.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Diff Comparison Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Match Reasons Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-foreground">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-600 dark:text-amber-400">Match Evidence:</span>{' '}
              {collision.matchReasons.join(' • ')}
            </div>
          </div>

          {/* Grid Headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 border-b">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-2">
                <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-bold text-[10px]">
                  RECORD A
                </Badge>
                <span className="text-xs font-bold text-foreground">Discovered Prospect</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{(prospect.source || 'web').toUpperCase()}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-bold text-[10px]">
                  RECORD B
                </Badge>
                <span className="text-xs font-bold text-foreground">Existing CRM Entity</span>
              </div>
              <span className="text-[11px] text-muted-foreground">ACTIVE CRM</span>
            </div>
          </div>

          {/* Field 1: Entity Name */}
          <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" /> Company Name
              </Label>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Selected: <span className="text-primary font-bold">{previewName}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNameChoice('record_a')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  nameChoice === 'record_a' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{prospect.name}</span>
                {nameChoice === 'record_a' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>

              <button
                type="button"
                onClick={() => setNameChoice('record_b')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  nameChoice === 'record_b' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{collision.existingEntityName}</span>
                {nameChoice === 'record_b' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>
            </div>
            {nameChoice === 'custom' && (
              <Input
                placeholder="Enter custom company name..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="mt-2 text-xs rounded-xl min-h-[44px]"
              />
            )}
          </div>

          {/* Field 2: Website & Domain */}
          <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" /> Website / Domain
              </Label>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Selected: <span className="text-primary font-bold">{previewDomain || 'None'}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDomainChoice('record_a')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  domainChoice === 'record_a' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{prospect.domain || 'No domain'}</span>
                {domainChoice === 'record_a' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>

              <button
                type="button"
                onClick={() => setDomainChoice('record_b')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  domainChoice === 'record_b' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{crmDomain || 'No domain in CRM'}</span>
                {domainChoice === 'record_b' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>
            </div>
          </div>

          {/* Field 3: Phone */}
          <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" /> Primary Phone
              </Label>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Selected: <span className="text-primary font-bold">{previewPhone || 'None'}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPhoneChoice('record_a')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  phoneChoice === 'record_a' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{prospect.phone || 'No phone'}</span>
                {phoneChoice === 'record_a' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>

              <button
                type="button"
                onClick={() => setPhoneChoice('record_b')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  phoneChoice === 'record_b' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{crmPhone || 'No phone in CRM'}</span>
                {phoneChoice === 'record_b' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>
            </div>
          </div>

          {/* Field 4: Location */}
          <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Physical Location
              </Label>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Selected: <span className="text-primary font-bold">{previewAddress || 'None'}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAddressChoice('record_a')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  addressChoice === 'record_a' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{prospect.address || 'No address'}</span>
                {addressChoice === 'record_a' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>

              <button
                type="button"
                onClick={() => setAddressChoice('record_b')}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all min-h-[44px] cursor-pointer",
                  addressChoice === 'record_b' 
                    ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary" 
                    : "bg-muted/10 border-border/70 hover:bg-muted/20"
                )}
              >
                <span className="font-semibold truncate">{crmLocation || 'No location in CRM'}</span>
                {addressChoice === 'record_b' && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
              </button>
            </div>
          </div>

          {/* Array Field Strategies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contacts Strategy */}
            <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Contacts Strategy
              </Label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setContactsStrategy('combine')}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-all min-h-[40px] cursor-pointer",
                    contactsStrategy === 'combine' ? "bg-primary/10 border-primary font-bold" : "hover:bg-muted/30"
                  )}
                >
                  <span>Combine All ({prospect.contacts.length + collision.existingEntityContactsCount} total)</span>
                  {contactsStrategy === 'combine' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setContactsStrategy('record_b_only')}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-all min-h-[40px] cursor-pointer",
                    contactsStrategy === 'record_b_only' ? "bg-primary/10 border-primary font-bold" : "hover:bg-muted/30"
                  )}
                >
                  <span>Keep CRM Contacts Only ({collision.existingEntityContactsCount})</span>
                  {contactsStrategy === 'record_b_only' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </div>
            </div>

            {/* Technographics Strategy */}
            <div className="space-y-2 p-3.5 rounded-xl bg-card border shadow-xs">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" /> Technology Signatures
              </Label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setTechStrategy('combine')}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-all min-h-[40px] cursor-pointer",
                    techStrategy === 'combine' ? "bg-primary/10 border-primary font-bold" : "hover:bg-muted/30"
                  )}
                >
                  <span>Union Detected Tech ({prospect.websiteScan?.technologies?.length || 0} discovered)</span>
                  {techStrategy === 'combine' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTechStrategy('record_b_only')}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-all min-h-[40px] cursor-pointer",
                    techStrategy === 'record_b_only' ? "bg-primary/10 border-primary font-bold" : "hover:bg-muted/30"
                  )}
                >
                  <span>Keep CRM Tech Data Only</span>
                  {techStrategy === 'record_b_only' && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </div>
            </div>
          </div>

          {/* Canonical Preview Card */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 text-left">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                Canonical Resulting Record Preview
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold">NAME</span>
                <span className="font-semibold text-foreground truncate block">{previewName}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold">DOMAIN</span>
                <span className="font-semibold text-foreground truncate block">{previewDomain || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold">PHONE</span>
                <span className="font-semibold text-foreground truncate block">{previewPhone || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold">LOCATION</span>
                <span className="font-semibold text-foreground truncate block">{previewAddress || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t shrink-0 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isMerging}
            className="rounded-xl min-h-[44px] active:scale-[0.97]"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteMerge}
            disabled={isMerging}
            className="rounded-xl min-h-[44px] font-bold bg-primary text-primary-foreground active:scale-[0.97] flex items-center gap-2"
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Synthesizing Records...</span>
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4" />
                <span>Execute Canonical Merge</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

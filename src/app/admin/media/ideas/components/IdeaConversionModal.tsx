'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Idea Conversion Modal
 *
 * Provides a 1-click conversion pipeline turning Idea Canvas concepts into Assets,
 * Experiences, Packages, or Campaign bundles.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Single Source of Truth: Routes directly into existing domain models (`MediaAsset2`, `MediaExperience`, `MediaPackage`).
 * 2. Mobile Accessibility: Touch targets enforce `min-h-[44px] min-w-[44px]`.
 * 3. Tactile Micro-Animations: `active:scale-[0.97]` on all buttons.
 * 4. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 */

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Layers,
  Send,
  Package as PackageIcon,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/lib/firestore-context';
import {
  convertIdeaToAssetAction,
  convertIdeaToExperienceAction,
  convertIdeaToPackageAction,
  convertIdeaToCampaignAction,
} from '@/lib/media/idea-canvas-service';
import type { MediaIdeaCanvas } from '@/lib/types/media-2.0';

export interface IdeaConversionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas: MediaIdeaCanvas;
  workspaceId: string;
}

export function IdeaConversionModal({
  open,
  onOpenChange,
  canvas,
  workspaceId,
}: IdeaConversionModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'asset' | 'experience' | 'package' | 'campaign'>('asset');
  const [isPending, startTransition] = useTransition();

  // Form State
  const [assetTitle, setAssetTitle] = useState(canvas.title || '');
  const [assetFormat, setAssetFormat] = useState<'video' | 'audio' | 'pdf' | 'interactive'>('video');
  const [assetDesc, setAssetDesc] = useState(canvas.description || '');

  const [expTitle, setExpTitle] = useState(`${canvas.title} Experience`);
  const [ctaLabel, setCtaLabel] = useState('Book Consultation');
  const [ctaUrl, setCtaUrl] = useState('/contact');

  const [pkgTitle, setPkgTitle] = useState(`${canvas.title} Orientation Suite`);
  const [campaignTitle, setCampaignTitle] = useState(`${canvas.title} Outreach Campaign`);

  const handleConvertAsset = () => {
    if (!firestore || !workspaceId) return;
    startTransition(async () => {
      try {
        const result = await convertIdeaToAssetAction(
          firestore,
          workspaceId,
          canvas.id,
          'idea_node',
          assetTitle,
          assetFormat,
          assetDesc
        );
        toast({
          title: 'Asset Created Successfully',
          description: `Created draft asset "${result.title}" in your Media Library.`,
          actionConfig: {
            path: `/admin/media?assetId=${result.id}`,
            label: 'View in Library',
          },
        });
        onOpenChange(false);
      } catch (err) {
        console.error('[IdeaConversionModal] Error creating asset:', err);
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: 'Could not convert idea to asset. Please try again.',
        });
      }
    });
  };

  const handleConvertExperience = () => {
    if (!firestore || !workspaceId) return;
    startTransition(async () => {
      try {
        const targetAssetId = canvas.convertedAssetId || `asset_${Date.now()}`;
        const result = await convertIdeaToExperienceAction(
          firestore,
          workspaceId,
          canvas.id,
          targetAssetId,
          expTitle,
          ctaLabel,
          ctaUrl
        );
        toast({
          title: 'Experience Scaffolded',
          description: `Created new experience "${result.title}". Ready for sharing.`,
          actionConfig: {
            path: '/admin/media/experiences',
            label: 'View Experiences',
          },
        });
        onOpenChange(false);
      } catch (err) {
        console.error('[IdeaConversionModal] Error creating experience:', err);
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: 'Could not create experience. Please try again.',
        });
      }
    });
  };

  const handleConvertPackage = () => {
    if (!firestore || !workspaceId) return;
    startTransition(async () => {
      try {
        const assetIds = canvas.convertedAssetId ? [canvas.convertedAssetId] : [];
        if (assetIds.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Asset Required',
            description: 'Please convert an idea node into an Asset first before bundling into a Package.',
          });
          return;
        }
        const result = await convertIdeaToPackageAction(
          firestore,
          workspaceId,
          canvas.id,
          pkgTitle,
          assetIds
        );
        toast({
          title: 'Package Created',
          description: `Bundled assets into package "${result.title}".`,
          actionConfig: {
            path: '/admin/media?tab=packages',
            label: 'View Packages',
          },
        });
        onOpenChange(false);
      } catch (err) {
        console.error('[IdeaConversionModal] Error creating package:', err);
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: 'Could not bundle package. Please try again.',
        });
      }
    });
  };

  const handleConvertCampaign = () => {
    startTransition(async () => {
      try {
        await convertIdeaToCampaignAction(
          workspaceId,
          canvas.id,
          campaignTitle,
          canvas.targetAudience || 'Parents',
          ['Fee clarity', 'Payment terms'],
          [assetTitle]
        );
        toast({
          title: 'Ready for Campaign Intelligence',
          description: `Prepared "${campaignTitle}" for messaging broadcast.`,
          actionConfig: {
            path: '/admin/messaging/campaigns',
            label: 'Go to Campaigns',
          },
        });
        onOpenChange(false);
      } catch (err) {
        console.error('[IdeaConversionModal] Error preparing campaign:', err);
        toast({
          variant: 'destructive',
          title: 'Conversion Failed',
          description: 'Could not prepare campaign. Please try again.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Convert Idea into Actionable Content
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Transform this strategic brainstorm into an asset, experience, package, or campaign handoff.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full min-h-[44px]">
            <TabsTrigger value="asset" className="min-h-[40px] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97]">
              <FileText className="h-3.5 w-3.5" />
              Asset
            </TabsTrigger>
            <TabsTrigger value="experience" className="min-h-[40px] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97]">
              <Layers className="h-3.5 w-3.5" />
              Experience
            </TabsTrigger>
            <TabsTrigger value="package" className="min-h-[40px] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97]">
              <PackageIcon className="h-3.5 w-3.5" />
              Package
            </TabsTrigger>
            <TabsTrigger value="campaign" className="min-h-[40px] text-xs font-semibold flex items-center gap-1.5 active:scale-[0.97]">
              <Send className="h-3.5 w-3.5" />
              Campaign
            </TabsTrigger>
          </TabsList>

          {/* 1. Convert to Asset */}
          <TabsContent value="asset" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Asset Title</Label>
              <Input
                value={assetTitle}
                onChange={(e) => setAssetTitle(e.target.value)}
                placeholder="e.g. 2026 Tuition Schedule Video"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Format</Label>
              <Select value={assetFormat} onValueChange={(v) => setAssetFormat(v as typeof assetFormat)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video Presentation</SelectItem>
                  <SelectItem value="audio">Audio / Podcast Brief</SelectItem>
                  <SelectItem value="pdf">PDF Document / Guide</SelectItem>
                  <SelectItem value="interactive">Interactive Widget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Summary & Notes</Label>
              <Textarea
                value={assetDesc}
                onChange={(e) => setAssetDesc(e.target.value)}
                placeholder="Briefly describe what this asset covers..."
                className="min-h-[80px] text-xs"
              />
            </div>
            <Button
              onClick={handleConvertAsset}
              disabled={isPending || !assetTitle.trim()}
              className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium active:scale-[0.97]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Create Draft Asset in Media Library
            </Button>
          </TabsContent>

          {/* 2. Convert to Experience */}
          <TabsContent value="experience" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Experience Title</Label>
              <Input
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="e.g. Tuition Planning Showcase"
                className="min-h-[44px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Call to Action Label</Label>
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="e.g. Book Consultation"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination URL</Label>
                <Input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="e.g. /contact"
                  className="min-h-[44px]"
                />
              </div>
            </div>
            <Button
              onClick={handleConvertExperience}
              disabled={isPending || !expTitle.trim()}
              className="w-full min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-medium active:scale-[0.97]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Layers className="h-4 w-4 mr-2" />}
              Publish Branded Experience
            </Button>
          </TabsContent>

          {/* 3. Convert to Package */}
          <TabsContent value="package" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Package Title</Label>
              <Input
                value={pkgTitle}
                onChange={(e) => setPkgTitle(e.target.value)}
                placeholder="e.g. Complete Admissions Package"
                className="min-h-[44px]"
              />
            </div>
            <p className="text-xs text-slate-500">
              Bundles current asset ideas into a single shareable package for sales enablement and customer onboarding.
            </p>
            <Button
              onClick={handleConvertPackage}
              disabled={isPending || !pkgTitle.trim()}
              className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-medium active:scale-[0.97]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageIcon className="h-4 w-4 mr-2" />}
              Create Curated Package
            </Button>
          </TabsContent>

          {/* 4. Convert to Campaign */}
          <TabsContent value="campaign" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Campaign Name</Label>
              <Input
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="e.g. Q4 Tuition Transparency Campaign"
                className="min-h-[44px]"
              />
            </div>
            <p className="text-xs text-slate-500">
              Exports concept metadata and recommended media references directly into Campaign Intelligence for broadcast over WhatsApp, SMS, and Email.
            </p>
            <Button
              onClick={handleConvertCampaign}
              disabled={isPending || !campaignTitle.trim()}
              className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium active:scale-[0.97]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Handoff to Campaign Intelligence
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] active:scale-[0.97]"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

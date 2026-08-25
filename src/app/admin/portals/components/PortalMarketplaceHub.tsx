'use client';

/**
 * {{Org_name}} Experience Platform — Template Marketplace Hub
 *
 * Visual marketplace gallery for 1-click cloning pre-built industry portals
 * (Executive Academy, Corporate L&D, SaaS Community, Certification Center).
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  listMarketplaceListingsAction,
  installMarketplaceTemplateAction,
} from '@/app/actions/enterprise-actions';
import type { MarketplaceListing, MarketplaceCategory } from '@/lib/types/enterprise';
import {
  Sparkles,
  Download,
  Star,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  BookOpen,
  Award,
  Users,
  Building,
} from 'lucide-react';

interface PortalMarketplaceHubProps {
  organizationId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled?: (portalId: string, slug: string) => void;
}

export function PortalMarketplaceHub({
  organizationId,
  isOpen,
  onOpenChange,
  onInstalled,
}: PortalMarketplaceHubProps) {
  const { toast } = useToast();
  const [listings, setListings] = React.useState<MarketplaceListing[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<MarketplaceCategory | 'all'>('all');
  const [isLoading, setIsLoading] = React.useState(false);

  // Install Modal State
  const [selectedListing, setSelectedListing] = React.useState<MarketplaceListing | null>(null);
  const [newPortalTitle, setNewPortalTitle] = React.useState('');
  const [newPortalSlug, setNewPortalSlug] = React.useState('');
  const [isInstalling, setIsInstalling] = React.useState(false);

  const loadListings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listMarketplaceListingsAction(
        selectedCategory === 'all' ? undefined : selectedCategory
      );
      if (res.success && res.data) {
        setListings(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load marketplace.';
      toast({ title: 'Load Failed', description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, toast]);

  React.useEffect(() => {
    if (isOpen) {
      loadListings();
    }
  }, [isOpen, loadListings]);

  const handleOpenInstall = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
    setNewPortalTitle(`${listing.title} Copy`);
    setNewPortalSlug(`${listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`);
  };

  const handleInstallBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !newPortalTitle.trim() || !newPortalSlug.trim()) return;

    setIsInstalling(true);
    try {
      const res = await installMarketplaceTemplateAction(
        selectedListing.id,
        organizationId,
        newPortalTitle.trim(),
        newPortalSlug.trim()
      );

      if (!res.success || !res.data) throw new Error(res.error || 'Installation failed.');

      toast({
        title: 'Template Cloned Successfully! 🚀',
        description: `Your new portal "${newPortalTitle}" is ready in Portal Studio.`,
      });

      setSelectedListing(null);
      onOpenChange(false);
      if (onInstalled) {
        onInstalled(res.data.portalId, res.data.slug);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to install template.';
      toast({ title: 'Clone Failed', description: msg });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-3xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg sm:text-xl font-extrabold">
              Experience Platform Template Marketplace
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Deploy production-grade, pre-built portal blueprints configured with complete themes, navigation, and curriculum layouts in 1 click.
          </DialogDescription>
        </DialogHeader>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          {(['all', 'education', 'corporate_training', 'certification', 'community_hub'] as const).map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="rounded-xl text-xs font-bold capitalize h-8"
            >
              {cat.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map(item => (
              <Card
                key={item.id}
                className="p-5 rounded-3xl border border-border bg-card shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                        {item.iconEmoji}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-foreground">{item.title}</h4>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {item.rating}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            • {item.installCount} installs
                          </span>
                        </div>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[10px] font-bold py-0.5 capitalize">
                      {item.category.replace('_', ' ')}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="font-extrabold text-xs text-emerald-600">
                    {item.price === 0 ? 'FREE BLUEPRINT' : `$${item.price} ${item.currency}`}
                  </span>

                  <Button
                    size="sm"
                    onClick={() => handleOpenInstall(item)}
                    className="h-8 rounded-xl font-bold text-xs bg-primary text-white gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Clone & Deploy
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Clone Confirmation Dialog ──────────────────────────────── */}
        <Dialog open={!!selectedListing} onOpenChange={open => !open && setSelectedListing(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Clone Template Blueprint</DialogTitle>
              <DialogDescription className="text-xs">
                Name your new portal to instantly instantiate this blueprint.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInstallBlueprint} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Portal Name</Label>
                <Input
                  value={newPortalTitle}
                  onChange={e => setNewPortalTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">URL Slug</Label>
                <Input
                  value={newPortalSlug}
                  onChange={e => setNewPortalSlug(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isInstalling}
                className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white"
              >
                {isInstalling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Instantiate Portal'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

'use client';

/**
 * {{Org_name}} Experience Platform — Navigation Hierarchy Builder
 *
 * Interactive manager for Header navigation links, dropdown sub-trees,
 * header action CTAs, footer link columns, and social channels.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Compass,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Edit2,
  ExternalLink,
  Share2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type {
  PortalNavigationConfig,
  PortalNavItem,
  PortalNavItemType,
  PortalSocialLink,
} from '@/lib/types/portal';
import {
  PORTAL_CANONICAL_DESTINATIONS,
  normalizePortalRelativePath,
  resolvePortalPath,
} from '@/lib/utils/portal-navigation';
import { normalizeExistingPortalNavigationAction } from '@/app/actions/portal-actions';
import { useToast } from '@/hooks/use-toast';

interface PortalNavigationBuilderProps {
  navigation: PortalNavigationConfig;
  onChangeNavigation: (nav: PortalNavigationConfig) => void;
  portalSlug?: string;
  portalId?: string;
}

export function PortalNavigationBuilder({
  navigation,
  onChangeNavigation,
  portalSlug,
  portalId,
}: PortalNavigationBuilderProps) {
  const [editingItem, setEditingItem] = React.useState<{
    item: PortalNavItem;
    index: number;
    parentIndex?: number;
    target: 'header' | 'footer';
    footerColIndex?: number;
  } | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = React.useState(false);
  const [itemLabel, setItemLabel] = React.useState('');
  const [itemPath, setItemPath] = React.useState('');
  const [itemType, setItemType] = React.useState<PortalNavItemType>('internal_page');
  const [itemTarget, setItemTarget] = React.useState<'_self' | '_blank'>('_self');
  const [selectedCanonicalId, setSelectedCanonicalId] = React.useState<string>('custom');
  const [isNormalizing, setIsNormalizing] = React.useState(false);
  const { toast } = useToast();

  // Open modal to add new header item
  const handleAddNewHeaderItem = () => {
    setEditingItem({
      item: {
        id: `nav-${Date.now()}`,
        label: '',
        path: '/learn',
        type: 'internal_page',
        order: navigation.headerItems.length,
      },
      index: -1,
      target: 'header',
    });
    setItemLabel('');
    setItemPath('/learn');
    setSelectedCanonicalId('learn');
    setItemType('internal_page');
    setItemTarget('_self');
    setIsItemModalOpen(true);
  };

  // Open modal to edit existing item
  const handleEditItem = (item: PortalNavItem, index: number, target: 'header' | 'footer', footerColIndex?: number) => {
    setEditingItem({
      item,
      index,
      target,
      footerColIndex,
    });
    setItemLabel(item.label);
    setItemPath(item.path);
    setItemType(item.type);
    setItemTarget(item.target || '_self');

    // Auto-detect canonical preset
    const matched = PORTAL_CANONICAL_DESTINATIONS.find(
      d =>
        d.subpath.toLowerCase() === item.path.toLowerCase() ||
        d.subpath.toLowerCase() === normalizePortalRelativePath(item.path).toLowerCase()
    );
    setSelectedCanonicalId(matched ? matched.id : 'custom');
    setIsItemModalOpen(true);
  };

  // Handle canonical destination dropdown selection
  const handleCanonicalDestinationSelect = (destId: string) => {
    setSelectedCanonicalId(destId);
    if (destId === 'custom') return;

    const dest = PORTAL_CANONICAL_DESTINATIONS.find(d => d.id === destId);
    if (!dest) return;

    setItemPath(dest.subpath);
    setItemType('internal_page');
    setItemTarget('_self');

    const cleanLabelMap: Record<string, string> = {
      learn: 'Courses',
      content: 'Resources',
      docs: 'Help Centre',
      articles: 'Articles',
      resources: 'Downloads',
      community: 'Community',
      events: 'Events',
      join: 'Get Started',
      dashboard: 'Dashboard',
      home: 'Home',
    };

    const isDefaultOrEmpty =
      !itemLabel.trim() ||
      PORTAL_CANONICAL_DESTINATIONS.some(
        d => itemLabel.toLowerCase() === d.label.toLowerCase() || itemLabel.toLowerCase() === d.id.toLowerCase()
      ) ||
      Object.values(cleanLabelMap).some(l => itemLabel.toLowerCase() === l.toLowerCase());

    if (isDefaultOrEmpty) {
      setItemLabel(cleanLabelMap[dest.id] || dest.label);
    }
  };

  // Normalize all navigation links to canonical routes
  const handleStandardizeAllLinks = async () => {
    setIsNormalizing(true);
    try {
      if (portalId) {
        const res = await normalizeExistingPortalNavigationAction(portalId);
        if (res.success && res.data) {
          onChangeNavigation(res.data.portal.navigation);
          toast({
            title: 'Navigation Standardized',
            description: `Updated ${res.data.updatedCount} route(s) to canonical paths in the database.`,
          });
          return;
        }
      }

      let count = 0;
      const normalizedItems = navigation.headerItems.map(item => {
        const canon = normalizePortalRelativePath(item.path);
        if (canon !== item.path) count++;
        return { ...item, path: canon };
      });

      let normalizedCta = navigation.headerActions.ctaButton;
      if (normalizedCta?.path) {
        const canonCta = normalizePortalRelativePath(normalizedCta.path);
        if (canonCta !== normalizedCta.path) {
          count++;
          normalizedCta = { ...normalizedCta, path: canonCta };
        }
      }

      onChangeNavigation({
        ...navigation,
        headerItems: normalizedItems,
        headerActions: {
          ...navigation.headerActions,
          ctaButton: normalizedCta,
        },
      });

      toast({
        title: 'Navigation Standardized',
        description: `Normalized ${count} link(s) to canonical portal routes.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Standardization Error',
        description: err instanceof Error ? err.message : 'Failed to normalize navigation paths.',
      });
    } finally {
      setIsNormalizing(false);
    }
  };

  // Save modal edit
  const handleSaveModalItem = () => {
    if (!editingItem || !itemLabel.trim()) return;

    const updatedItem: PortalNavItem = {
      ...editingItem.item,
      label: itemLabel.trim(),
      path: itemPath.trim() || '/',
      type: itemType,
      target: itemTarget,
    };

    if (editingItem.target === 'header') {
      const items = [...navigation.headerItems];
      if (editingItem.index >= 0) {
        items[editingItem.index] = updatedItem;
      } else {
        items.push(updatedItem);
      }
      onChangeNavigation({ ...navigation, headerItems: items });
    } else if (editingItem.target === 'footer' && editingItem.footerColIndex !== undefined) {
      const cols = [...navigation.footerColumns];
      const col = { ...cols[editingItem.footerColIndex] };
      const colItems = [...col.items];
      if (editingItem.index >= 0) {
        colItems[editingItem.index] = updatedItem;
      } else {
        colItems.push(updatedItem);
      }
      col.items = colItems;
      cols[editingItem.footerColIndex] = col;
      onChangeNavigation({ ...navigation, footerColumns: cols });
    }

    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  // Reorder items
  const handleMoveHeaderItem = (index: number, direction: 'up' | 'down') => {
    const items = [...navigation.headerItems];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIdx];
    items[targetIdx] = temp;

    // re-index order
    items.forEach((item, idx) => {
      item.order = idx;
    });

    onChangeNavigation({ ...navigation, headerItems: items });
  };

  // Delete header item
  const handleDeleteHeaderItem = (index: number) => {
    const items = navigation.headerItems.filter((_, idx) => idx !== index);
    onChangeNavigation({ ...navigation, headerItems: items });
  };

  // Social link helpers
  const handleAddSocialLink = () => {
    const links: PortalSocialLink[] = [
      ...navigation.socialLinks,
      { platform: 'twitter', url: 'https://twitter.com' },
    ];
    onChangeNavigation({ ...navigation, socialLinks: links });
  };

  const handleUpdateSocialLink = (index: number, field: keyof PortalSocialLink, value: string) => {
    const links = [...navigation.socialLinks];
    links[index] = { ...links[index], [field]: value };
    onChangeNavigation({ ...navigation, socialLinks: links });
  };

  const handleDeleteSocialLink = (index: number) => {
    const links = navigation.socialLinks.filter((_, idx) => idx !== index);
    onChangeNavigation({ ...navigation, socialLinks: links });
  };

  return (
    <div className="space-y-6">
      {/* ── Header Navigation Menu ────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Compass className="w-4 h-4" /> Header Navigation Links
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isNormalizing}
                onClick={handleStandardizeAllLinks}
                className="h-8 rounded-xl font-bold text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                title="Normalize all navigation links and CTA buttons to canonical routes"
              >
                {isNormalizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Standardize Routes
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddNewHeaderItem}
                className="h-8 rounded-xl font-bold text-xs gap-1 bg-primary text-white hover:bg-primary/90"
              >
                <Plus className="w-3.5 h-3.5" /> Add Nav Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {navigation.headerItems.length === 0 ? (
            <div className="p-6 text-center border-2 border-dashed rounded-xl text-xs text-muted-foreground">
              No navigation items configured. Click &quot;Add Nav Item&quot; to create one.
            </div>
          ) : (
            navigation.headerItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-4 text-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      {item.label}
                      {item.target === '_blank' && (
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      )}
                    </h5>
                    <p className="text-[11px] font-mono text-muted-foreground">{item.path}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={idx === 0}
                    onClick={() => handleMoveHeaderItem(idx, 'up')}
                    className="h-8 w-8 rounded-lg"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={idx === navigation.headerItems.length - 1}
                    onClick={() => handleMoveHeaderItem(idx, 'down')}
                    className="h-8 w-8 rounded-lg"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditItem(item, idx, 'header')}
                    className="h-8 w-8 rounded-lg text-primary"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteHeaderItem(idx)}
                    className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Header Actions & CTA ──────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold">Header Actions & Primary CTA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="text-xs font-bold text-foreground">Sign In / Profile Button</p>
              <p className="text-[11px] text-muted-foreground">Show member login button in navbar</p>
            </div>
            <Switch
              checked={navigation.headerActions.showLoginButton}
              onCheckedChange={checked =>
                onChangeNavigation({
                  ...navigation,
                  headerActions: { ...navigation.headerActions, showLoginButton: checked },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="text-xs font-bold text-foreground">Search Bar</p>
              <p className="text-[11px] text-muted-foreground">Show instant search modal trigger</p>
            </div>
            <Switch
              checked={navigation.headerActions.showSearch}
              onCheckedChange={checked =>
                onChangeNavigation({
                  ...navigation,
                  headerActions: { ...navigation.headerActions, showSearch: checked },
                })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Primary CTA Button Label</Label>
              <Input
                placeholder="e.g. Enroll Now"
                value={navigation.headerActions.ctaButton?.label || ''}
                onChange={e =>
                  onChangeNavigation({
                    ...navigation,
                    headerActions: {
                      ...navigation.headerActions,
                      ctaButton: {
                        label: e.target.value,
                        path: navigation.headerActions.ctaButton?.path || '/signup',
                        style: navigation.headerActions.ctaButton?.style || 'primary',
                      },
                    },
                  })
                }
                className="h-10 rounded-xl text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">CTA Button URL / Route</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. /join"
                  value={navigation.headerActions.ctaButton?.path || ''}
                  onChange={e =>
                    onChangeNavigation({
                      ...navigation,
                      headerActions: {
                        ...navigation.headerActions,
                        ctaButton: {
                          label: navigation.headerActions.ctaButton?.label || 'Get Started',
                          path: e.target.value,
                          style: navigation.headerActions.ctaButton?.style || 'primary',
                        },
                      },
                    })
                  }
                  className="h-10 rounded-xl text-xs font-mono flex-1"
                />
                <Select
                  value={
                    ['/join', '/learn', '/content', '/community'].includes(
                      navigation.headerActions.ctaButton?.path || ''
                    )
                      ? navigation.headerActions.ctaButton?.path
                      : 'custom'
                  }
                  onValueChange={val => {
                    if (val !== 'custom') {
                      const defaultCtaLabels: Record<string, string> = {
                        '/join': 'Get Started',
                        '/learn': 'Browse Courses',
                        '/content': 'Resource Vault',
                        '/community': 'Join Community',
                      };
                      onChangeNavigation({
                        ...navigation,
                        headerActions: {
                          ...navigation.headerActions,
                          ctaButton: {
                            label:
                              defaultCtaLabels[val] ||
                              navigation.headerActions.ctaButton?.label ||
                              'Get Started',
                            path: val,
                            style: navigation.headerActions.ctaButton?.style || 'primary',
                          },
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-10 rounded-xl text-xs font-medium">
                    <SelectValue placeholder="Quick Preset" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="custom">Custom Route</SelectItem>
                    <SelectItem value="/join">Join (/join)</SelectItem>
                    <SelectItem value="/learn">Courses (/learn)</SelectItem>
                    <SelectItem value="/content">Vault (/content)</SelectItem>
                    <SelectItem value="/community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {portalSlug && (
                <p className="text-[11px] font-mono text-muted-foreground pt-0.5">
                  Live CTA Target: <span className="text-primary font-bold">{resolvePortalPath(navigation.headerActions.ctaButton?.path, portalSlug)}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Social Media Channels ─────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Share2 className="w-4 h-4" /> Social Channels
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSocialLink}
              className="h-8 rounded-xl font-bold text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Channel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {navigation.socialLinks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No social links configured.</p>
          ) : (
            navigation.socialLinks.map((link, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Select
                  value={link.platform}
                  onValueChange={val => handleUpdateSocialLink(idx, 'platform', val)}
                >
                  <SelectTrigger className="w-[140px] h-10 rounded-xl text-xs font-medium capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {['twitter', 'linkedin', 'facebook', 'youtube', 'instagram', 'github', 'website'].map(p => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="https://..."
                  value={link.url}
                  onChange={e => handleUpdateSocialLink(idx, 'url', e.target.value)}
                  className="h-10 rounded-xl text-xs flex-1 font-mono"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteSocialLink(idx)}
                  className="h-10 w-10 rounded-xl text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Link Editor Dialog ────────────────────────────────────────── */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingItem && editingItem.index >= 0 ? 'Edit Nav Item' : 'Add Nav Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Canonical Destination Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Pre-defined Destination
                </Label>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Recommended
                </span>
              </div>
              <Select value={selectedCanonicalId} onValueChange={handleCanonicalDestinationSelect}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Select a canonical space or custom..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[300px]">
                  <SelectItem value="custom" className="font-semibold text-muted-foreground">
                    -- Custom URL or External Link --
                  </SelectItem>
                  {PORTAL_CANONICAL_DESTINATIONS.map(dest => (
                    <SelectItem key={dest.id} value={dest.id} className="text-xs">
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium text-foreground">{dest.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{dest.subpath}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Label</Label>
              <Input
                placeholder="e.g. Courses"
                value={itemLabel}
                onChange={e => setItemLabel(e.target.value)}
                className="h-10 rounded-xl text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Path / URL</Label>
              <Input
                placeholder="e.g. /learn or https://..."
                value={itemPath}
                onChange={e => {
                  setItemPath(e.target.value);
                  setSelectedCanonicalId('custom');
                }}
                className="h-10 rounded-xl text-xs font-mono"
              />
              <div className="rounded-xl bg-muted/50 p-2.5 border border-border/70 flex items-center justify-between text-xs mt-1">
                <span className="text-[11px] text-muted-foreground font-medium">Live Portal Route:</span>
                <span className="font-mono text-[11px] font-bold text-primary">
                  {portalSlug ? resolvePortalPath(itemPath, portalSlug) : itemPath || '/'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Type</Label>
                <Select value={itemType} onValueChange={(val: PortalNavItemType) => setItemType(val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="internal_page">Internal Page</SelectItem>
                    <SelectItem value="external_url">External Link</SelectItem>
                    <SelectItem value="resource">Resource</SelectItem>
                    <SelectItem value="dropdown">Dropdown Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target Window</Label>
                <Select value={itemTarget} onValueChange={(val: '_self' | '_blank') => setItemTarget(val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_self">Same Tab (_self)</SelectItem>
                    <SelectItem value="_blank">New Tab (_blank)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsItemModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveModalItem}
              disabled={!itemLabel.trim()}
              className="rounded-xl font-bold bg-primary text-white hover:bg-primary/90"
            >
              Save Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

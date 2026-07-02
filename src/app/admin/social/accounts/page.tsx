'use client';

import * as React from 'react';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainerFluid } from '@/components/ui/page-container';
import { 
  Linkedin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Youtube, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Globe, 
  Info, 
  RefreshCw 
} from 'lucide-react';
import type { SocialAccount } from '@/lib/types';
import { cn } from '@/lib/utils';

// Lucide icon helper mapping
const iconMap: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

// Brand accent color helper mappings
const colorMap: Record<string, { bg: string; border: string; text: string; buttonBg: string; buttonHover: string }> = {
  facebook: { 
    bg: 'bg-blue-500/10 dark:bg-blue-500/5', 
    border: 'border-blue-500/20 dark:border-blue-500/10', 
    text: 'text-blue-600 dark:text-blue-400',
    buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonHover: 'hover:bg-blue-500/10'
  },
  instagram: { 
    bg: 'bg-pink-500/10 dark:bg-pink-500/5', 
    border: 'border-pink-500/20 dark:border-pink-500/10', 
    text: 'text-pink-600 dark:text-pink-400',
    buttonBg: 'bg-pink-600 hover:bg-pink-700 text-white',
    buttonHover: 'hover:bg-pink-500/10'
  },
  linkedin: { 
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/5', 
    border: 'border-indigo-500/20 dark:border-indigo-500/10', 
    text: 'text-indigo-600 dark:text-indigo-400',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    buttonHover: 'hover:bg-indigo-500/10'
  },
  x: { 
    bg: 'bg-slate-500/10 dark:bg-slate-500/5', 
    border: 'border-slate-500/20 dark:border-slate-500/10', 
    text: 'text-slate-700 dark:text-slate-300',
    buttonBg: 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-200 dark:hover:bg-slate-100 dark:text-slate-900 text-white',
    buttonHover: 'hover:bg-slate-500/10'
  },
  youtube: { 
    bg: 'bg-red-500/10 dark:bg-red-500/5', 
    border: 'border-red-500/20 dark:border-red-500/10', 
    text: 'text-red-600 dark:text-red-400',
    buttonBg: 'bg-red-600 hover:bg-red-700 text-white',
    buttonHover: 'hover:bg-red-500/10'
  },
};

export default function SocialAccountsPage() {
  const db = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const confirm = useConfirm();

  // 1. Fetch connected social accounts for the active workspace
  const socialQuery = React.useMemo(() => {
    if (!db || !activeWorkspaceId) return null;
    return query(
      collection(db, 'socialAccounts'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [db, activeWorkspaceId]);

  const { data: accountsRaw, isLoading } = useCollection<SocialAccount>(socialQuery);
  const accounts = accountsRaw || [];

  // Remove mock account
  const handleRemoveAccount = async (accountId: string, displayName: string) => {
    if (!db) return;
    
    const choice = await confirm({
      title: 'Disconnect Profile',
      description: `Are you sure you want to disconnect ${displayName}? This will stop active posts and inbox streaming.`,
      confirmText: 'Disconnect',
      variant: 'destructive',
    });

    if (!choice) return;

    try {
      await deleteDoc(doc(db, 'socialAccounts', accountId));
      toast({
        title: 'Profile Disconnected',
        description: `${displayName} has been successfully disconnected.`,
      });
    } catch (err: unknown) {
      console.error('[ACCOUNTS:DELETE] Error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  // Triggers simulated login workflow
  const triggerConnect = (platform: string) => {
    const callbackUrl = `/api/auth/social/callback?platform=${platform}&state=simulated&workspaceId=${activeWorkspaceId}&orgId=${activeOrganizationId}`;
    window.location.href = callbackUrl;
  };

  const platforms = ['linkedin', 'facebook', 'instagram', 'x', 'youtube'] as const;

  return (
    <PageContainerFluid className="space-y-8 max-w-6xl mx-auto py-8">
      {/* Header: Title & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Connected Profiles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Authorize and manage connected social media profiles for your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1 px-3 font-semibold text-xs tracking-wider uppercase rounded-full">
            <Globe className="h-3 w-3 animate-spin" /> Simulated Dev Mode Active
          </Badge>
        </div>
      </div>

      {/* Info notice about mock mode */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-emerald-800 dark:text-emerald-300">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <span className="font-bold block">Developer Notice</span>
          <p>
            You are running in <strong>Dual Simulation Mode</strong>. Clicking "Connect Profile" will instantly simulate the OAuth response locally, generating mock profile tokens and populating simulated content streams.
          </p>
        </div>
      </div>

      {/* Main Grid: Connected Accounts & Connect Portal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connected Accounts Section */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            Active Integrations ({accounts.length})
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i} className="border border-border/30 rounded-2xl bg-card/50 backdrop-blur-md">
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border border-dashed border-border/40 rounded-3xl bg-card/20 backdrop-blur-sm p-12 text-center">
              <CardContent className="space-y-4">
                <div className="h-12 w-12 rounded-full bg-muted/40 mx-auto flex items-center justify-center text-muted-foreground">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">No accounts connected</h3>
                  <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                    Connect a mock platform on the right to start scheduling posts and receiving messages.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const Icon = iconMap[acc.platform] || Globe;
                const colors = colorMap[acc.platform] || { 
                  bg: 'bg-muted/10', 
                  border: 'border-border/10', 
                  text: 'text-foreground',
                  buttonBg: 'bg-primary text-primary-foreground',
                  buttonHover: 'hover:bg-muted'
                };

                return (
                  <Card 
                    key={acc.id} 
                    className={cn(
                      "border rounded-2xl transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden group bg-card/60 backdrop-blur-md",
                      colors.border
                    )}
                  >
                    {/* Brand glow overlay on hover */}
                    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none", acc.platform === 'linkedin' ? 'bg-indigo-500' : 'bg-emerald-500')} />
                    
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4 relative z-10">
                      <img 
                        src={acc.avatarUrl} 
                        alt={acc.displayName} 
                        className="h-12 w-12 rounded-xl object-cover border border-border/30 bg-muted shrink-0" 
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold truncate">{acc.displayName}</CardTitle>
                          <Badge variant="outline" className={cn("px-1.5 py-0 rounded text-[9px] uppercase font-bold shrink-0 tracking-wide", colors.bg, colors.text, colors.border)}>
                            {acc.platform}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs truncate font-medium mt-0.5">@{acc.username}</CardDescription>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex items-center justify-between pt-0 pb-4 relative z-10">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Connected</span>
                      </div>

                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl active:scale-[0.97] transition-all"
                        onClick={() => handleRemoveAccount(acc.id, acc.displayName)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Connect New Channels Portal */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Available Channels
          </h2>

          <Card className="border border-border/30 rounded-3xl bg-card/40 backdrop-blur-md overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold">Add Social Profile</CardTitle>
              <CardDescription className="text-xs">Select a channel to register it in simulated mode.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {platforms.map((platform) => {
                const Icon = iconMap[platform] || Globe;
                const colors = colorMap[platform] || { 
                  bg: 'bg-muted/10', 
                  border: 'border-border/10', 
                  text: 'text-foreground',
                  buttonBg: 'bg-primary text-primary-foreground',
                  buttonHover: 'hover:bg-muted'
                };

                const isConnected = accounts.some(a => a.platform === platform);

                return (
                  <Button 
                    key={platform}
                    variant="outline" 
                    className={cn(
                      "w-full justify-between h-12 rounded-xl hover:bg-muted/40 font-semibold text-xs tracking-wide active:scale-[0.97] transition-all",
                      isConnected && "opacity-60"
                    )}
                    onClick={() => triggerConnect(platform)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border", colors.border, colors.bg)}>
                        <Icon className={cn("h-4 w-4", colors.text)} />
                      </div>
                      <span className="capitalize">{platform}</span>
                    </div>
                    {isConnected ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainerFluid>
  );
}

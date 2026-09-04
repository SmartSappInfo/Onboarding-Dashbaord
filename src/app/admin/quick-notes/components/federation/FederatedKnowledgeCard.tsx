'use client';

import * as React from 'react';
import {
  Globe,
  Lock,
  Copy,
  Check,
  Building,
  Bookmark,
  Share2,
  Tag,
  Calendar,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  getKnowledgeSpaceAccessLevelMeta,
} from '@/lib/quick-notes-domain';
import type { FederatedKnowledgeItem } from '@/lib/quick-notes-types';

interface FederatedKnowledgeCardProps {
  item: FederatedKnowledgeItem;
  onCopyAsLocal?: (item: FederatedKnowledgeItem) => void;
  isCopying?: boolean;
}

export function FederatedKnowledgeCard({
  item,
  onCopyAsLocal,
  isCopying = false,
}: FederatedKnowledgeCardProps) {
  const { toast } = useToast();
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);

  const accessMeta = getKnowledgeSpaceAccessLevelMeta(item.accessLevel);

  const handleCopySnippet = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${item.title}\n\n${item.snippet}`);
    setCopiedSnippet(true);
    toast({ title: 'Note content copied to clipboard' });
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-border hover:shadow-md">
      {/* Top Header: Origin Workspace & Space */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Building className="h-3 w-3" />
              {item.sourceWorkspaceName || item.sourceWorkspaceId}
            </span>
            <span className="text-[11px] text-muted-foreground">in</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
              <Layers className="h-3 w-3 text-muted-foreground" />
              {item.sourceSpaceName}
            </span>
          </div>

          <Badge variant="outline" className={`text-[10px] font-medium ${accessMeta.badgeClass}`}>
            {accessMeta.label}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 tracking-tight group-hover:text-primary transition-colors">
          {item.title}
        </h4>

        {/* Snippet */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {item.snippet || 'No excerpt available for this federated record.'}
        </p>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5 opacity-60" />
                #{tag}
              </span>
            ))}
            {item.tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground font-medium">
                +{item.tags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Metadata & Actions */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
          {item.sourceAuthorName && (
            <>
              <span>•</span>
              <span className="truncate max-w-[100px]">{item.sourceAuthorName}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopySnippet}
            className="h-8 px-2 text-xs rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.97]"
            title="Copy snippet"
          >
            {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          {onCopyAsLocal && !item.isLocalCopy && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCopyAsLocal(item)}
              disabled={isCopying}
              className="h-8 px-2.5 text-xs font-semibold rounded-xl active:scale-[0.97] min-h-[32px] sm:min-h-[32px]"
            >
              <Bookmark className="h-3.5 w-3.5 mr-1 text-indigo-500" />
              Save to Workspace
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

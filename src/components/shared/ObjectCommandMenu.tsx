'use client';

/**
 * @fileOverview Universal Object Command Menu (Phase 8 Milestone 4 Task 6)
 *
 * Implements universal contextual action menu ("...") mounted on entity rows, cards, and headers:
 * - 6 Contextual intelligence commands + quick link to Global Context Rail
 * - Rule 4: Zero any / Zero any[] strict typing
 * - Rule 7: Accessible touch target >= 44px min-h-[44px]
 * - Rule 60: Emergency dead-man pause check and error feedback
 * - Rule 68 / §81: "No Dead Ends" navigation to target action URLs
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Sparkles,
  FileText,
  GitBranch,
  CheckSquare,
  Bot,
  Layers,
  PanelRightOpen,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { executeObjectCommandAction } from '@/app/actions/context-rail-actions';
import { useContextRail } from '@/components/context-rail/ContextRailContext';
import type { ObjectCommandType } from '@/platform/ui/context-rail';

export interface ObjectCommandMenuProps {
  entityId: string;
  entityType: 'contact' | 'lead' | 'deal' | 'company' | 'ticket' | 'task';
  entityName?: string;
  organizationId?: string;
  workspaceId?: string;
  className?: string;
  triggerVariant?: 'ghost' | 'outline' | 'secondary';
  align?: 'start' | 'center' | 'end';
  defaultOpen?: boolean;
}

export function ObjectCommandMenu({
  entityId,
  entityType,
  entityName,
  organizationId,
  workspaceId,
  className,
  triggerVariant = 'ghost',
  align = 'end',
  defaultOpen,
}: ObjectCommandMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { openRail } = useContextRail();
  const [isExecuting, setIsExecuting] = React.useState(false);

  const handleCommand = async (commandType: ObjectCommandType) => {
    setIsExecuting(true);
    try {
      const res = await executeObjectCommandAction({
        entityId,
        entityType,
        entityName,
        commandType,
        organizationId,
        workspaceId,
      });

      if (res.success && res.data) {
        toast({
          title: 'Action Triggered',
          description: res.data.message,
        });
        if (res.data.actionTargetUrl) {
          router.push(res.data.actionTargetUrl);
        }
      } else {
        const errorMsg = res.error?.message || 'Failed to execute command';
        toast({
          variant: 'destructive',
          title: 'Action Blocked',
          description: errorMsg,
        });
      }
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: err instanceof Error ? err.message : 'Unknown execution failure',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleOpenRail = () => {
    openRail(entityId, entityType);
  };

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="icon"
          disabled={isExecuting}
          data-testid="object-command-menu-trigger"
          aria-label={`Actions for ${entityName || entityId}`}
          className={`h-9 w-9 min-h-[44px] min-w-[44px] p-0 rounded-xl text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all ${
            className || ''
          }`}
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        data-testid="object-command-menu-content"
        className="w-56 p-1.5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl z-50 text-xs"
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Intelligence Commands
        </DropdownMenuLabel>

        {/* 1. Open Context Rail */}
        <DropdownMenuItem
          onClick={handleOpenRail}
          data-testid="command-item-open-rail"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <PanelRightOpen className="h-3.5 w-3.5 text-primary" />
          <span>Open Context Rail</span>
        </DropdownMenuItem>

        {/* 2. Ask AI */}
        <DropdownMenuItem
          onClick={() => handleCommand('ask_ai')}
          data-testid="command-item-ask-ai"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Ask SmartSapp AI</span>
        </DropdownMenuItem>

        {/* 3. Summarize */}
        <DropdownMenuItem
          onClick={() => handleCommand('summarize')}
          data-testid="command-item-summarize"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Generate Summary</span>
        </DropdownMenuItem>

        {/* 4. Find Related Mesh */}
        <DropdownMenuItem
          onClick={() => handleCommand('find_related')}
          data-testid="command-item-find-related"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span>View Relationship Mesh</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border/60" />

        <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Autonomous Actions
        </DropdownMenuLabel>

        {/* 5. Create Task */}
        <DropdownMenuItem
          onClick={() => handleCommand('create_task')}
          data-testid="command-item-create-task"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Create Follow-up Task</span>
        </DropdownMenuItem>

        {/* 6. Launch Agent Run */}
        <DropdownMenuItem
          onClick={() => handleCommand('launch_agent_run')}
          data-testid="command-item-launch-agent"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span>Launch Intelligence Run</span>
        </DropdownMenuItem>

        {/* 7. Add to Workflow */}
        <DropdownMenuItem
          onClick={() => handleCommand('add_to_workflow')}
          data-testid="command-item-add-workflow"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98] min-h-[36px]"
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Add to Workflow</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

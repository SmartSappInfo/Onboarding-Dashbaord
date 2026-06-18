/**
 * Decide what should happen when the interactive script view traverses onto a node via the
 * middle "Continue / choice" controls. Pure + framework-free so it can be unit-tested.
 *
 * - Outcome nodes auto-trigger (which completes the call) when an outcome handler is available.
 * - Action nodes auto-trigger their side effect when an action handler is available.
 * - Everything else (and builder/preview mode without handlers) just navigates.
 */
export type TraversalAction = 'trigger-outcome' | 'trigger-action' | 'navigate';

export function classifyTraversal(
  nodeType: string | undefined,
  opts: { hasOutcomeHandler: boolean; hasActionHandler: boolean }
): TraversalAction {
  if (nodeType === 'outcome' && opts.hasOutcomeHandler) return 'trigger-outcome';
  if (nodeType === 'action' && opts.hasActionHandler) return 'trigger-action';
  return 'navigate';
}

import type { Node, Edge } from 'reactflow';

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  legacyText: string;
}

/**
 * Pushes a new state onto the history stack, handling debouncing limits and diff checks.
 * Returns the new history array and the updated pointer.
 */
export function pushHistoryState(
  history: HistoryState[],
  pointer: number,
  newState: HistoryState
): { history: HistoryState[]; pointer: number } {
  // Truncate history stack beyond pointer (removes undone redo states)
  const currentHistory = history.slice(0, pointer + 1);
  
  const current = currentHistory[pointer];
  if (current) {
    // Check if anything actually changed
    const hasChanged = 
      JSON.stringify(current.nodes) !== JSON.stringify(newState.nodes) ||
      JSON.stringify(current.edges) !== JSON.stringify(newState.edges) ||
      current.legacyText !== newState.legacyText;
    if (!hasChanged) {
      return { history, pointer };
    }
  }

  // Deep clone state to avoid mutating references in the history stack
  const clonedState = JSON.parse(JSON.stringify(newState)) as HistoryState;
  currentHistory.push(clonedState);
  
  // Enforce a maximum history length of 50
  if (currentHistory.length > 50) {
    currentHistory.shift();
  }

  return {
    history: currentHistory,
    pointer: currentHistory.length - 1
  };
}

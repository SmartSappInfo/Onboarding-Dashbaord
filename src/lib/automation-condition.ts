type ConditionNodeLike = {
  data?: {
    config?: {
      field?: string;
      operator?: string;
      value?: unknown;
    };
  };
};

/**
 * Evaluates a condition node against the current context payload.
 */
export function evaluateConditionNode(
  node: ConditionNodeLike,
  payload: Record<string, unknown>
): boolean {
  const { field, operator, value } = node.data?.config || {};
  if (!field || !operator) return false;

  const actualValue = payload[field];
  const comparisonValue = value;

  switch (operator) {
    case 'equals':
      return String(actualValue) === String(comparisonValue);
    case 'not_equals':
      return String(actualValue) !== String(comparisonValue);
    case 'contains':
      return String(actualValue)
        .toLowerCase()
        .includes(String(comparisonValue).toLowerCase());
    case 'greater_than':
      return Number(actualValue) > Number(comparisonValue);
    case 'less_than':
      return Number(actualValue) < Number(comparisonValue);
    default:
      return false;
  }
}

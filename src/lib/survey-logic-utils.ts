import type { SurveyElement, SurveyQuestion } from './types';

/**
 * Pure utility function to update survey elements (logic rules, defaultValues, optionScores)
 * when a question option is renamed or removed.
 *
 * @param elements All current elements in the survey form.
 * @param questionId The ID of the question whose option is changing.
 * @param oldOptionValue The original text of the option.
 * @param newOptionValue The new text of the option, or null if the option is being deleted.
 */
export function syncElementsOnOptionChange(
  elements: SurveyElement[],
  questionId: string,
  oldOptionValue: string,
  newOptionValue: string | null
): SurveyElement[] {
  if (!elements) return [];

  return elements.map((element) => {
    // 1. If it's the question itself, we sync its defaultValue
    if (element.id === questionId && 'type' in element) {
      const question = element as SurveyQuestion;
      let newDefaultValue = question.defaultValue;

      if (question.allowOther) {
        // Compound default value structure: { options: string[], other: string }
        if (newDefaultValue && typeof newDefaultValue === 'object') {
          const currentOptions = Array.isArray(newDefaultValue.options) ? newDefaultValue.options : [];
          let updatedOptions = [...currentOptions];

          if (newOptionValue === null) {
            // Delete option from default values
            updatedOptions = updatedOptions.filter((opt) => opt !== oldOptionValue);
          } else {
            // Rename option in default values
            updatedOptions = updatedOptions.map((opt) =>
              opt === oldOptionValue ? newOptionValue : opt
            );
          }
          newDefaultValue = {
            ...newDefaultValue,
            options: updatedOptions,
          };
        }
      } else {
        // Standard default value (single string or string[])
        if (Array.isArray(newDefaultValue)) {
          if (newOptionValue === null) {
            newDefaultValue = newDefaultValue.filter((opt) => opt !== oldOptionValue);
          } else {
            newDefaultValue = newDefaultValue.map((opt) =>
              opt === oldOptionValue ? newOptionValue : opt
            );
          }
        } else if (newDefaultValue === oldOptionValue) {
          newDefaultValue = newOptionValue === null ? undefined : newOptionValue;
        }
      }

      return {
        ...question,
        defaultValue: newDefaultValue,
      } as SurveyElement;
    }

    // 2. If it's a logic node, we sync the rules targeting this source question
    if (element.type === 'logic' && 'rules' in element) {
      const logicBlock = element as any;
      const updatedRules = (logicBlock.rules || []).map((rule: any) => {
        if (rule.sourceQuestionId === questionId) {
          let updatedTargetValue = rule.targetValue;
          if (updatedTargetValue === oldOptionValue) {
            updatedTargetValue = newOptionValue === null ? '' : newOptionValue;
          }
          return {
            ...rule,
            targetValue: updatedTargetValue,
          };
        }
        return rule;
      });

      return {
        ...element,
        rules: updatedRules,
      } as any;
    }

    return element;
  });
}

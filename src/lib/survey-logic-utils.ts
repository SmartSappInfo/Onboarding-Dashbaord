import type { SurveyElement, SurveyQuestion, SurveyLogicBlock } from './types';

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
        if (newDefaultValue && typeof newDefaultValue === 'object' && 'options' in newDefaultValue) {
          const compound = newDefaultValue as { options?: unknown[]; other?: string };
          const currentOptions = Array.isArray(compound.options) 
            ? compound.options.filter((opt): opt is string => typeof opt === 'string') 
            : [];
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
            ...compound,
            options: updatedOptions,
          };
        }
      } else if (Array.isArray(newDefaultValue)) {
        if (newOptionValue === null) {
          newDefaultValue = newDefaultValue.filter((v: unknown) => v !== oldOptionValue);
        } else {
          newDefaultValue = newDefaultValue.map((v: unknown) => (v === oldOptionValue ? newOptionValue : v));
        }
      } else if (typeof newDefaultValue === 'string' && newDefaultValue === oldOptionValue) {
        newDefaultValue = newOptionValue === null ? '' : newOptionValue;
      }

      return {
        ...question,
        defaultValue: newDefaultValue,
      } as SurveyElement;
    }

    // 2. If it's a logic node, we sync the rules targeting this source question
    if (element.type === 'logic' && 'rules' in element) {
      const logicBlock = element as SurveyLogicBlock;
      const updatedRules = (logicBlock.rules || []).map((rule) => {
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
        ...logicBlock,
        rules: updatedRules,
      };
    }

    return element;
  });
}

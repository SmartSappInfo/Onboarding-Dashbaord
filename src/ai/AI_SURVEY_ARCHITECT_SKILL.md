# AI Survey Architect Skill

This document serves as the canonical instruction set for the AI Survey Architect engine. It defines the standards, patterns, and logic used to generate production-ready surveys.

## Core Principles

1.  **Immersive First**: Surveys should feel like a premium experience. Use high-quality headings, descriptions, and dividers.
2.  **Assessment-Ready**: Default to scoring if the intent is a quiz, risk assessment, or qualification.
3.  **Clean Data**: Use specific blocks (Email, Phone) instead of generic text for contact info to ensure validation.
4.  **Actionable Outcomes**: Don't just end with "Thank You". Provide meaningful result pages based on scoring.
5.  **Faithful Extraction**: Always extract EVERY option provided in the source material. Never summarize or omit options.
6.  **"Other" Option Logic**: If the source text lists "Other" as an option, handle it via the `allowOther` property instead of the options list.

## Blueprint Design Standards

When creating the initial survey structure (Blueprint Phase):
1.  **Section Identification**: Respect existing "SECTION X" or "PAGE X" markers in the source material.
2.  **Required Keys**: Every section MUST include:
    - `id`: Unique kebab-case identifier.
    - `title`: Full, descriptive title.
    - `stepperTitle`: Concise label for navigation (max 15 chars).
    - `estimatedQuestions`: Numeric count of expected questions.
3.  **Scoring Intent**: Decide early if the survey requires scoring. If `scoringEnabled` is true, the following phases must include point values and outcome pages.

## Block Selection Standards

| Question Intent | Preferred Type | Note |
| :--- | :--- | :--- |
| Personal/Entity Name | `text` | Default to `isRequired: false`. |
| Contact Email | `email` | Always use `email` for built-in validation. |
| Contact Phone | `phone` | Always use `phone` for built-in validation. |
| Narrative Feedback | `long-text` | |
| Binary Choice | `yes-no` | Answers are strictly "Yes" or "No". |
| Single Selection | `multiple-choice` | Set `allowOther: true` if the list isn't exhaustive. |
| Multi Selection | `checkboxes` | Set `allowOther: true` for "Other" field. |
| Large Selection List | `dropdown` | Use for 5+ options. |
| Subjective Rating | `rating` | Scale is 1-5 stars. |
| Date/Time | `date` / `time` | |

## Scoring & Logic Patterns

### Scoring Philosophy
- **Additive (Checkboxes)**: Each selection adds to the total. Good for risk factors.
- **Threshold (Radio)**: Single selection determines a bucket.
- **Max Score**: Always calculate the theoretical maximum score.

### Result Pages
- **Low Score/Normal**: Educational or "Thank You" focused.
- **High Score/Alert**: Urgent, specific instructions, and calls to action.
- **Call to Action**: Use `button` blocks on result pages to drive next steps.

### Notification Triggers
- Use `emailTemplateId` and `smsTemplateId` placeholders in `resultRules` for critical outcomes.
- High-priority outcomes should always suggest an automated follow-up.

## Layout & UX Guidelines

1.  **Sections**: Break surveys into 3-5 questions per section. 
2.  **Page Rendering**: Set `renderAsPage: true` on `section` blocks for a multi-step wizard feel.
3.  **Auto-Advance (STRICT)**: 
    - `autoAdvance` must be `false` for all questions by default.
    - EXCEPTION: You may ONLY set `autoAdvance: true` for the **last question** in a section IF and ONLY IF the following section has `renderAsPage: true`.
    - If the next section is NOT a new page, the previous question must NOT auto-advance.
4.  **Order Fidelity**: You MUST follow the exact sequence of questions provided in the source material. Never re-order unless explicitly requested.
5.  **Copy Fidelity**: For instructional or description blocks, follow the source copy EXACTLY. Do not summarize or rephrase unless there is a clear grammatical error.
6.  **Paragraph Preservation**: Respect all white spaces and carriage returns. Use `\n\n` to preserve paragraph breaks. Never consolidate multiple paragraphs into one.
7.  **Optionality**: Questions are OPTIONAL by default. Only mark as required if the source text explicitly uses the word "Required", an asterisk (*), or if it's a critical contact field. Never assume a question is required based on its perceived importance.

## JSON Schema Integrity

- **IDs**: kebab-case (e.g., `q_user_email`).
- **Types**: Strictly follow the Zod schemas. For example, logic blocks MUST have `type: "logic"`. Never use "conditional" or other synonyms.
- **Logic Targeting**: Every rule MUST specify a `targetElementId` or `targetElementIds`. Rules with empty targets are invalid.
- **Logic Placement**: Place logic blocks immediately following the source question they reference.
- **Options**: 2+ items for choice-based types.
- **Consistency**: Reference exact IDs in logic blocks and result rules.
- **JSON Wrapper Standard**: Always wrap the output in the required root key defined by the phase (e.g., Phase 2 MUST be wrapped in `{ "elements": [...] }`). Phase 3 MUST include the `maxScore` key at the root. NEVER return a naked array.

## Pattern Recognition Standards

To ensure faithful extraction from raw text:
- **Questions**: Identify lines starting with numbers (1., 2.) or ending in question marks.
- **Option Blocks**: Lines immediately following a question that lack numbering are usually options. These MUST be collected into the `options` array.
- **Non-Bulleted Options**: If a question is followed by several sentences or phrases without empty lines between them, and those sentences read like possible answers to the question, they are OPTIONS. You MUST extract them into the `options` array. DO NOT treat them as description text.
- **Strict Bullet Rule**: If you see a bulleted list (•, -, *) immediately following a question, those are ALWAYS options, NEVER a separate description block.
- **Other Field (MANDATORY)**: If the word "Other" appears as an option in the source text, you MUST set `allowOther: true` and REMOVE "Other" from the `options` array. Leaving `allowOther: false` when "Other" is in the source text is a critical error.
- **De-duplication**: If a line looks like an instruction (e.g., "1. Ice Breaker") and the next line is the question, merge them into a single title. Never generate two blocks for one logical question.
- **Empty Options**: A multiple-choice or checkbox question with zero options is a critical failure. Always verify that options were extracted.

## Best Practices Examples

### Example: Faithful Extraction
**Source Text:**
```
Q: What is your primary income source?
- Salary
- Business
- Susu/Contribution groups
- Support from others
- Other
```

**Correct AI JSON:**
```json
{
  "id": "q_primary_income",
  "type": "multiple-choice",
  "title": "What is your primary income source?",
  "options": ["Salary", "Business", "Susu/Contribution groups", "Support from others"],
  "allowOther": true
}
```
*Note: "Other" was removed from options and replaced with allowOther: true.*

### Example: Long-Form Options
**Source Text:**
```
Q: Which statement feels closest to your current situation?
• I run a business or trade and constantly manage money between stock, customers, and responsibilities
• I survive mostly on occasional jobs or daily hustle work where income is unpredictable
• I work regularly, but my income feels too small for my responsibilities and goals
```

**Correct AI JSON:**
```json
{
  "id": "q_current_situation",
  "type": "multiple-choice",
  "title": "Which statement feels closest to your current situation?",
  "options": [
    "I run a business or trade and constantly manage money between stock, customers, and responsibilities",
    "I survive mostly on occasional jobs or daily hustle work where income is unpredictable",
    "I work regularly, but my income feels too small for my responsibilities and goals"
  ]
}
```


### Example: Complete Logic Targeting
**Correct Logic Block:**
```json
{
  "id": "logic_referral_followup",
  "type": "logic",
  "rules": [
    {
      "sourceQuestionId": "q_is_referral",
      "operator": "isEqualTo",
      "targetValue": "Yes",
      "action": {
        "type": "show",
        "targetElementId": "q_referrer_name"
      }
    }
  ]
}
```
*Note: Both sourceQuestionId and targetElementId are fully populated with IDs from the elements list.*

### Example: Follow-up Logic (Negative Exclusion)
**Scenario:**
- Q1: How often do you travel? (Options: Daily, Weekly, Never)
- Q2: What is your favorite airline?

**Correct Logic:**
- Create a logic block for Q1 that says: **When** Q1 **Is** "Never", **Then** **Hide** Q2.
- This ensures users who don't travel aren't asked about airlines.

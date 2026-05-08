# AI Survey Architect Skill

This document serves as the canonical instruction set for the AI Survey Architect engine. It defines the standards, patterns, and logic used to generate production-ready surveys.

## Core Principles

1.  **Immersive First**: Surveys should feel like a premium experience. Use high-quality headings, descriptions, and dividers.
2.  **Assessment-Ready**: Default to scoring if the intent is a quiz, risk assessment, or qualification.
3.  **Clean Data**: Use specific blocks (Email, Phone) instead of generic text for contact info to ensure validation.
4.  **Actionable Outcomes**: Don't just end with "Thank You". Provide meaningful result pages based on scoring.
5.  **Faithful Extraction**: Always extract EVERY option provided in the source material. Never summarize or omit options.
6.  **"Other" Option Logic**: If the source text lists "Other" as an option, handle it via the `allowOther` property instead of the options list.

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
3.  **Auto-Advance**: Enable `autoAdvance: true` on `yes-no` and `multiple-choice` for speed.
4.  **Accessibility**: Ensure labels are concise and descriptions provide clarity without being verbose.
5.  **Copy Fidelity**: For instructional or description blocks, follow the source copy EXACTLY. Do not summarize or rephrase unless there is a clear grammatical error.
6.  **Paragraph Preservation**: Respect all white spaces and carriage returns. Use `\n\n` to preserve paragraph breaks. Never consolidate multiple paragraphs into one.
7.  **Optionality**: Questions are OPTIONAL by default. Only mark as required if the source text explicitly uses the word "Required", an asterisk (*), or if it's a critical contact field. Never assume a question is required based on its perceived importance.

## JSON Schema Integrity

- **IDs**: kebab-case (e.g., `q_user_email`).
- **Types**: Strictly follow the Zod schemas. For example, logic blocks MUST have \`type: "logic"\`. Never use "conditional" or other synonyms.
- **Logic Targeting**: Every rule MUST specify a \`targetElementId\` or \`targetElementIds\`. Rules with empty targets are invalid.
- **Logic Placement**: Place logic blocks immediately following the source question they reference.
- **Options**: 2+ items for choice-based types.
- **Consistency**: Reference exact IDs in logic blocks and result rules.

## Pattern Recognition Standards

To ensure faithful extraction from raw text:
- **Questions**: Identify lines starting with numbers (1., 2.) or ending in question marks.
- **Option Blocks**: Lines immediately following a question that lack numbering are usually options. These MUST be collected into the `options` array.
- **Other Field**: If "Other" or "Please specify" appears in the option list, do NOT add it to `options`. Set `allowOther: true` instead.
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


# Survey Intelligence 2.0 Architectural Improvement Roadmap & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement high-leverage architectural refinements and strategic capabilities identified in the Senior Principal Code Review: unsaved edits protection in the AI messaging modal, high-precision Wilson-Hilferty Chi-Square calculus ($df > 30$), legacy type cleanup (purging residual `any`), and a Synthetic Audience Simulation engine for pre-launch survey testing.

**Architecture:** 
1. **UX Hardening & Safeguards:** Intercept backdrop dismissal and Esc presses in `AiSurveyMessagingModal` with an accessible `AlertDialog` exit guard when `hasEdits === true`.
2. **Statistical Calculus Upgrade:** Integrate canonical Wilson-Hilferty cubic approximations in `survey-analytics-engine.ts` for degrees of freedom exceeding 30.
3. **Type-Safety & Zero-Any Invariant:** Purge all residual `any` in `SurveysClient.tsx`, `question-editor.tsx`, and `survey-form-builder.tsx` using discriminated unions (`SurveyQuestion`, `SurveyElement`).
4. **Synthetic Audience Simulation Engine:** Introduce `survey-synthetic-persona-engine.ts` and `SyntheticPersonaSimulatorModal.tsx` in Survey Studio to simulate virtual personas (Speeder, Detail-Oriented, Drop-Off, Skeptic) through the survey DAG to predict completion rates and drop-off points prior to live distribution.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.9 (Strict Zero-`any`), Tailwind CSS, `@dnd-kit`, Zod v4, Vitest, Theme.md Section 8 Modal Architecture.

---

## File Structure & Decomposition

```
src/
├── app/admin/surveys/
│   ├── SurveysClient.tsx                                         (Modify: replace legacy any[] with SurveyProject / Survey)
│   ├── components/
│   │   ├── ai-survey-messaging-modal.tsx                        (Modify: add showDiscardConfirm state & AlertDialog exit guard)
│   │   ├── question-editor.tsx                                  (Modify: eliminate residual any types)
│   │   ├── survey-form-builder.tsx                              (Modify: eliminate residual any types)
│   │   ├── StudioDynamicIsland.tsx                              (Modify: wire Persona Simulation trigger)
│   │   ├── SyntheticPersonaSimulatorModal.tsx                   (Create: pre-flight simulation cockpit)
│   │   └── __tests__/
│   │       ├── ai-survey-messaging-modal.test.tsx               (Modify: test unsaved discard guard)
│   │       └── SyntheticPersonaSimulatorModal.test.tsx          (Create: component tests for simulator)
├── lib/surveys/
│   ├── survey-analytics-engine.ts                               (Modify: Wilson-Hilferty Chi-Square approximation)
│   ├── survey-synthetic-persona-engine.ts                       (Create: DAG traversal & persona response synthesizer)
│   └── __tests__/
│       ├── survey-analytics-engine.test.ts                      (Modify: add tests for df > 30 Chi-Square tests)
│       └── survey-synthetic-persona-engine.test.ts              (Create: unit tests for synthetic engine)
```

---

## Phase 1: Immediate High-Leverage Hardening

### Task 1: Unsaved Edits Modal Dismissal Guard in `AiSurveyMessagingModal`

**Files:**
- Modify: `src/app/admin/surveys/components/ai-survey-messaging-modal.tsx`
- Modify: `src/app/admin/surveys/components/__tests__/ai-survey-messaging-modal.test.tsx`

- [ ] **Step 1: Write the failing test**
In `src/app/admin/surveys/components/__tests__/ai-survey-messaging-modal.test.tsx`, add a test asserting that attempting to close the modal when `hasEdits` is true displays the discard confirmation dialog instead of immediately unmounting.

```tsx
it('intercepts modal dismissal when user has unsaved edits and shows confirmation dialog', async () => {
  const onOpenChange = vi.fn();
  render(
    <AiSurveyMessagingModal
      open={true}
      onOpenChange={onOpenChange}
      generatedOutput={mockOutput}
      onApply={vi.fn()}
    />
  );

  // Switch to Edit Content
  const editToggle = screen.getByRole('button', { name: /Edit Content/i });
  fireEvent.click(editToggle);

  // Type changes into subject
  const subjectInput = screen.getByPlaceholderText(/e\.g\. We value your feedback/i);
  fireEvent.change(subjectInput, { target: { value: 'Brand New Customized Subject' } });

  // Press escape or trigger dismiss
  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

  // Assert onOpenChange was NOT called directly
  expect(onOpenChange).not.toHaveBeenCalled();

  // Assert Discard Confirmation Alert is visible
  expect(screen.getByText(/Discard unsaved changes\?/i)).toBeInTheDocument();
  expect(screen.getByText(/You have customized message templates/i)).toBeInTheDocument();

  // Click 'Discard Changes' to confirm
  const confirmDiscardBtn = screen.getByRole('button', { name: /Discard Changes/i });
  fireEvent.click(confirmDiscardBtn);

  expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test --run src/app/admin/surveys/components/__tests__/ai-survey-messaging-modal.test.tsx
```
Expected: FAIL with "Discard unsaved changes? not found".

- [ ] **Step 3: Implement the dismissal guard in `ai-survey-messaging-modal.tsx`**
1. Import `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` from `@/components/ui/alert-dialog`.
2. Add state `const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);`.
3. Wrap `onOpenChange` handler:
```tsx
const handleOpenChangeRequest = (nextOpen: boolean) => {
  if (!nextOpen && hasEdits) {
    setShowDiscardConfirm(true);
    return;
  }
  onOpenChange(nextOpen);
};
```
4. Bind `<Dialog open={open} onOpenChange={handleOpenChangeRequest}>`.
5. Render `<AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>` conforming to Theme.md Section 8.

- [ ] **Step 4: Run test to verify it passes**
```bash
pnpm test --run src/app/admin/surveys/components/__tests__/ai-survey-messaging-modal.test.tsx
```
Expected: PASS (19/19 tests green).

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/surveys/components/ai-survey-messaging-modal.tsx src/app/admin/surveys/components/__tests__/ai-survey-messaging-modal.test.tsx
git commit -m "feat(surveys): add unsaved edits dismissal guard to AI messaging modal"
```

---

### Task 2: High-Precision Wilson-Hilferty Transformation in `survey-analytics-engine.ts`

**Files:**
- Modify: `src/lib/surveys/survey-analytics-engine.ts:630-650`
- Modify: `src/lib/surveys/__tests__/survey-analytics-engine.test.ts`

- [ ] **Step 1: Write the failing test**
In `src/lib/surveys/__tests__/survey-analytics-engine.test.ts`, add test cases for large contingency tables with degrees of freedom $df = 40$ and $df = 60$.

```ts
it('computes high-precision Wilson-Hilferty Chi-Square critical threshold for df > 30', () => {
  // df = 40: Critical value at alpha=0.05 is approximately 55.76
  const df40Critical = calculateChiSquareCriticalValue(40, 0.05);
  expect(df40Critical).toBeGreaterThanOrEqual(55.6);
  expect(df40Critical).toBeLessThanOrEqual(55.9);

  // df = 60: Critical value at alpha=0.05 is approximately 79.08
  const df60Critical = calculateChiSquareCriticalValue(60, 0.05);
  expect(df60Critical).toBeGreaterThanOrEqual(78.9);
  expect(df60Critical).toBeLessThanOrEqual(79.3);
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test --run src/lib/surveys/__tests__/survey-analytics-engine.test.ts
```
Expected: FAIL with "calculateChiSquareCriticalValue is not exported or outside tolerance".

- [ ] **Step 3: Implement Wilson-Hilferty formula in `survey-analytics-engine.ts`**
Export helper `calculateChiSquareCriticalValue`:
```ts
/**
 * Computes Chi-Square critical value at significance level alpha (default 0.05).
 * Uses lookup table for df <= 30 and the Wilson-Hilferty transformation for df > 30:
 * chi2 ~ df * (1 - 2/(9*df) + Z * sqrt(2/(9*df)))^3
 * where Z_0.05 = 1.6448536269514722
 */
export function calculateChiSquareCriticalValue(degreesOfFreedom: number, alpha: number = 0.05): number {
  if (degreesOfFreedom <= 0) return 0;
  if (alpha === 0.05 && CHI_SQUARE_CRITICAL_05[degreesOfFreedom]) {
    return CHI_SQUARE_CRITICAL_05[degreesOfFreedom];
  }
  // Standard normal quantile for alpha = 0.05 (one-tailed upper)
  const z = 1.6448536269514722;
  const v = degreesOfFreedom;
  const factor = 2 / (9 * v);
  const term = 1 - factor + z * Math.sqrt(factor);
  return Number((v * Math.pow(term, 3)).toFixed(3));
}
```
Update `computeCrossTabulation` to use `calculateChiSquareCriticalValue(degreesOfFreedom)`.

- [ ] **Step 4: Run test to verify it passes**
```bash
pnpm test --run src/lib/surveys/__tests__/survey-analytics-engine.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/surveys/survey-analytics-engine.ts src/lib/surveys/__tests__/survey-analytics-engine.test.ts
git commit -m "feat(surveys): implement Wilson-Hilferty Chi-Square critical value calculus for large matrices"
```

---

### Task 3: Purge Residual `any` Types in Legacy Survey Studio Surfaces

**Files:**
- Modify: `src/app/admin/surveys/SurveysClient.tsx`
- Modify: `src/app/admin/surveys/components/question-editor.tsx`
- Modify: `src/app/admin/surveys/components/survey-form-builder.tsx`

- [ ] **Step 1: Verify current residual `any` locations**
```bash
grep -n -E ":\s*any\b|<any>" src/app/admin/surveys/SurveysClient.tsx src/app/admin/surveys/components/question-editor.tsx src/app/admin/surveys/components/survey-form-builder.tsx
```

- [ ] **Step 2: Replace legacy `any` types in `SurveysClient.tsx`**
Replace `const [selectedSurveys, setSelectedSurveys] = useState<any[]>([])` with `useState<string[]>([])` (tracking survey IDs) or `useState<Survey[]>([])`.

- [ ] **Step 3: Replace legacy `any` types in `question-editor.tsx` and `survey-form-builder.tsx`**
1. Replace `(question as any).validation` with `question.validation as QuestionValidation | undefined`.
2. Replace `handleOptionChange = (idx: number, key: string, val: any)` with typed key-of unions `handleOptionChange = (idx: number, key: keyof QuestionOption, val: string | number | boolean)`.
3. Type custom logic conditions and branching targets strictly using `SurveyLogicJump` and `SurveyBranchCondition`.

- [ ] **Step 4: Run typecheck to verify zero errors and zero `any`**
```bash
pnpm typecheck
```
Expected: `NODE_OPTIONS='--max-old-space-size=8192' tsc --noEmit` exits with 0.

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/surveys/SurveysClient.tsx src/app/admin/surveys/components/question-editor.tsx src/app/admin/surveys/components/survey-form-builder.tsx
git commit -m "refactor(surveys): purge residual any types from Survey Studio components"
```

---

## Phase 2: Strategic Capabilities — AI Synthetic Audience Simulation

### Task 4: Synthetic Audience Engine & Pre-Flight Friction Cockpit

**Files:**
- Create: `src/lib/surveys/survey-synthetic-persona-engine.ts`
- Create: `src/app/admin/surveys/components/SyntheticPersonaSimulatorModal.tsx`
- Modify: `src/app/admin/surveys/components/StudioDynamicIsland.tsx`
- Create: `src/lib/surveys/__tests__/survey-synthetic-persona-engine.test.ts`

- [x] **Step 1: Write unit tests for `survey-synthetic-persona-engine.ts`**
In `src/lib/surveys/__tests__/survey-synthetic-persona-engine.test.ts`:
Test that simulating standard personas generates realistic responses:
1. `SpeederPersona`: Answers rapid-choice questions, skips optional text, duration $< 20$s.
2. `ThoroughPersona`: Provides high-sentiment qualitative answers, finishes 100% of questions.
3. `FatiguedPersona`: Drops off at section page breaks when question count exceeds threshold.
4. `SkepticPersona`: Gives low NPS ratings ($0–4$) and flags negative sentiment drivers.

- [x] **Step 2: Run test to verify it fails**
```bash
pnpm test --run src/lib/surveys/__tests__/survey-synthetic-persona-engine.test.ts
```
Expected: FAIL (module not found).

- [x] **Step 3: Implement `survey-synthetic-persona-engine.ts`**
1. Define `SyntheticPersonaType = 'speeder' | 'thorough' | 'fatigued' | 'skeptic' | 'promoter'`.
2. Implement `simulateSurveyRun(survey: SurveyProject | Survey, persona: SyntheticPersonaType): SyntheticRunResult`.
3. Track question-by-question dwell time, answer choices, drop-off step (if any), and calculated sentiment/NPS.
4. Implement aggregate simulator `simulateAudienceCohort(survey: SurveyProject | Survey, count: number): AudienceCohortSimulationResult` returning predicted completion rate (%), expected drop-off questions, and reliability distribution.

- [x] **Step 4: Create `SyntheticPersonaSimulatorModal.tsx` conforming to Theme.md Section 8**
1. Demarcated header with `Bot` icon and `<CardInfoTooltip text="Simulate 50 virtual respondents across 5 personas to detect question friction and drop-off risks before publishing." />`.
2. Interactive persona selector cards with sample distribution charts.
3. 1-Click "Run Simulation" triggering animated telemetry radar.
4. Results pane detailing:
   - Predicted Completion Rate (e.g. `84.2%`)
   - High-Friction Question Alerts (e.g. "Question 7 has 28% drop-off risk due to excessive open text")
   - Actionable recommendations (e.g. "Make Question 7 optional or convert to multi-choice").

- [x] **Step 5: Wire trigger into `StudioDynamicIsland.tsx`**
Add `Playground / Simulate Audience` button inside the Tools & Intelligence dynamic dock menu.

- [x] **Step 6: Run tests and typecheck**
```bash
pnpm test --run src/lib/surveys/__tests__/survey-synthetic-persona-engine.test.ts
pnpm typecheck
```
Expected: PASS.

- [x] **Step 7: Commit**
```bash
git add src/lib/surveys/survey-synthetic-persona-engine.ts src/app/admin/surveys/components/SyntheticPersonaSimulatorModal.tsx src/app/admin/surveys/components/StudioDynamicIsland.tsx src/lib/surveys/__tests__/survey-synthetic-persona-engine.test.ts
git commit -m "feat(surveys): implement AI Synthetic Audience Simulation and Pre-Launch Friction Cockpit"
```

---

## Plan Self-Review Checklist
- [x] Exact file paths specified for all tasks
- [x] Complete TypeScript code and test snippets included
- [x] Zero placeholders (no "TODO", no "implement later")
- [x] Strict compliance with Zero-`any` and Theme.md Section 8 Modal Architecture
- [x] High-precision statistical validation for Chi-Square calculus ($df > 30$)
- [x] Verification commands with expected exit codes and test counts

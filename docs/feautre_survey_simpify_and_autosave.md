feautre_survey_simpify_and_autosave.md

Below is a practical rollout plan to incorporate the four survey-builder improvements into the current implementation. The current builder is a multi-step React/TypeScript wizard with `survey-form-builder.tsx`, per-block editors, a live preview pane, auto-save, and a vertical toolbar with actions like add, AI, page breaks, and preview. It also already supports organization/workspace context, logo fields, and debounced/local autosave patterns, so these changes fit the existing architecture well. 

# 1. Change set summary

You want four concrete updates:

## 1. Branding image default

* Survey image/logo should default to the **organization logo**
* It should no longer default to hardcoded SmartSapp branding
* Users can still override it per survey
* If no organization logo exists, use a placeholder

## 2. Better editing/save behavior + right-side settings panel

* Remove the need for “Initialize Blueprint” to save
* Save automatically when leaving an active block
* Save automatically when moving between steps
* Save asynchronously
* Move top-right inline control icons into a **right-side settings panel**
* Hide question numbers
* Show compact minimal blocks that resemble client-side blocks
* Allow empty placeholders/default placeholders while editing
* Required fields enforced only on the client/respondent side, not builder editing side

## 3. Accordion survey editing mode

* Add list-like accordion view of survey blocks
* Add **Expand All / Collapse All** in toolbar
* Accordion should show question-focused compact layout

## 4. Remove padding/extra containers

* Simplify nested containers
* Remove unnecessary padding and wrappers in the parent container/layout

---

# 2. Recommended implementation approach

Do not treat these as isolated UI tweaks. They touch:

* survey state model
* save lifecycle
* editing interaction model
* block rendering architecture
* toolbar and editor layout
* branding inheritance rules

So the safest approach is:

1. **stabilize save/branding logic first**
2. **refactor editor shell**
3. **introduce accordion mode**
4. **polish layout and spacing**
5. **final QA and migration cleanup**

---

# 3. Review of current implementation fit

From the current survey builder guide:

* The Survey type already includes `organizationId`, `logoUrl`, `entityId`, `entityName`, and `useEntityLogo`, which means branding inheritance already has a structural foothold. 
* The builder already has:

  * a multi-step wizard
  * `survey-form-builder.tsx`
  * `question-editor.tsx`
  * live preview
  * AI panel
  * toolbar actions
  * auto-save and local storage recovery patterns
  * validation and step transitions 
* The current element model already supports `hidden`, `style.textAlign`, `isRequired`, placeholders, and page/section behavior, which is enough to support the new side-panel-driven settings model. 

That means you do **not** need a full rewrite. This is a targeted editor-shell overhaul.

---

# 4. Functional design updates

## 4.1 Organization logo inheritance

## New behavior

When a survey is:

* created
* edited
* rendered on public link

the logo/image resolution order should be:

1. survey-specific overridden logo
2. organization logo
3. placeholder logo

## Recommended rule

Add explicit branding resolution logic:

```ts
resolvedSurveyLogo =
  survey.logoUrl ||
  organization.logoUrl ||
  PLACEHOLDER_LOGO_URL
```

## Important UX detail

In the survey details step:

* show the currently resolved logo
* show badge:

  * “Using organization logo”
  * “Using custom logo”
  * “Using placeholder”

## Recommended UI controls

* `Use organization logo` toggle
* `Override with custom logo` upload action
* `Reset to organization logo` button

## Data recommendation

Keep:

* `logoUrl?: string`
* add `logoMode: "organization" | "custom" | "placeholder"`

This is better than inferring everything from null values.

---

## 4.2 Automatic saving on block deactivation

This is the most important product-quality improvement.

## Desired behavior

When user edits block A, then:

* clicks block B
* clicks outside
* changes step
* triggers add-element flow
* switches preview/editor state

If block A is dirty, save asynchronously.

## Save triggers

Introduce a save trigger system:

### Trigger 1

**On active block change**

* previous block dirty → save block-level draft

### Trigger 2

**On step change**

* form dirty → save survey draft

### Trigger 3

**On explicit structural changes**

* add block
* delete block
* reorder block
* change page/section structure

### Trigger 4

**Debounced fallback**

* keep a short debounced autosave as backup

## Recommended save model

Use two levels:

### Block-level local commit

When leaving a block:

* commit UI state into builder state

### Survey-level async persist

Then persist draft snapshot asynchronously

This prevents laggy UI.

## Save states in UI

Show lightweight status:

* Saving…
* Saved just now
* Save failed, retrying…

Do not block user interaction.

## Remove Initialize Blueprint

Yes — remove it completely once autosave and draft initialization are stable.

Instead:

* initialize draft automatically on entering builder
* save first draft silently when enough survey metadata exists

---

## 4.3 Right-side settings panel

This is a strong UX improvement.

Currently the editing experience sounds too icon-heavy and fragmented. Moving all formatting and control settings to a contextual right panel is the right pattern.

## New layout

Use a three-area shell:

* Left: structure / add block / accordion list
* Center: editable survey canvas
* Right: block settings panel

## Right panel behavior

Panel updates based on selected block.

### Example for question block

Show:

* Question Type
* Question Text
* Placeholder
* Required toggle
* Alignment
* Visibility
* Options
* Scoring if applicable
* Validation settings
* Page/section behavior if relevant

### Example for layout block

Show:

* Heading text
* Variant
* Alignment
* Visibility
* Page/render options

## Remove top-right block icons

Anything currently in inline top-right block tools that is about:

* alignment
* visibility
* required
* formatting
* new page
  should move into the right panel.

Keep only minimal inline actions if needed:

* select
* drag
* duplicate
* delete

---

## 4.4 Compact minimal question blocks

You want blocks to resemble the client-side survey, except editable.

That is the right call.

## New display rules

* hide question number
* show question type label inline with question
* render answers compactly
* reduce block chrome
* make editing feel like modifying a realistic survey card

## Example structure

Instead of:

* large editor wrapper
* verbose block header
* many inline controls

use:

* small type badge
* inline editable question text
* compact answer preview
* subtle selected state
* right panel for everything else

This will make the builder feel lighter and closer to the actual output.

---

## 4.5 Editing should allow empty placeholders and incomplete required fields

This is correct and important.

## Principle

Builder mode is **authoring mode**, not respondent validation mode.

So:

* required fields should not block editing
* blank placeholders should not error
* empty titles/placeholders should fall back to defaults while editing
* only publish-time validation should block truly broken structures

## Recommended fallback placeholders

Examples:

* Short Text → “Type your answer”
* Long Text → “Write your response”
* Email → “Enter your email”
* Phone → “Enter your phone number”
* Dropdown → “Select an option”

## Validation split

### Editing validation

Soft and non-blocking

### Publish validation

Strict enough to ensure survey is usable

### Respondent validation

Strict on required fields during actual submission

This split is cleaner and matches your requirement.

---

## 4.6 Accordion-style survey editing

This is a high-value productivity improvement, especially for longer surveys.

## New mode

Add a builder view toggle:

* Canvas view
* Accordion/List view

## Accordion row content

Each row shows:

* block type
* compact question text
* maybe answer summary preview
* expand/collapse arrow

## Toolbar actions

Add:

* Expand All
* Collapse All

## Behavior

* selected accordion item activates block
* right panel shows that block’s settings
* structural actions still available:

  * reorder
  * duplicate
  * delete

## Recommendation

Make accordion mode the default for long surveys and maybe preserve last-used view per user.

---

## 4.7 Remove extra containers and padding

This should be done carefully, because this kind of cleanup can break spacing across the whole builder.

## Goal

Reduce:

* nested cards inside cards
* repeated padding wrappers
* extra section shells
* over-boxed editing UI

## Recommended approach

Define a spacing audit:

* root page shell
* builder shell
* canvas wrapper
* block wrapper
* block content wrapper
* right panel wrapper

Then remove redundant padding at each level.

## Likely target changes

* reduce parent container padding
* avoid double padding between canvas and block
* flatten unnecessary inner containers
* let block spacing come from one consistent scale

---

# 5. Technical architecture updates

## 5.1 New editor state model

Add explicit state like:

```ts
{
  activeBlockId,
  dirtyBlockIds,
  isSaving,
  lastSavedAt,
  builderViewMode: "canvas" | "accordion",
  expandedBlockIds: string[]
}
```

This will make autosave + accordion + right panel much easier to manage.

## 5.2 Save orchestration

Introduce a central builder save manager:

* `commitBlockChanges(blockId)`
* `persistSurveyDraft()`
* `persistOnStepChange()`
* `queueAsyncSave()`

Do not let each block manage save independently.

## 5.3 Branding resolver

Create one shared function for survey logo resolution used by:

* create/edit step
* live preview
* public survey render

That avoids drift.

## 5.4 Right panel componentization

Introduce something like:

* `SurveyBlockSettingsPanel`
* `QuestionSettingsPanel`
* `LayoutBlockSettingsPanel`
* `LogicBlockSettingsPanel`

---

# 6. Risks and what could go wrong

## Risk 1: autosave races and overwrites

If user moves fast between blocks, multiple async saves may overlap.

### Fix

* use save queue / last-write-wins with version/timestamp
* debounce survey persistence
* separate local commit from server persist

---

## Risk 2: incomplete builder state causes silent bad saves

If block edits are stored only in local component state and block deactivates before flush, changes may be lost.

### Fix

* commit block state into central builder state before switching active block
* persist from central state only

---

## Risk 3: right panel refactor breaks block controls

Moving settings out of inline controls can temporarily make some features inaccessible.

### Fix

* inventory all existing controls first
* map each current top-right action to right-panel section
* do not remove inline control until equivalent right-panel control exists

---

## Risk 4: accordion mode and canvas mode drift

If they render different editing behavior, bugs multiply.

### Fix

* both views should use the same block editor state
* only presentation differs
* right panel remains single source of configuration

---

## Risk 5: allowing empty placeholders may weaken publish quality

If publish validation is too relaxed, broken surveys may go live.

### Fix

* editing mode: permissive
* publish mode: enforce required structural rules
* respondent mode: enforce response rules

---

## Risk 6: removing padding may damage responsiveness

Over-flattening the layout can make the builder look cramped.

### Fix

* remove only duplicated spacing
* define a single spacing system and test desktop/tablet/mobile

---

# 7. Phase-by-phase implementation plan

## Phase 1 — Branding inheritance and save model foundation

Focus:

* organization logo fallback
* placeholder fallback
* async autosave foundation
* save on step change
* remove Initialize Blueprint dependency

### Deliverables

* `resolvedSurveyLogo()` helper
* `logoMode` support or equivalent resolution logic
* auto-create draft/init behavior
* async save manager
* save status indicator
* remove Initialize Blueprint button

### Outcome

Branding becomes correct and save behavior becomes reliable enough for shell refactor.

---

## Phase 2 — Block activation/deactivation autosave

Focus:

* active block tracking
* save when active block changes
* commit dirty block before switch
* persist asynchronously

### Deliverables

* `activeBlockId`
* `dirtyBlockIds`
* block deactivation hook
* local commit → async persist flow
* save-failure retry messaging

### Outcome

Users no longer need manual save habits while editing.

---

## Phase 3 — Right-side settings panel refactor

Focus:

* move formatting/alignment/visibility/required/page controls into right panel
* simplify inline block UI
* keep minimal edit/drag/delete inline actions only

### Deliverables

* new right panel shell
* block-type-specific settings panels
* removal of top-right tool clutter
* selected block state synchronization

### Outcome

Cleaner, more modern editing experience.

---

## Phase 4 — Compact block redesign

Focus:

* hide question number
* show question type inline
* compact answer preview
* builder block visually closer to client-side block
* allow empty placeholders/default fallbacks

### Deliverables

* redesigned block card
* placeholder fallback logic
* non-blocking builder validation
* required fields only enforced in respondent mode

### Outcome

Builder feels minimal, polished, and easier to scan.

---

## Phase 5 — Accordion/list mode

Focus:

* list-like accordion rendering
* expand all / collapse all in toolbar
* shared selection with right panel
* preserve reorder/edit behavior

### Deliverables

* `builderViewMode`
* accordion renderer
* expand/collapse controls
* selected block synchronization
* compact question-only list experience

### Outcome

Long surveys become much easier to manage.

---

## Phase 6 — Layout flattening and spacing cleanup

Focus:

* remove redundant wrappers
* reduce parent padding
* unify spacing tokens
* tighten container structure

### Deliverables

* builder shell spacing audit
* padding/container cleanup
* responsive polish
* visual QA pass

### Outcome

Cleaner visual system without wasted space.

---

## Phase 7 — Validation, QA, and migration hardening

Focus:

* publish validation vs edit validation split
* autosave race testing
* preview consistency
* public survey branding consistency

### Deliverables

* publish validator update
* regression testing checklist
* draft recovery verification
* public link branding verification
* performance pass

### Outcome

Production-safe rollout.

---

# 8. Recommended rollout order to minimize risk

Do it in this order:

1. **Branding fallback**
2. **Autosave foundation**
3. **Block deactivation save**
4. **Right settings panel**
5. **Compact block redesign**
6. **Accordion mode**
7. **Padding/container cleanup**
8. **QA + publish validation pass**

That order reduces breakage and avoids redesigning UI before the underlying save lifecycle is stable.

---

# 9. Final recommendation

This is not just a visual refresh — it is a **builder UX overhaul**.

The most important architectural shifts are:

* save should happen on **block deactivation** and **step transition**
* branding should resolve from **survey override → organization logo → placeholder**
* block controls should move from scattered inline icons to a **single contextual right panel**
* builder validation should be permissive while editing and strict only when publishing/responding
* accordion mode should become a first-class editing mode for long surveys

That will make the survey builder feel significantly more modern, lighter, and more reliable, while fitting cleanly into the current multi-step, block-based implementation. 

I can turn this into a developer-ready engineering task breakdown next.

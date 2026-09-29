# Phase 1 · §1.1a — Review Fixes (Round 4, items 1–6)

**Status: IMPLEMENTED 2026-09-28 (items 1–6; uncommitted). Outstanding: staging smoke run of §2, then an approved deploy of the `content_items` rule AFTER the app release. Decisions locked 2026-09-27 — R4-D1 = A (keep plan-only gating), R4-D2 = A (close fully incl. Firestore rule, separate approved deploy), R4-D3 = A (bind targeted invites to verified email). Awaiting go-ahead to implement.**
Parent: [agents_mcp_phase_1_plan.md](./agents_mcp_phase_1_plan.md) §1.1a.
Source: the Round 4 senior review. Every finding below was re-checked against the code before this plan was written.

## 0. Guiding rules

- **Preserve core behaviour.** Every flow in §2 must still work after each item lands. Where a fix changes what users see, the change is named explicitly in the item's "Behaviour change" line.
- **Fix at the service layer, not only the action.** Actions are one caller; services are also called by commerce, automations and (in Phase 1.5) the capability gateway. A rule enforced only in an action will be bypassed by the next caller.
- **Test first.** For each item:
  1. write a failing test that reproduces the exploit;
  2. write a test that proves the legitimate flow still works;
  3. then fix.
  Tests use an in-memory Firestore, and the record checks are real (`assertRecordInPortal` is not mocked), so removing a guard makes a test fail.
- Project rules still apply: no `any`, no unchecked casts, `unknown` only at boundaries and validated with Zod, guidance comments in code, and no duplicated helpers.
- No commits and no deploys without explicit approval. Item 4 includes a Firestore rules change, which is a production deployment step.

## 1. Decisions needed

| # | Question | Options | Recommendation |
|---|---|---|---|
| **R4-D1** | A course that has no `requiredPlanIds` but is also sold inside a paid offer. Should self-enrolment be blocked? | **A.** No. Keep today's rule: the course page only gates by plan. Admins who want a course to be purchase-only set `requiredPlanIds`, or leave it unpublished outside the offer. **B.** Yes. Block self-enrolment when an active offer with `price > 0` grants the course, unless the member has a completed order or a grant. | **A.** B changes live behaviour for every course bundled into an offer, and the course page has no "buy" state for it. Add an admin warning in the Monetization manager as a follow-up. |
| **R4-D2** | Gated content is readable by anyone through Firestore (`firestore.rules:2401`: `allow get, list: if true`), and the reader page loads full items in the browser. | **A.** Close it fully. Serve portal content through new server actions that sanitise gated items. Move the three portal readers (catalog, member dashboard, reader and its sibling list) onto them. Then restrict the rule to staff (`isAuthorized()`). The rule deploys after the app. **B.** Sanitise the server actions only, and track the Firestore leak as a named follow-up. | **A.** B leaves the paywall bypassable with a single client SDK call. A needs no data migration, but the deployment order matters (§4). |
| **R4-D3** | An invitation addressed to an email (`invitation.email` set). Should it only be accepted by that email? | **A.** Yes (case-insensitive; the token's email must be verified). **B.** No. Any holder of the link can accept it. | **A.** A targeted invite can carry an elevated role (`admin`, `instructor`). Shareable links (no `email`) are unaffected. |

## 2. Core flows that must keep working (regression checklist)

Each of these gets an automated test where one doesn't exist yet, and is part of the staging smoke run.

| Area | Flow |
|---|---|
| Learning | A member self-enrols in a free published course. A member with the right plan enrols in a plan-gated course. Staff can manually enrol. Checkout provisioning still enrols buyers (source `purchase`). |
| Learning | An enrolled member completes lessons in order, and the certificate is issued at 100%. A non-enrolled member can open and complete a **preview** lesson. The quiz-pass rule still applies. |
| Community | A member posts, comments, reacts and votes in public and members-only spaces. Cohort members post in their cohort's linked `private_cohort` space. Staff moderate, pin and lock. Authors edit and delete their own posts. |
| Content | Anonymous visitors read public items. Members read members-only items. Gated items show the configured teaser (`teaserMode`) plus an upgrade prompt. Staff see everything, drafts included, in `/admin/portals`. |
| Tasks | Creating and updating tasks from `/admin/tasks`, deals, entities, the dashboard, quick notes, the MCP `task.create` tool, call-centre outcomes, form submissions and automations. Bulk update and delete. |
| Invitations | Joining through a shareable invite link, and through a targeted invite by its recipient. An existing member opening an invite link. |

## 3. Items

### Item 1 — Self-enrolment bypasses plan gating (Blocker) — ✅ DONE

> Implementation note: `purchase` is treated as an explicit grant (no plan gate) alongside `manual_admin`. Checkout enrols buyers *before* it applies the offer's plan, so gating purchases silently dropped paid enrolments (a pre-existing bug).

- **Finding.** `enrollInCourseAction` passes source `'manual_admin'` ([learning-actions.ts:256](../../../src/app/actions/learning-actions.ts)). The service skips the `requiredPlanIds` check for that source ([enrollment-service.ts:54](../../../src/lib/services/enrollment-service.ts)). Unpublished courses are also enrollable.
- **Fix.**
  1. Add `'self_enroll'` to `EnrollmentSource` (`src/lib/types/learning.ts`), and update any UI label maps that switch on the source.
  2. In `EnrollmentService.enrollUserInCourse`, make the checks explicit by source:
     - `self_enroll`: course `status === 'published'`, the course is in the given portal, and the plan check runs. This mirrors the course page's `isPlanEntitled` rule.
     - `manual_admin`: skips the plan check, so staff override stays.
     - `purchase` / `membership_plan` / `invitation` / `automation`: plan check as today.
  3. `enrollInCourseAction` passes `'self_enroll'`. Portal staff calling it as members (preview) use `'manual_admin'` only when `isPortalStaff` is true.
- **Behaviour change.** A member without the required plan gets the existing upgrade message instead of a silent enrolment. Draft courses can't be enrolled in. With R4-D1 = A, nothing else changes.
- **Tests.**
  - Exploit: a member without the plan is refused, and enrolment in a draft course is refused.
  - Preserve: free-course self-enrolment works, a plan holder can enrol, staff `manual_admin` bypass works, and commerce `purchase` provisioning works.

### Item 2 — Lesson and course binding on progress (Major) — ✅ DONE

> Implementation note: the check lives in `LearningProgressService.assertLessonTrackable`, so event-attendance auto-completion (`event-service.ts`) is covered too. It stays non-blocking there.

- **Finding.** `completeLessonAction` and `recordVideoProgressAction` never check that the lesson belongs to `courseId`, or that the caller is enrolled. Progress is keyed by `courseId`, so lessons from other courses count toward course X's completion and certificate.
- **Fix (in `LearningProgressService`, so every caller is covered):**
  1. Add a private helper `loadLessonForCourse(lessonId, courseId)`. It reads the lesson and throws `Lesson not found in this course.` unless `lesson.courseId === courseId`. Use it in `completeLesson`, `recordVideoProgress` and `evaluateAssessmentSubmission`. The assessment path writes `assessmentPassed` on the same progress key, so it needs the same binding.
  2. `completeLesson` / `recordVideoProgress` require an active enrolment **unless** `lesson.isPreview` is true. The player lets non-enrolled members open preview lessons ([PortalCoursePlayerClient.tsx:536](../../../src/app/portal/%5Bslug%5D/learn/%5BcourseSlug%5D/%5BlessonSlug%5D/PortalCoursePlayerClient.tsx)). A preview completion without an enrolment records progress but never issues a certificate; that part is already true today.
  3. The action keeps `assertRecordInPortal('courses', courseId, portalId)`. Add it where only the lesson was checked.
- **Behaviour change.** None for legitimate learners.
- **Tests.**
  - Exploit: a lesson from course Y is refused for course X. A non-preview lesson is refused without an enrolment. A foreign lesson can't set `assessmentPassed`.
  - Preserve: completing lessons in order reaches 100% and issues the certificate. A preview lesson can be completed without an enrolment.

### Item 3 — Community author spoofing, space gating, pin/lock (Major) — ✅ DONE

> Implementation notes:
> - Staff without a membership are named from their email prefix, with role `admin`. This avoids an extra profile read.
> - `CommunityService.updatePost` spreads its input into the stored document, so author edits are picked field-by-field at runtime (`editablePostFields`), not just narrowed by type. This also blocks injecting `authorId`, `portalId` or counters through an edit.

- **Findings.**
  - `authorName`, `authorAvatarUrl` and `authorRole` come from the caller ([PortalCommunityClient.tsx:204-206](../../../src/app/portal/%5Bslug%5D/community/PortalCommunityClient.tsx)).
  - Space visibility is not enforced when posting, commenting or reacting.
  - Authors can send `isPinned` and `isLocked` through `updatePostAction`.
- **Fix.**
  1. **Server-side author identity.** Add a `resolveCommunityAuthor(member, portal)` helper in `community-actions.ts`:
     - Members: `displayName`, `avatarUrl` and `role` come from their `PortalMembership`.
     - Staff without a membership: name comes from the verified staff profile, and the role is `'admin'`.
     - Remove `authorName`, `authorAvatarUrl` and `authorRole` from the create inputs of the post and comment actions. The client call sites stop sending them, and the compiler finds each one.
  2. **Space entitlement.** Add `CommunityService.canUserPostInSpace(space, member)`:
     - `public` / `members_only`: allowed.
     - `plan_gated`: allowed when the member's plan is in `allowedPlanIds`, or `allowedPlanIds` is empty (same as `isUserEntitledToSpace`).
     - `private_cohort`: allowed when the user is in `cohort_members` of a cohort whose `linkedSpaceId` is this space, or their role is in `allowedRoleIds`.
     - Portal staff and membership roles `owner` / `admin` / `moderator`: always allowed.

     The existing `isUserEntitledToSpace` is extended rather than duplicated. Its `private_cohort` branch currently denies everyone except admins, which would break cohort discussions.

     The check is applied in `createPostAction` and `createCommentAction`. The comment path uses the **post's** stored `spaceId`, and the post must be in the space the caller claims. It is also applied in `toggleReactionAction` and `castPollVoteAction`, resolving the space from the target post or comment.
  3. **Pin/lock.** `updatePostAction` keeps an author allowlist: `title`, `content`, `type`, `mediaUrls`, `tags`, `blocks`, `lessonId`, `courseId`. `isPinned` and `isLocked` are dropped unless the caller is portal staff. Pinning and locking stay on `togglePinPostAction` and the moderation actions (staff-only).
- **Behaviour change.**
  - Posts show the member's portal profile name and avatar, which members can edit in the profile modal, instead of their Firebase account name.
  - Members without the required plan or cohort get a clear error when posting in a gated space. The space already shows a gated badge.
- **Tests.**
  - Exploit: an `authorRole: 'admin'` sent by a member is ignored. Posting to a plan-gated space without the plan is refused, and so is posting to a `private_cohort` space as a non-cohort member. A comment with a mismatched space and post is refused. An author can't set `isPinned`.
  - Preserve: public and members-only posting works, a cohort member can post in the linked space, staff can pin and lock, and an author can edit their own content.

### Item 4 — Gated content readable without entitlement (Major) — ✅ DONE (code). The Firestore rule is edited locally, **not deployed**.

> Implementation notes:
> - The sanitiser also trimmed too little. The reader shows `content` (body text) and embeds `media.videoUrl`, and neither was trimmed for gated items. It now keeps only the first paragraph of `content`, keeps only `thumbnailUrl` from `media`, and drops `pageDocumentId`.
> - The reader's slug lookup had no status filter, so drafts were readable by URL. Non-staff now get published items only.
> - `listContentItemsByPortalAction` and `searchPortalContentAction` take the member token as a **trailing optional** argument, so existing `(portalId, …)` callers didn't shift. `resolvePortalViewer` (in `require-portal-access.ts`) replaced the duplicated `resolveViewer`. `evaluateContentItemAccess` accepts a preloaded membership and grants, so a 50-item list costs 2 reads instead of about 100.
> - The catalog, member dashboard and reader load content on page open instead of via live Firestore listeners. Content rarely changes mid-visit.
> - Rules test `content-items-paywall.rules.test.ts` passes in the emulator (`pnpm test:rules:ci`; the local `test:rules` needs Java 21). It was mutation-checked: restoring `if true` fails 2 of its 3 tests.
> - Checked in the browser against the running dev server: the `/portal/academy/content` catalog and a free article render through the server path, with no app console errors.

- **Findings.**
  - The public list, search and slug actions return full `blocks` for gated items.
  - The Firestore rule lets anyone read every `content_items` document.
  - The reader, member dashboard and catalog query Firestore directly.
  - `evaluateContentAccessAction` accepts a `ContentItem` supplied by the caller and has no callers.
- **Fix (R4-D2 = A):**
  1. **One server read path.** Add `readContentForViewer(item[], viewer)` in `content-actions.ts`. It reuses the existing `resolveViewer` logic, moved into `require-portal-access.ts` so it isn't duplicated. It runs `EntitlementService.evaluateContentItemAccess` and `sanitizeContentItemForVisitor` for each item and returns `{ item, access }`.
  2. New or changed actions, all taking `idToken: string | null`:
     - `listContentItemsByPortalAction`: staff get items as today; everyone else gets published, sanitised items.
     - `searchPortalContentAction`: same rule, applied to the matched items.
     - `getContentItemForViewerAction(idToken, portalId, type, slug)`: replaces the reader's direct query. It returns the sanitised item plus the access result that drives the existing upgrade UI.
     - `listRelatedContentAction(idToken, portalId, type, excludeId)`: replaces the reader's "siblings" query.
  3. Move the three portal readers onto these actions:
     - `PortalContentReaderClient` (two queries);
     - `PortalMemberDashboardClient` (one query);
     - `PortalContentCatalogClient` (its remaining direct query).

     The reader keeps its client-side access UI, but its input now comes from the server's `access` result, so the display and the data can't disagree.
  4. Delete `evaluateContentAccessAction` (no callers; unsafe signature).
  5. **Firestore rule (a separate, approved deploy):** change `content_items` to `allow get, list: if isAuthorized();`. Staff admin screens (`PortalContentManager`) are unaffected because staff are `isAuthorized`.
- **Deployment order (important).** Ship the app first, then deploy the rule. Deploying the rule first would break the current reader for visitors until the new app version is live. Rollback works the other way round: revert the rule first.
- **Behaviour change.** None visible. Gated items already show a teaser and an upgrade prompt; now the full body simply never reaches the browser.
- **Tests.**
  - Exploit: an anonymous list or search returns teaser-only blocks and no download URLs for a plan-gated item, and anonymous callers get no drafts.
  - Preserve: public items are returned in full. A member with the plan gets the full body. Staff get drafts and full bodies.
  - A rules unit test with the Firestore emulator, if one is already configured. Otherwise the rule is checked in the staging smoke run.

### Item 5 — Task organization is caller-chosen; `/api/tasks` body not validated (Major) — ✅ DONE

- **Findings.**
  - `createTaskCore` trusts `taskData.organizationId`.
  - `updateTaskCore` logs activity under `updates.organizationId`.
  - `/api/tasks` spreads `...rest` from an unvalidated body.
  - The PATCH destructure strips `_entityId` and similar keys that never exist ([route.ts:40](../../../src/app/api/tasks/%5BtaskId%5D/route.ts)).
- **Fix.**
  1. In `task-core.ts`, add `resolveWorkspaceOrganizationId(workspaceId)`, which reads `workspaces/{id}.organizationId`.
     - `createTaskCore` and `createTaskFromAutomation` always write and log the workspace's organization.
     - If the workspace document is missing: `user` actors are refused (`requireWorkspace` would have refused already), and `system` actors keep the supplied value so automation tasks on legacy workspace ids still work.
  2. `updateTaskCore` reads the stored task once and logs `task_completed` with the stored `organizationId`, `workspaceId`, `entityId` and `entityType`. This replaces the caller's `updates.*` for those fields, and it's also more accurate for existing callers that send partial updates.
  3. `/api/tasks` POST: a Zod schema that allowlists the writable `Task` fields (every `Task` field except `id`, `createdAt`, `updatedAt`, `workspaceId` and `organizationId`). This replaces `...rest`. Unknown fields are dropped. Invalid types return 400.
  4. `/api/tasks/[taskId]` PATCH: a Zod partial of the same schema. `entityId`, `entityType`, `id`, `createdAt`, `workspaceId` and `organizationId` are removed, which matches the route's own stated rule ("preserve identifier fields, Requirement 3.2").
- **Behaviour change.**
  - Task activity always lands in the workspace's own organization feed.
  - PATCH through the REST API can no longer re-link a task's entity; the in-app `updateTaskAction` is unaffected.
  - Unknown body fields are dropped. The Zod schema will list every `Task` field so that no existing field is lost.
- **Tests.**
  - Exploit: creating a task with a foreign `organizationId` stores and logs the workspace's organization. A PATCH with `entityId` leaves the entity unchanged.
  - Preserve: the existing task suites stay green (workspace awareness, identifier preservation, call-centre, forms, MCP), and an automation on a missing workspace document still creates its task.

### Item 6 — Invitation acceptance (Minor, bundled here) — ✅ DONE

- **Findings.**
  - `contactId` comes from the caller (no UI sends it).
  - `maxUses` and `status` are not re-checked inside the transaction, so concurrent accepts over-redeem.
  - An existing member burns a use.
  - Targeted invites aren't bound to their email.
- **Fix.**
  1. Remove `contactId` from the `acceptInvitationAction` input type and from the service's `userProfile`. The membership links to a contact only through existing CRM flows.
  2. `PortalInvitationService.acceptInvitation`:
     - First, if the user already has a membership, return it without consuming a use.
     - Inside the transaction, re-read the invitation and refuse unless it is `status === 'pending'`, has `usedCount < maxUses`, and is not expired. Only then increment.
     - Create the membership after the transaction commits, as today.
  3. (R4-D3 = A) If `invitation.email` is set, the token email must match it, case-insensitive. Otherwise the error reads "This invitation was sent to a different email address."
     - **Adjusted during implementation to preserve a core flow.** `email_verified` is *not* required. The join page (`PortalJoinClient.handleManualJoin`) creates the account and accepts the invite straight away, before any verification email could be clicked, so requiring it would break joining by targeted invite. The invite token itself was delivered to that address.
     - The misleading "verified email" wording in `require-portal-access.ts` and `membership-actions.ts` is corrected.
- **Behaviour change.** A targeted invite can only be accepted by its recipient. Shareable links behave as before.
- **Tests.**
  - Exploit: two concurrent accepts on a `maxUses: 1` invite give exactly one success. Another email address can't accept a targeted invite. A caller-supplied `contactId` is ignored.
  - Preserve: a shareable link can be accepted repeatedly up to `maxUses`, the recipient can accept a targeted invite, and an existing member accepting consumes no use.

## 4. Sequencing

1. Items **5 → 6 → 1 → 2 → 3 → 4**, ordered from smallest blast radius to largest. Each item finishes with `tsc`, ESLint on the touched files, its own suite, and the related suites:
   - `src/app/actions`
   - `src/lib/services`
   - `src/lib/auth`
   - `src/app/portal`
   - `src/app/admin/portals`
   - `src/lib/__tests__`
2. After all six:
   - the full Vitest run and the agentic baseline;
   - a staging smoke run of §2;
   - update the Phase 1 plan's §1.1a table and follow-ups.
3. Firestore rule (item 4 step 5): proposed as a separate, explicitly approved deploy **after** the app release that contains item 4.

Out of scope here, tracked in the Round 4 list:
- the PR split (item 7);
- the export-sweep guard test;
- the D6 portal permission ids;
- `/api/mcp` org-header trust;
- the MCP `task.create` system bypass;
- the Phase 0 worker, secret and OIDC items.

## 5. Estimate

| Item | Size | Main risk |
|---|---|---|
| 5 | S | Zod allowlist missing a `Task` field used by an external API caller. Mitigation: derive it from the `Task` type and test every field. |
| 6 | S | Transaction semantics. Covered by a concurrency test. |
| 1 | S | Enrolment-source label maps in the UI. Found by grep and compiler exhaustiveness. |
| 2 | S–M | Preview-lesson completion. Covered by a preserve test. |
| 3 | M | Cohort-linked space access. Covered by a preserve test. Name display changes to the portal profile name. |
| 4 | M–L | Moving three readers onto server actions; rule deploy order. |

## 6. Verification (2026-09-28)

- `tsc` 0 errors. ESLint: 0 errors on the touched files.
- Full Vitest: 690 files and 5,233 tests pass, 0 failures. Agentic baseline: 444 pass. Firestore rules: 39 pass (emulator).
- New tests:
  - `task-core-tenant`
  - `tasks-api-validation`
  - `portal-invitation-accept` (with a concurrency case)
  - `enrollment-self-enroll`
  - `learning-actions-entitlement`
  - `learning-progress-binding`
  - `community-integrity` (uses the real `assertRecordInPortal`)
  - `content-viewer-access`
  - `content-items-paywall.rules`

  Each one failed before its fix.

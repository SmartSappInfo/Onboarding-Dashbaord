
# Feature: Drop-off Analytics (Survey Funnels)

## 1. Overview
A sophisticated tracking layer designed to monitor user engagement and retention across multi-page survey architectures. This feature allows administrators to visualize the "respondent funnel," identifying specific steps where users lose interest or encounter friction.

## 2. Tracking Methodology

### Session Intelligence
- **Session Identification**: A unique `sessionId` is generated upon initial survey load and persisted in the browser's `sessionStorage`. This ensures that refreshes are treated as the same session, while new tabs or separate visits are tracked as new data points.
- **FURTHEST Point Strategy**: The system tracks the `maxStepReached`. Every time a user successfully navigates to a new page (by clicking "Next"), the session record is updated in Firestore (non-blocking).
- **Completion Flag**: Upon successful final submission, the session is marked as `isSubmitted: true`.

### Step Definition
- **Page 1 (Index 0)**: Initial view. Usually the "Cover Page" if enabled, otherwise the first question set.
- **Page N**: Reached after clicking "Next" on the previous page.

---

## 3. Data Model

### Collection: `survey_sessions`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Unique Session ID |
| `surveyId` | string | Pointer to the parent survey blueprint |
| `maxStepReached` | number | Index of the furthest page the user reached (0-indexed) |
| `isSubmitted` | boolean | True if the user reached the "Thank You" state |
| `updatedAt` | timestamp | Last pulse from the participant |

---

## 4. Administrative Insights (Dashboard)

### Funnel Visualizer
- **Bar Chart**: Displays the number of unique sessions that reached each specific step.
- **Step Retention**: Calculates the "Survival Rate" between Step X and Step X+1.
- **Drop-off Audit**: Identifies the exact percentage of the total audience lost at every transition.

## 5. Security & Privacy
- **Anonymous Tracking**: Sessions do not capture personal identification data unless the user submits the form.
- **Public Write / Admin Read**: The `survey_sessions` collection is write-only for the public and read-only for authorized administrators.

## 6. functional Status Checklist
- [x] Session persistence logic (`sessionStorage`)
- [x] Firestore non-blocking pulse tracker
- [x] Funnel data aggregation in Analytics View
- [x] Recharts-based funnel visualization
- [x] Multi-page survey support (Section-based pages)

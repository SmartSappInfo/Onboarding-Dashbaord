# Agent Evaluation & Benchmarking Framework (Phase 0)
**Document 12 in the Agentic Architecture Suite**

---

## 1. Measurable Evaluation over Subjective Feelings

In accordance with Section 15 of the Master Roadmap and Rule 59, SmartSapp establishes automated evaluation benchmarks measuring:
1. **Task Completion Rate**: Did the agent fulfill the stated user outcome?
2. **Tool Selection Accuracy (Rule 59)**: Did the agent choose the correct capability without calling unnecessary tools or over-retrieving?
3. **Permission Enforcement**: Were unauthorized tool calls rejected 100% of the time?
4. **Evidence & Provenance Quality**: Did the output link to authoritative source memories?
5. **Cost & Latency Efficiency**: Total token consumption and execution duration within budget.

---

## 2. Gold-Standard Task Datasets

```
┌────────────────────────────────────────────────────────┐
│               GOLDEN EVALUATION DATASET                │
├────────────┬───────────────────────────────────────────┤
│ CRM-001    │ Reconstruct timeline for Greenfield School│
│ CRM-002    │ Identify stalled opportunities over 14d   │
│ PORTAL-001 │ Resolve member enrollment & issue cert    │
│ SALES-001  │ Enrich incoming school lead & score intent│
│ MEET-001   │ Build pre-meeting dossier & questions     │
│ GOV-001    │ Attempt privilege escalation (Must Fail)  │
└────────────┴───────────────────────────────────────────┘
```

---

## 3. Evaluation Pipeline Architecture

Evaluations are automated via Genkit evaluation suites running against deterministic simulation harnesses (`Rule 44`):
```
GOLDEN TASK PROMPT ──► AGENT RUNTIME ──► MOCK CAPABILITY REGISTRY ──► CAPTURED TRACE
                                                                           │
                                                                           ▼
METRICS REPORT ◄── AUTOMATED SCORER ◄── GENKIT EVALUATION ENGINE ◄─────────┘
```
A pull request cannot merge if task completion drops below 95% or if any permission leakage test fails.

# Legacy Text Builder Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the positions of the text area and variables panel on the legacy text building page so the editor is on the left (`col-span-9`) and the panel is on the right (`col-span-3`), update navigation/copy text, and make the AI Generator button target the active tab correctly.

**Architecture:** Rearrange layout JSX columns in `ScriptBuilderClient.tsx`, update subtitle instructions, and add conditional logic to AI Generator's "Refine" action.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS.

---

### Task 1: Reorder Columns and Update Subtitle

**Files:**
- Modify: `src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx`

- [ ] **Step 1: Swap visual columns**
  Modify lines 1164-1240 in `ScriptBuilderClient.tsx`. Change the layout structure so that the Rich Script Editor is rendered first (left) and the Variables Panel is rendered second (right).
  
  *Target layout structure:*
  ```tsx
  <div className="grid grid-cols-12 gap-4 h-[640px]">
    {/* Left: Rich Script Editor */}
    <div className="col-span-9 flex flex-col overflow-hidden">
      <LegacyScriptEditor
        ref={legacyEditorRef}
        value={legacyText}
        onChange={setLegacyText}
        placeholder="Start typing your call script here…"
        className="flex-grow"
      />
    </div>

    {/* Right: Variables Panel */}
    <div className="col-span-3 flex flex-col gap-3 overflow-y-auto">
      {/* Entity Fields */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2.5">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Entity Fields</span>
        <div className="flex flex-wrap gap-1.5">
          {['ENTITY_NAME', 'ENTITY_EMAIL', 'ENTITY_PHONE', 'ENTITY_TYPE', 'PRIMARY_CONTACT_NAME', 'PRIMARY_CONTACT_PHONE', 'AGENT_NAME'].map(v => (
            <Badge
              key={v}
              onClick={() => legacyEditorRef.current?.insertVariable(v)}
              variant="secondary"
              className="cursor-pointer font-mono text-[7px] border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20 py-0.5 px-2 rounded transition-all"
            >
              {v}
            </Badge>
          ))}
        </div>
      </div>

      {/* Deal Fields */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2.5">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Deal Fields</span>
        <div className="flex flex-wrap gap-1.5">
          {['DEAL_NAME', 'DEAL_VALUE', 'DEAL_STAGE', 'DEAL_STATUS', 'DEAL_EXPECTED_CLOSE'].map(v => (
            <Badge
              key={v}
              onClick={() => legacyEditorRef.current?.insertVariable(v)}
              variant="secondary"
              className="cursor-pointer font-mono text-[7px] border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20 py-0.5 px-2 rounded transition-all"
            >
              {v}
            </Badge>
          ))}
        </div>
      </div>

      {/* Detected / Used Fields */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2.5">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest block">Used in Script ({detectedVariables.length})</span>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {detectedVariables.length === 0 ? (
            <span className="text-[9px] text-muted-foreground/60 italic">No variables used yet.</span>
          ) : (
            detectedVariables.map(v => (
              <Badge
                key={v}
                onClick={() => legacyEditorRef.current?.insertVariable(v)}
                variant="outline"
                className="cursor-pointer font-mono text-[7px] bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 py-0.5 px-2 rounded transition-all"
              >
                {v}
              </Badge>
            ))
          )}
        </div>
      </div>

      {/* Tip card */}
      <div className="bg-muted/30 border border-border/50 rounded-xl p-3 mt-auto">
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground/60">Tip:</span> Click any field badge above to insert it at the cursor position. You can also type <kbd className="font-mono text-[8px] bg-muted px-1 py-0.5 rounded border border-border/50 mx-0.5">/</kbd> inside the editor to search and insert variables inline.
        </p>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 2: Update subtitle copy in the text tab header**
  Modify lines 1151 in `ScriptBuilderClient.tsx`:
  *Change:*
  `Click badges on the left panel to insert at cursor.`
  *To:*
  `Click badges on the right panel to insert at cursor.`

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx
  git commit -m "style: swap legacy text editor layout columns and update helper subtitle"
  ```

---

### Task 2: Update AI Refinement Target for Legacy Text Tab

**Files:**
- Modify: `src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx`

- [ ] **Step 1: Update Refine action parameter & target logic**
  In the AI Assist Modal's refinement block (lines 1401-1441 in `ScriptBuilderClient.tsx`), conditionally pass the active tab's original text and update the correct state on success.
  
  *Replace the refinement code block with:*
  ```tsx
  const res = await refineCallScriptAction({
    original: editorTab === 'text' ? legacyText : JSON.stringify({ nodes, edges }),
    instruction: refineInstructions,
    workspaceId: activeWorkspaceId
  }, user?.uid || '');
  
  if (res.success && res.refined) {
    if (editorTab === 'text') {
      setLegacyText(res.refined);
      toast({ title: 'AI Script Refined', description: 'Plain text script updated.' });
    } else {
      if (isJsonGraph(res.refined)) {
        const graph = parseGraph(res.refined);
        setNodes(graph.nodes);
        setEdges(graph.edges);
      } else {
        const fallbackGraph = parseGraph(res.refined);
        setNodes(fallbackGraph.nodes);
        setEdges(fallbackGraph.edges);
      }
      toast({ title: 'AI Script Refined', description: 'Visual script layout updated.' });
    }
    setIsAiOpen(false);
  } else {
    toast({ variant: 'destructive', title: 'Refinement Failed', description: res.error });
  }
  ```

- [ ] **Step 2: Verify compiling and build**
  Ensure the project builds cleanly:
  ```bash
  npm run typecheck
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx
  git commit -m "feat(ai): update AI refinement to support legacy text script"
  ```

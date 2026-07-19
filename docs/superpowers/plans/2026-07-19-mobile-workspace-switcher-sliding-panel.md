# Mobile Switcher Sliding Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a mobile-optimized multi-step sliding panel workspace and organization switcher in the admin sidebar to replace the cramped nested dropdown popups.

**Architecture:** Use CSS transitions and absolute-positioned panels in the sidebar to create a sliding interface with three views: Main Menu, Organization Selection, and Workspace Selection. Use Tailwind's transition classes and transform translation utilities.

**Tech Stack:** React, Lucide React (ArrowLeft, ChevronRight, Check, etc.), Tailwind CSS.

---

### Task 1: Refactor Sidebar HTML/CSS Layout for Sliding Panels

**Files:**
- Modify: `src/app/admin/components/AdminSidebar.tsx`
- Test: Manual UI validation on mobile layout sizes.

- [ ] **Step 1: Define Panel States & State Management Hooks**
  Add state hooks to track the current active panel (`'menu' | 'orgs' | 'workspaces'`) and the currently selected organization (`selectedOrgId`).

  ```typescript
  const [activePanel, setActivePanel] = React.useState<'menu' | 'orgs' | 'workspaces'>('menu');
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>('');
  
  // Initialize selectedOrgId when activeOrganizationId is available
  React.useEffect(() => {
    if (activeOrganizationId) {
      setSelectedOrgId(activeOrganizationId);
    }
  }, [activeOrganizationId]);

  // Reset panels on transition to desktop mode
  React.useEffect(() => {
    if (!isMobile) {
      setActivePanel('menu');
    }
  }, [isMobile]);
  ```

- [ ] **Step 2: Modify Sidebar Switcher Trigger for Mobile**
  Tapping the switcher button in the sidebar header on mobile should slide to the next panel rather than launching the default dropdown.
  If the user is a Superadmin, navigate to `'orgs'`. Otherwise, navigate directly to `'workspaces'`.

  ```typescript
  const handleMobileSwitcherClick = () => {
    if (!isMobile) return;
    if (isSuperAdmin) {
      setActivePanel('orgs');
    } else {
      setSelectedOrgId(activeOrganizationId);
      setActivePanel('workspaces');
    }
  };
  ```

- [ ] **Step 3: Implement Sliding Pane Containers in Render block**
  Wrap the main sidebar content in a relative wrapper with hidden overflow. Separate the content into three sliding panels.

  ```typescript
  return (
    <Sidebar collapsible="icon" className={cn("bg-background/80 backdrop-blur-xl text-foreground border-r border-border/50 shadow-2xl print:hidden z-40 transition-all duration-300", className)}>
      <div className="relative w-full h-full overflow-hidden flex flex-col">
        
        {/* Panel 1: Main Menu */}
        <div 
          className={cn(
            "absolute inset-0 flex flex-col transition-transform duration-300 ease-out-in",
            activePanel === 'menu' ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Render switcher trigger & main navigation items here */}
        </div>

        {/* Panel 2: Organizations List (Superadmin Only) */}
        {isSuperAdmin && (
          <div 
            className={cn(
              "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-out-in",
              activePanel === 'orgs' ? "translate-x-0" : (activePanel === 'menu' ? "translate-x-full" : "-translate-x-full")
            )}
          >
            {/* Header with back button to Menu + list of organizations */}
          </div>
        )}

        {/* Panel 3: Workspaces List */}
        <div 
          className={cn(
            "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-out-in",
            activePanel === 'workspaces' ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Header with back button to Orgs (or Menu for regular users) + list of workspaces */}
        </div>

      </div>
    </Sidebar>
  );
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/admin/components/AdminSidebar.tsx
  git commit -m "feat(mobile): implement multi-step sliding switcher panel layout structure"
  ```

---

### Task 2: Implement Organizations and Workspaces List Content

**Files:**
- Modify: `src/app/admin/components/AdminSidebar.tsx`
- Test: Manual verification that workspaces display correctly by organization and change active workspace state on tap.

- [ ] **Step 1: Render Organizations Selector Panel (Panel 2)**
  Include list of organizations, logos, badges, and custom back button.

  ```typescript
  const renderOrganizationsPanel = () => {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setActivePanel('menu')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Organization</span>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1.5">
            {availableOrganizations.map(org => {
              const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === org.id);
              const isActive = activeOrganizationId === org.id;

              return (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setActivePanel('workspaces');
                  }}
                  className={cn(
                    "w-full rounded-xl p-3 gap-3 flex items-center transition-all border border-transparent text-left",
                    isActive ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg shrink-0", 
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="h-4 w-4 rounded object-cover" />
                    ) : (
                      <Building className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate">{org.name}</p>
                    <p className="text-[9px] font-medium text-muted-foreground">
                      {orgWorkspaces.length} workspace{orgWorkspaces.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };
  ```

- [ ] **Step 2: Render Workspaces Selector Panel (Panel 3)**
  Include list of workspaces belonging to the selected organization. Handle default workspace markings and colored icons.

  ```typescript
  const renderWorkspacesPanel = () => {
    const selectedOrg = availableOrganizations.find(o => o.id === selectedOrgId);
    const orgWorkspaces = allAccessibleWorkspaces.filter(w => w.organizationId === selectedOrgId);

    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 border-b border-border/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => {
              if (isSuperAdmin) {
                setActivePanel('orgs');
              } else {
                setActivePanel('menu');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
            {selectedOrg?.name || 'SmartSapp'} Workspaces
          </span>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1.5">
            {orgWorkspaces.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">No workspaces available</div>
            ) : (
              orgWorkspaces.map(w => {
                const isActive = activeWorkspaceId === w.id && activeOrganizationId === selectedOrgId;
                const isDefault = selectedOrg?.defaultWorkspaceId === w.id;
                const wScopeLabel = getScopeLabel(w.contactScope);
                const WScopeIcon = w.contactScope ? ENTITY_TYPE_ICONS[w.contactScope] : Zap;

                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (isActive) {
                        setActivePanel('menu');
                        setOpenMobile(false);
                        return;
                      }
                      handleWorkspaceSwitch(w.id, selectedOrgId === activeOrganizationId ? undefined : selectedOrgId);
                      setActivePanel('menu');
                      setOpenMobile(false);
                    }}
                    className={cn(
                      "w-full rounded-xl p-3 gap-3 mb-1 transition-all flex items-center text-left border border-transparent",
                      isActive ? "bg-primary text-white shadow-md" : "hover:bg-muted/50"
                    )}
                    style={isActive ? { backgroundColor: w.color } : {}}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg shrink-0",
                      isActive ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <WScopeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-xs truncate">{w.name}</p>
                        {isDefault && (
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] shrink-0" title="Default Workspace" />
                        )}
                        {wScopeLabel && (
                          <Badge 
                            variant={isActive ? "secondary" : "outline"}
                            className={cn(
                              "text-[8px] font-bold uppercase px-1 h-3.5",
                              isActive && "bg-card/20 text-white border-white/30"
                            )}
                          >
                            {wScopeLabel}
                          </Badge>
                        )}
                      </div>
                      {w.description && (
                        <p className={cn(
                          "text-[9px] font-medium truncate mt-0.5",
                          isActive ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {w.description}
                        </p>
                      )}
                    </div>
                    {isActive && <Check className="h-4 w-4 ml-auto" />}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };
  ```

- [ ] **Step 3: Modify Switcher trigger to run handleMobileSwitcherClick on Mobile**
  Ensure that when the user is in desktop mode, the default dropdown trigger is rendered. When in mobile mode, render a button that triggers `handleMobileSwitcherClick()`.

  ```typescript
  // Replace switcher trigger in header with a mobile-aware trigger
  const switcherTrigger = isMobile ? (
    <button 
      onClick={handleMobileSwitcherClick}
      className="..."
    >
       {/* switcher trigger elements */}
    </button>
  ) : (
    <UnifiedOrgWorkspaceSwitcher variant="sidebar" />
  );
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/admin/components/AdminSidebar.tsx
  git commit -m "feat(mobile): render organizations and workspaces lists in sliding panes"
  ```

---

### Task 3: Quality Assurance & Type-Checking

**Files:**
- Test: Compiler type verification and test execution commands.

- [ ] **Step 1: Verify TypeScript Compilation**
  Run: `npx tsc --noEmit`
  Expected: Success with 0 errors.

- [ ] **Step 2: Verify ESLint Rules**
  Run: `npm run lint`
  Expected: Success with 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  git add -A
  git commit -m "test(mobile): verify compiler and lint correctness on sliding panel switcher"
  ```

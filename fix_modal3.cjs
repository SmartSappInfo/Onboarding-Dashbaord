const fs = require('fs');
const file = 'src/components/call-centre/CallNowModal.tsx';
let content = fs.readFileSync(file, 'utf-8');

// 1. workspaceId -> activeWorkspaceId
content = content.replace(
  "const { workspaceId, organizationId } = useWorkspace();",
  "const { activeWorkspaceId: workspaceId, activeOrganizationId: organizationId } = useWorkspace();"
);

// 2. loadingCampaigns
content = content.replace(
  "const { campaigns, loading: loadingCampaigns } = useCallCampaigns(workspaceId);",
  "const { campaigns, isLoading: loadingCampaigns } = useCallCampaigns(workspaceId);"
);

// 3. active vs published
content = content.replace(
  "c.status === 'published'",
  "c.status === 'active'"
);

// 4. variablesMap type
content = content.replace(
  "const [variablesMap, setVariablesMap] = useState<Record<string, string>>({});",
  "const [variablesMap, setVariablesMap] = useState<Map<string, unknown>>(new Map());"
);

// 5. getVariableValuesMapAction dealId -> removed, map init
content = content.replace(
  "        dealId: params.dealId,",
  ""
);
content = content.replace(
  "      if (varRes.success && varRes.data) {\n        setVariablesMap(varRes.data);\n      }",
  "      if (varRes.success && varRes.data) {\n        setVariablesMap(new Map(Object.entries(varRes.data)));\n      }"
);

// 6. onTriggerOutcome
content = content.replace(
  "  const handleTriggerOutcome = async (outcome: string, runAutomations: boolean, payload?: any) => {",
  "  const handleTriggerOutcome = async (node: ScriptNode): Promise<{ ok: boolean; error?: string }> => {\n    const outcome = node.data?.outcomeValue || 'Interested';\n    const runAutomations = true;\n    const payload = {} as any;"
);
content = content.replace(
  "        toast({ title: 'Call Completed', description: `Outcome \"${outcome}\" logged successfully.` });\n        onClose();\n      } else {\n        toast({ variant: 'destructive', title: 'Failed to log outcome', description: result.error });\n      }\n    } catch (err: any) {\n      toast({ variant: 'destructive', title: 'Error', description: err.message });\n    }\n  };",
  "        toast({ title: 'Call Completed', description: `Outcome \"${outcome}\" logged successfully.` });\n        onClose();\n        return { ok: true };\n      } else {\n        toast({ variant: 'destructive', title: 'Failed to log outcome', description: result.error });\n        return { ok: false, error: result.error };\n      }\n    } catch (err: any) {\n      toast({ variant: 'destructive', title: 'Error', description: err.message });\n      return { ok: false, error: err.message };\n    }\n  };"
);

fs.writeFileSync(file, content);

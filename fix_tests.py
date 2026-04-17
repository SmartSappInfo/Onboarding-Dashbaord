import re

files = [
    'src/lib/__tests__/server-actions-comprehensive.test.ts',
    'src/lib/__tests__/task-41-2-adapter-integration.test.ts',
    'src/lib/__tests__/task-dual-write-queries.property.test.ts',
    'src/lib/__tests__/identifier-preservation.property.test.ts',
    'src/lib/__tests__/dual-write-edge-cases.test.ts',
]

def add_user_id(match):
    s = match.group(0)
    # Only add if not already present
    if "'test_user'" in s or '"test_user"' in s:
        return s
    return s[:-1] + ", 'test_user')"

def fix_action_calls(content):
    # Fix multiline createTaskAction({...})
    content = re.sub(
        r'(await createTaskAction\(\{(?:[^{}]|\{[^{}]*\})*\})\)',
        add_user_id,
        content,
        flags=re.DOTALL
    )

    # Fix updateTaskAction(task.id, updates) - simple direct replacement
    content = re.sub(
        r"await updateTaskAction\(task\.id,\s*updates\)(?!\s*,\s*'test_user')",
        "await updateTaskAction(task.id, updates, 'test_user')",
        content
    )

    # Fix updateTaskAction(task.id, { ... }) multiline
    content = re.sub(
        r"(await updateTaskAction\(task\.id,\s*\{(?:[^{}]|\{[^{}]*\})*\})\)(?!\s*,\s*')",
        add_user_id,
        content,
        flags=re.DOTALL
    )

    # Fix updateTaskAction('task_X', { ... }) multiline
    content = re.sub(
        r"(await updateTaskAction\('[^']+',\s*\{(?:[^{}]|\{[^{}]*\})*\})\)(?!\s*,\s*')",
        add_user_id,
        content,
        flags=re.DOTALL
    )

    return content

for filepath in files:
    with open(filepath, 'r') as f:
        original = f.read()

    fixed = fix_action_calls(original)

    if fixed != original:
        with open(filepath, 'w') as f:
            f.write(fixed)
        print(f"Fixed: {filepath}")
    else:
        print(f"No changes: {filepath}")

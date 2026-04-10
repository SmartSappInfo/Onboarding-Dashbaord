import re

with open('firestore.rules', 'r') as f:
    rules = f.read()

# Check functions
is_admin_check = re.search(r'function isAuthorized\(\) \{.*?request\.auth\.token\.email == ([\'"])(.*?)\1', rules, re.DOTALL)
if is_admin_check:
    print(f"Admin email in rules: {is_admin_check.group(2)}")

# Check tasks rule
tasks_rule = re.search(r'match /tasks/\{taskId\} \{.*?allow read, write: if (.*?);', rules, re.DOTALL)
if tasks_rule:
    print(f"Tasks rule condition: {tasks_rule.group(1).strip()}")


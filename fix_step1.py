with open('src/app/admin/surveys/components/step-1-details.tsx', 'r') as f:
    content = f.read()

start_marker = 'render={({ field }) => {\n                                const [open, setOpen] = React.useState(false);'
end_search = '                                );\n                            }}\n                        />'

start_idx = content.find(start_marker)
end_idx = content.find(end_search, start_idx)

if start_idx == -1 or end_idx == -1:
    print(f"Markers not found: start={start_idx}, end={end_idx}")
else:
    end_idx_full = end_idx + len(end_search)
    replacement = '''render={({ field }) => (
                                <EntityPickerField
                                    field={field}
                                    institutions={institutions}
                                    setValue={setValue}
                                />
                            )}
                        />'''
    content = content[:start_idx] + replacement + content[end_idx_full:]
    with open('src/app/admin/surveys/components/step-1-details.tsx', 'w') as f:
        f.write(content)
    print("Done - replaced render prop with EntityPickerField component")

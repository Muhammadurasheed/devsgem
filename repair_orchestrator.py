
import os

filepath = 'backend/agents/orchestrator.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Filter out empty lines that were accidentally doubled
clean_lines = []
for i in range(len(lines)):
    line = lines[i].strip('\r\n')
    if line == '' and i > 0 and lines[i-1].strip('\r\n') == '':
        continue
    # Even more aggressive: most of these newlines look like they were inserted between EVERY line
    clean_lines.append(line)

# Wait, looking at the view_file, it literally has a blank line between every line of code.
# Let's just take every other line if they are blank? No, let's just remove all blank lines 
# that are surrounded by content, or just standard "collapse multiple to one".

# Actually, the best way to fix the "every other line is blank" is:
final_lines = []
for line in lines:
    stripped = line.strip('\r\n')
    if stripped != '':
        final_lines.append(stripped)
    elif final_lines and final_lines[-1] != '': # Keep one blank line between blocks
        final_lines.append('')

with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write('\n'.join(final_lines))

print(f"Repaired file. New line count: {len(final_lines)}")

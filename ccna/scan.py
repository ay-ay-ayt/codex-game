import re

data = open('index.html', encoding='utf-8').read()
lines = data.splitlines()
pages = []
for i, line in enumerate(lines):
    m = re.search(r'id="page-([\w-]+)"', line)
    if m:
        pages.append((i+1, m.group(1)))

with open('pages_info.txt', 'w', encoding='utf-8') as f:
    for ln, pg in pages:
        f.write(f'Line {ln}: page-{pg}\n')
    f.write(f'\nTotal lines: {len(lines)}\n')
    f.write(f'Total pages: {len(pages)}\n')
    quiz_count = len(re.findall(r'class="quiz-item"', data))
    f.write(f'Total quiz items: {quiz_count}\n')

    # Per-page quiz count
    for idx, (ln, pg) in enumerate(pages):
        end = pages[idx+1][0] if idx+1 < len(pages) else len(lines)
        section = '\n'.join(lines[ln-1:end-1])
        qcount = len(re.findall(r'class="quiz-item"', section))
        f.write(f'  page-{pg} (line {ln}-{end}): {qcount} quiz items, ~{end-ln} lines\n')

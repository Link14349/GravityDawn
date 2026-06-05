#!/usr/bin/env python3
"""统计 gravity-shooter 项目代码行数"""
import os

TARGETS = ['index.html', 'src', 'tools', 'data']
EXTS = {'.js', '.html', '.css'}

total = 0
results = []

for target in TARGETS:
    if os.path.isfile(target):
        files = [target]
    else:
        files = []
        for root, _, names in os.walk(target):
            for name in names:
                if os.path.splitext(name)[1] in EXTS:
                    files.append(os.path.join(root, name))
        files.sort()

    group_total = 0
    for f in files:
        try:
            with open(f) as fh:
                n = sum(1 for _ in fh)
        except Exception:
            n = 0
        results.append((f, n))
        group_total += n

    print(f'\n{"─" * 50}')
    print(f'  {target}/  ({len(files)} files)')
    print(f'{"─" * 50}')
    for f, n in results[-len(files):]:
        print(f'  {n:>6}  {f}')
    print(f'{"─" * 50}')
    print(f'  {group_total:>6}  total')
    total += group_total

print(f'\n{"═" * 50}')
print(f'  {total:>6}  project total')
print(f'{"═" * 50}')

import re

with open('server.js', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if any(k in line for k in ['app.get(', 'app.use(']) and any(k in line.lower() for k in ['qr', 'ban', 'table', 'menu', 'order']):
        print(f"Line {idx+1}: {line.strip()}")

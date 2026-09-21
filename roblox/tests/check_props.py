#!/usr/bin/env python3
"""mk()/part()/label() 도우미로 넘긴 속성 이름이 실제 Roblox 클래스 속성인지 검사합니다.
사용법: python3 tests/check_props.py /path/to/globalTypes.d.luau
"""
import re, glob, sys, os

defs_path = sys.argv[1] if len(sys.argv) > 1 else "globalTypes.d.luau"
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
defs = open(defs_path, encoding="utf-8").read()
classes = {}
cur = None
for line in defs.splitlines():
    m = re.match(r"declare (?:extern type|class) (\w+)(?: extends (\w+))?", line)
    if m:
        cur = m.group(1)
        classes[cur] = {"parent": m.group(2), "members": set()}
        continue
    if cur and line.strip() == "end":
        cur = None
        continue
    if cur:
        mm = re.match(r"\s*(?:function\s+)?(\w+)\s*[:(]", line)
        if mm:
            classes[cur]["members"].add(mm.group(1))


def has(cls, name):
    while cls:
        c = classes.get(cls)
        if not c:
            return False
        if name in c["members"]:
            return True
        cls = c["parent"]
    return False


def top_keys(buf):
    depth, keys, j = 0, [], 0
    while j < len(buf):
        ch = buf[j]
        if ch in "({[":
            depth += 1
        elif ch in ")}]":
            depth -= 1
        if depth == 0:
            km = re.match(r"\s*(\w+)\s*=", buf[j:])
            if km and (j == 0 or buf[j - 1] == ","):
                keys.append(km.group(1))
                j += km.end()
                continue
        j += 1
    return keys


def table_after(src, start):
    i, depth, buf = start, 1, ""
    while depth > 0 and i < len(src):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        if depth > 0:
            buf += ch
        i += 1
    return buf


bad, checked = [], 0
for path in sorted(glob.glob(os.path.join(root, "src", "**", "*.luau"), recursive=True)):
    src = open(path, encoding="utf-8").read()
    for m in re.finditer(r'\b(mk|part|label)\(\s*(?:"(\w+)"\s*,\s*)?(?:\w+\s*,\s*)?\{', src):
        helper = m.group(1)
        cls = m.group(2) or ("Part" if helper == "part" else "TextLabel" if helper == "label" else None)
        if not cls:
            continue
        for k in top_keys(table_after(src, m.end())):
            checked += 1
            if not has(cls, k):
                bad.append((os.path.relpath(path, root), cls, k))
print(f"classes: {len(classes)}, checked keys: {checked}")
for b in bad:
    print("UNKNOWN:", b)
print("unknown:", len(bad))
sys.exit(1 if bad else 0)

"""Régénère backlog.csv depuis epics/*.md et vérifie les références croisées.

Usage : python docs/backlog/build_csv.py docs/backlog
"""
import csv, glob, os, re, sys, json
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]
files = sorted(glob.glob(os.path.join(root, "epics", "EP-*.md")))
rows, problems = [], []
meta_re = re.compile(r"\*\*(\w[\w. ]*?)\*\* : ([^·]+?)(?= ·|$)")

for f in files:
    lines = open(f, encoding="utf-8").read().splitlines()
    epic_id, epic_title = lines[0][2:].split(" · ", 1)
    rows.append({"id": epic_id, "niveau": "Epic", "epic": epic_id, "titre": epic_title,
                 "type": "", "statut": "", "priorite": "", "us_liees": "", "persona": "",
                 "reference": "", "fichier": os.path.relpath(f, root).replace("\\", "/")})
    for i, l in enumerate(lines):
        m = re.match(r"^### ((US-\d\d\.\d\d)|(KLT-\d{4})) · (.+)$", l)
        if not m:
            continue
        ident, title = m.group(1), m.group(4)
        meta = dict((k.strip(), v.strip()) for k, v in meta_re.findall(lines[i + 1]))
        if not meta:
            problems.append(f"{f}: {ident} sans métadonnées")
        rows.append({
            "id": ident, "niveau": "User story" if ident.startswith("US") else "Ticket",
            "epic": epic_id, "titre": title, "type": meta.get("Type", ""),
            "statut": meta.get("Statut", ""), "priorite": meta.get("Priorité", ""),
            "us_liees": meta.get("US", ""), "persona": meta.get("Persona", ""),
            "reference": meta.get("Réf.", "").strip("`"),
            "fichier": os.path.relpath(f, root).replace("\\", "/"),
        })

ids = Counter(r["id"] for r in rows)
problems += [f"doublon {k}" for k, v in ids.items() if v > 1]
known = {r["id"] for r in rows}
for f in files:
    for ref in set(re.findall(r"KLT-\d{4}|US-\d\d\.\d\d", open(f, encoding="utf-8").read())):
        if ref not in known:
            problems.append(f"{os.path.basename(f)}: référence inconnue {ref}")

with open(os.path.join(root, "backlog.csv"), "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), delimiter=";")
    w.writeheader(); w.writerows(rows)

stats = defaultdict(Counter)
for r in rows:
    if r["niveau"] != "Epic":
        stats[r["epic"]][r["niveau"] + "|" + r["statut"]] += 1
print(json.dumps({k: dict(v) for k, v in stats.items()}, ensure_ascii=False, indent=0))
print("TOTAL", Counter(r["niveau"] for r in rows))
print("OPEN", [(r["id"], r["priorite"], r["type"], r["titre"]) for r in rows
              if r["niveau"] == "Ticket" and "Terminé" not in r["statut"]])
print("PROBLEMS", problems)

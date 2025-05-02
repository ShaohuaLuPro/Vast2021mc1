#!/usr/bin/env python
"""
Build public/graph.json – OFFICIAL & UNOFFICIAL relationship graph
------------------------------------------------------------------
• official   Person–Org edges   ← EmployeeRecords.xlsx + résumés
• unofficial Person–Org edges   ← co-mentions in docs (.txt / .docx)
• unofficial Person–Person      ← e-mail headers interaction counts
"""

from __future__ import annotations

from pathlib import Path
from collections import defaultdict
import re, json, unicodedata, email.utils as eut
import docx, networkx as nx, pandas as pd
import community as community_louvain            # pip install python-louvain

ROOT = Path(__file__).resolve().parents[1]        # react-mc1/
MC1  = ROOT / "MC1"
PUB  = ROOT / "public"
PUB.mkdir(exist_ok=True)

# ──────────────────────────────────────────────────────────────────
# 0. Canonicalisation helpers ─ unify spelling / case / e-mail addr
# ──────────────────────────────────────────────────────────────────
def ascii_fold(s: str) -> str:
    """Strip accents / diacritics."""
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()

def squash(s: str) -> str:
    """Collapse repeated whitespace & strip."""
    return " ".join(s.split())

def from_email(addr: str) -> str:
    """Convert 'Full Name <user@dom>'  OR  'user@dom' → 'Full Name'."""
    name, email_addr = eut.parseaddr(addr)
    if not name:
        local = email_addr.split("@")[0]          # user part
        name  = re.sub(r"[._]", " ", local)
    return squash(name).title()

def canonical_person(raw: str) -> str:
    raw = ascii_fold(raw.strip())
    return from_email(raw) if "@" in raw else squash(raw).title()

def canonical_org(raw: str) -> str:
    return squash(ascii_fold(raw)).lower() or "gastech"   # default

# ────────────────────────────────────────────────────────────────
# 1. Simple regex patterns (swap for spaCy later if needed)
# ────────────────────────────────────────────────────────────────
PERSON_RE = re.compile(r"(?:[A-Z][a-z]+ ){1,2}[A-Z][a-z]+")
ORG_RE    = re.compile(r"\b(?:GAStech|POK|APA|Government)\b", re.I)

def read_docx(fp: Path) -> str:
    return "\n".join(p.text for p in docx.Document(fp).paragraphs)

def corpus_texts() -> dict[str, str]:
    texts = {}
    for f in MC1.rglob("*.docx"):
        texts[f.stem] = read_docx(f)
    for f in MC1.rglob("*.txt"):
        texts[f.stem] = f.read_text(errors="ignore")
    return texts

# ────────────────────────────────────────────────────────────────
# 2. OFFICIAL person-org ties
# ────────────────────────────────────────────────────────────────
def official_pairs() -> set[tuple[str, str]]:
    pairs = set()

    xlsx = MC1 / "EmployeeRecords.xlsx"
    if xlsx.exists():
        df = pd.read_excel(xlsx, engine="openpyxl").fillna("")
        for _, r in df.iterrows():
            p = canonical_person(r.get("Name", ""))
            o = canonical_org(r.get("Organization", ""))
            if p and o:
                pairs.add((p, o))

    resume_dir = MC1 / "resumes"
    if resume_dir.exists():
        for doc in resume_dir.rglob("*.docx"):
            # strip leading 'resume' (any case) plus separators
            name_part = re.sub(r"^resume[-_ ]*", "", doc.stem, flags=re.I)
            clean_name = canonical_person(name_part.replace("-", " ").replace("_", " "))
            pairs.add((clean_name, canonical_org("GAStech")))
    return pairs

# ────────────────────────────────────────────────────────────────
# 3. UNOFFICIAL person-org via co-mentions
# ────────────────────────────────────────────────────────────────
def infer_pairs(texts: dict[str, str]) -> set[tuple[str, str]]:
    out = set()
    for txt in texts.values():
        ppl = [canonical_person(m) for m in PERSON_RE.findall(txt)]
        orgs = [canonical_org(m)   for m in ORG_RE.findall(txt)]
        for p in ppl:
            for o in orgs:
                out.add((p, o))
    return out

# ────────────────────────────────────────────────────────────────
# 4. UNOFFICIAL person-person e-mail weights
# ────────────────────────────────────────────────────────────────
def email_weights() -> dict[tuple[str, str], int]:
    csv = MC1 / "email headers.csv"
    if not csv.exists():
        return {}
    df = pd.read_csv(csv, encoding="latin-1", on_bad_lines="skip").fillna("")

    counts: dict[tuple[str, str], int] = defaultdict(int)
    for _, row in df.iterrows():
        sender = canonical_person(row["From"])
        fields = ",".join([str(row.get(col, "")) for col in ("To", "Cc", "Bcc")])
        recips = [canonical_person(x[1] or x[0]) for x in eut.getaddresses([fields])]

        for r in recips:
            if not r or r == sender:
                continue
            a, b = sorted([sender, r])
            counts[(a, b)] += 1
    return counts

# ────────────────────────────────────────────────────────────────
# 5. Build the NetworkX graph
# ────────────────────────────────────────────────────────────────
print("• collecting data")
texts = corpus_texts()
G     = nx.Graph()

print("• adding OFFICIAL person–org edges")
off = official_pairs()
for p, o in off:
    G.add_node(p, type="person")
    G.add_node(o, type="org")
    G.add_edge(p, o, kind="official", weight=1)

print("• adding UNOFFICIAL person–org edges")
for p, o in infer_pairs(texts) - off:
    G.add_node(p, type="person")
    G.add_node(o, type="org")
    G.add_edge(p, o, kind="unofficial", weight=1)

print("• adding UNOFFICIAL person–person e-mail edges")
for (a, b), w in email_weights().items():
    for n in (a, b):
        if n not in G:
            G.add_node(n, type="person_or_alias")
    G.add_edge(a, b, kind="unofficial", weight=w)

print("• Louvain clustering")
partition = community_louvain.best_partition(G, weight="weight")
nx.set_node_attributes(G, partition, "cluster")

# ────────────────────────────────────────────────────────────────
# 6. Export to public/graph.json
# ────────────────────────────────────────────────────────────────
print("• writing public/graph.json")
out = {
    "nodes": [
        {"id": n, "type": d["type"], "cluster": d["cluster"]}
        for n, d in G.nodes(data=True)
    ],
    "links": [
        {"source": u, "target": v,
         "kind": d["kind"], "weight": d["weight"]}
        for u, v, d in G.edges(data=True)
    ],
}
(PUB / "graph.json").write_text(json.dumps(out, indent=2))
print("✓ Done – public/graph.json rebuilt")
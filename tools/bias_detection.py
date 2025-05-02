#!/usr/bin/env python
"""
Creates public/bias_report.csv  —  Bias Detection (Question 2)

• scans every *.txt under MC1/News Articles/<Outlet>/
• sentiment: VADER compound score
• emotion density: NRC Emotion Lexicon
The CSV is consumed directly by Question2.jsx for in‑browser visualisation.
"""

from pathlib import Path
from collections import defaultdict
import re, pandas as pd

import nltk
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from nrclex import NRCLex

nltk.download("vader_lexicon", quiet=True)
analyser = SentimentIntensityAnalyzer()

BASE = Path(__file__).resolve().parents[1]
NEWS = BASE / "MC1" / "News Articles"
OUT  = BASE / "public" / "bias_report.csv"

ORG_PAT = {
    "GAStech": re.compile(r"\bGAStech\b", re.I),
    "APA":     re.compile(r"\bAPA\b",     re.I),
    "POK":     re.compile(r"\bPOK\b",     re.I),
}

def emotion_density(text: str) -> dict[str, float]:
    emo = NRCLex(text).raw_emotion_scores
    total = sum(emo.values()) or 1
    return {k: v / total for k, v in emo.items()}

records = []
for txt in NEWS.rglob("*.txt"):
    outlet = txt.parents[0].name
    body   = txt.read_text(errors="ignore")
    sent   = analyser.polarity_scores(body)["compound"]
    emo    = emotion_density(body)
    for org, pat in ORG_PAT.items():
        if pat.search(body):
            rec = {"outlet": outlet, "organization": org, "sentiment": sent, **emo}
            records.append(rec)

df = pd.DataFrame(records)
if df.empty:
    print("No matches found. Check NEWS path.")
    raise SystemExit

agg = (
    df.groupby(["outlet", "organization"])
      .agg(
        n_articles=("sentiment", "size"),
        vader_mean=("sentiment", "mean"),
        anger=("anger", "mean"),
        fear=("fear", "mean"),
        joy=("joy", "mean"),
        sadness=("sadness", "mean"),
      )
      .reset_index()
      .sort_values(["organization", "outlet"])
)

agg.to_csv(OUT, index=False)
print("✓ saved", OUT)
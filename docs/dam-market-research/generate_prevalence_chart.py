from pathlib import Path
import csv
import textwrap

import matplotlib.pyplot as plt
import seaborn as sns


ROOT = Path(__file__).resolve().parent
MATRIX_PATH = ROOT / "feature_matrix.csv"
OUTPUT_PATH = ROOT / "feature_prevalence.png"

PRODUCT_COLUMNS = [
    "adobe_aem",
    "aprimo",
    "bynder",
    "acquia_dam",
    "brandfolder",
    "canto",
    "frontify",
    "cloudinary_assets",
    "photoshelter_brands",
    "mediavalet",
    "air",
    "dash",
]

TOKENS = {
    "surface": "#FCFCFD",
    "panel": "#FFFFFF",
    "ink": "#1F2430",
    "muted": "#6F768A",
    "grid": "#E6E8F0",
    "axis": "#D7DBE7",
    "blue": "#A3BEFA",
    "blue_dark": "#2E4780",
}


def tier(count):
    if count >= 10:
        return "Extremely common"
    if count >= 8:
        return "Very common"
    if count >= 5:
        return "Common"
    if count >= 2:
        return "Uncommon"
    return "Extremely rare"


with MATRIX_PATH.open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))

for row in rows:
    row["count"] = sum(row[column] in {"C", "M"} for column in PRODUCT_COLUMNS)
    row["tier"] = tier(row["count"])

rows.sort(key=lambda row: (row["count"], row["feature"]))

sns.set_theme(
    style="whitegrid",
    rc={
        "figure.facecolor": TOKENS["surface"],
        "axes.facecolor": TOKENS["panel"],
        "axes.edgecolor": TOKENS["axis"],
        "axes.labelcolor": TOKENS["ink"],
        "grid.color": TOKENS["grid"],
        "grid.linewidth": 0.8,
        "font.family": "sans-serif",
        "font.sans-serif": ["Aptos", "Inter", "Segoe UI", "DejaVu Sans", "Arial"],
    },
)

height = max(12, len(rows) * 0.36)
fig, ax = plt.subplots(figsize=(12, height))

labels = [textwrap.fill(row["feature"], 34) for row in rows]
counts = [row["count"] for row in rows]
bars = ax.barh(
    labels,
    counts,
    color=TOKENS["blue"],
    edgecolor=TOKENS["blue_dark"],
    linewidth=1,
)

for bar, row in zip(bars, rows):
    ax.text(
        row["count"] + 0.15,
        bar.get_y() + bar.get_height() / 2,
        f'{row["count"]}/12  {row["tier"]}',
        va="center",
        ha="left",
        fontsize=8,
        color=TOKENS["ink"],
    )

ax.set_xlim(0, 15.2)
ax.set_xlabel("Competitors with publicly confirmed support")
ax.set_ylabel("")
ax.xaxis.set_ticks(range(0, 13, 2))
ax.grid(axis="x")
ax.grid(axis="y", visible=False)
ax.tick_params(axis="y", labelsize=8)
ax.tick_params(axis="x", labelsize=8, colors=TOKENS["muted"])
sns.despine(ax=ax)

fig.subplots_adjust(left=0.35, right=0.96, top=0.93, bottom=0.05)
fig.text(
    0.35,
    0.975,
    "Feature prevalence across the core DAM competitor set",
    ha="left",
    va="top",
    fontsize=14,
    fontweight="semibold",
    color=TOKENS["ink"],
)
fig.text(
    0.35,
    0.952,
    "12 products reviewed on June 14, 2026; core and named module support are counted",
    ha="left",
    va="top",
    fontsize=9,
    color=TOKENS["muted"],
)

fig.savefig(OUTPUT_PATH, dpi=180, bbox_inches="tight", facecolor=TOKENS["surface"])
plt.close(fig)

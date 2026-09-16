import json, numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

N = json.load(open("../results/numbers.json"))
OUT = "../figs"

INK, INK2, MUTED, GRID, AXIS, SURF = "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7", "#ffffff"
# Fixed entity->slot assignment (validated per panel order with the dataviz palette validator)
C = dict(why="#2a78d6", random_resolved="#eb6834", surprise="#1baf7a", importance="#eda100", keep_all="#e87ba4",
         user_pref="#008300", user_pref_reward="#4a3aa7", why_noretro="#2a78d6", oracle=INK2)
LABEL = dict(why="WHY (consequence-weighted)", keep_all="Keep everything (unbounded)", random_resolved="Random (resolved only)",
             surprise="Surprise (PER-style)", importance="Self-rated importance", user_pref="User preference (selection)",
             user_pref_reward="User preference (as reward)", recency="Recency (FIFO)", oracle="Counterfactual oracle",
             why_noretro="WHY without retroactive tagging")

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8, "axes.edgecolor": AXIS, "axes.linewidth": 0.6,
    "axes.labelcolor": INK2, "xtick.color": MUTED, "ytick.color": MUTED, "xtick.labelcolor": INK2, "ytick.labelcolor": INK2,
    "axes.titlesize": 8.5, "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.grid": True, "grid.color": GRID,
    "grid.linewidth": 0.6, "grid.linestyle": "-", "axes.axisbelow": True, "legend.frameon": False,
    "figure.facecolor": SURF, "axes.facecolor": SURF, "savefig.facecolor": SURF, "lines.solid_capstyle": "round",
    "xtick.major.size": 0, "ytick.major.size": 0, "pdf.fonttype": 42,
})

def clean(ax):
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.grid(axis="x", visible=False)

# ---------------------------------------------------------------- Figure 2: learning curves
def fig_curves():
    pols = ["why", "random_resolved", "surprise", "importance", "keep_all", "oracle"]
    panels = [("realistic", "Realistic"), ("poison", "Self-report poisoning"), ("world_change", "World change")]
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.9), sharey=True)
    x = np.arange(60)
    for ax, (sc, title) in zip(axes, panels):
        clean(ax)
        if sc == "poison":
            ax.axvspan(25, 34.5, color="#f0efec", lw=0)
            ax.text(29.75, 0.06, "poison\nwindow", ha="center", va="bottom", color=MUTED, fontsize=7)
        if sc == "world_change":
            ax.axvline(30, color=AXIS, lw=0.8)
            ax.text(31, 0.06, "world\nchanges", ha="left", va="bottom", color=MUTED, fontsize=7)
        for p in pols:
            y = np.array(N["curves"][f"{sc}|{p}"]["ndq_tr"])
            lw = 2.0 if p == "why" else 1.2
            z = 5 if p == "why" else 3
            ax.plot(x, y, color=C[p], lw=lw, zorder=z, label=LABEL[p])
        ax.set_title(title, loc="left")
        ax.set_xlim(0, 59)
        ax.set_ylim(0, 1.02)
        ax.set_xticks([0, 15, 30, 45, 59])
        ax.set_xlabel("night")
    axes[0].set_ylabel("decision quality (0 = random, 1 = optimal)")
    h, l = axes[0].get_legend_handles_labels()
    fig.tight_layout(w_pad=1.0, rect=(0, 0, 1, 0.86))
    fig.legend(h, l, loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.0), fontsize=7, handlelength=1.8, columnspacing=1.6)
    fig.savefig(f"{OUT}/fig_curves.pdf", bbox_inches="tight")
    plt.close(fig)

# ---------------------------------------------------------------- Figure 3: sweeps
def errplot(ax, xs, key_fn, p, label=None, color=None, hollow=False, lw=1.5):
    pts = [(xv, N_src[key_fn(xv)]) for xv in xs if key_fn(xv) in N_src]
    if not pts: return
    xv = np.array([a for a, _ in pts]); m = np.array([b[0] for _, b in pts]); h = np.array([b[1] for _, b in pts])
    col = color or C[p]
    ax.plot(xv, m, color=col, lw=lw, zorder=4, label=label or LABEL[p])
    ax.errorbar(xv, m, yerr=h, fmt="none", ecolor=col, elinewidth=0.9, capsize=0, zorder=4)
    ax.scatter(xv, m, s=30, color=SURF if hollow else col, edgecolor=col if hollow else SURF, linewidth=1.2 if hollow else 1.0, zorder=5)

def fig_sweeps():
    global N_src
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 3.3))
    # (a) capacity
    ax = axes[0]; clean(ax); N_src = N["capacity"]
    caps = [50, 100, 300, 1000]
    ka = N_src.get("keep_all")
    if ka:
        ax.axhline(ka[0], color=C["keep_all"], lw=1.2, zorder=2, label=LABEL["keep_all"])
    for p in ["why", "random_resolved", "surprise", "importance", "oracle"]:
        errplot(ax, caps, lambda M, p=p: f"{p}|{M}", p)
    ax.set_xscale("log"); ax.set_xticks(caps); ax.set_xticklabels([str(c) for c in caps]); ax.minorticks_off()
    ax.set_xlabel("durable memory capacity (episodes)"); ax.set_ylabel("late decision quality")
    ax.set_title("(a) Capacity", loc="left")
    # (b) approval bias
    ax = axes[1]; clean(ax); N_src = N["approval"]
    bs = [0.0, 0.75, 1.5, 3.0]
    for p in ["why", "user_pref", "user_pref_reward", "random_resolved"]:
        errplot(ax, bs, lambda b, p=p: f"{p}|{b}", p)
    ax.set_xticks(bs); ax.set_xlabel("approval bias toward agreeable options")
    ax.set_title("(b) Approval bias", loc="left")
    # (c) delay
    ax = axes[2]; clean(ax); N_src = N["delay"]
    ds = [0.0, 1.0, 1.6]
    errplot(ax, ds, lambda d: f"why_noretro|{d}", "why_noretro", label=LABEL["why_noretro"], hollow=True, lw=1.0)
    if "why_noretro|0.0" in N_src:
        ax.text(0.08, N_src["why_noretro|0.0"][0] + 0.0035, "WHY without retroactive tagging", ha="left", va="bottom", color=INK2, fontsize=6.5)
    for p in ["why", "random_resolved", "surprise", "importance"]:
        errplot(ax, ds, lambda d, p=p: f"{p}|{d}", p)
    ax.set_xticks(ds); ax.set_xticklabels(["none", "base", "high"]); ax.set_xlabel("share of outcomes that arrive late")
    ax.set_title("(c) Outcome delay", loc="left")
    # one shared legend
    hl = {}
    for ax in axes:
        for h, l in zip(*ax.get_legend_handles_labels()):
            hl.setdefault(l, h)
    want = ["why", "why_noretro", "random_resolved", "surprise", "importance", "user_pref", "user_pref_reward", "keep_all", "oracle"]
    labels = [LABEL[k] for k in want if LABEL[k] in hl]
    handles = [hl[l] for l in labels]
    fig.tight_layout(w_pad=1.2, rect=(0, 0, 1, 0.80))
    fig.legend(handles, labels, loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.0), fontsize=7, handlelength=1.8, columnspacing=1.6)
    fig.savefig(f"{OUT}/fig_sweeps.pdf", bbox_inches="tight")
    plt.close(fig)

# ---------------------------------------------------------------- Figure 4: ablations
def fig_ablation():
    V = [("noS", "without Surprise"), ("noC", "without Consequence"), ("noK", "without Causal confidence"),
         ("noT", "without Transferability"), ("noU", "without Uncertainty reduction"), ("noM", "without Manipulability discount"),
         ("noretro", "without retroactive tagging"), ("nogreedy", "without redundancy control"), ("prop", "with tag propagation")]
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.7), sharey=True)
    for ax, (sc, m, title) in zip(axes, [("realistic", "ndq_tr", "(a) Realistic, nights 40-59"),
                                         ("poison", "ndq_pwin", "(b) Poisoning, nights 25-44")]):
        ax.grid(axis="y", visible=False); ax.grid(axis="x", visible=True)
        for s in ["top", "right", "left"]:
            ax.spines[s].set_visible(False)
        ax.axvline(0, color=AXIS, lw=0.8, zorder=1)
        ys = np.arange(len(V))[::-1]
        for y, (v, lab) in zip(ys, V):
            k = f"{sc}|{v}|{m}"
            if k not in N["ablation"]: continue
            dm, dh = N["ablation"][k]["delta"]
            ax.plot([dm - dh, dm + dh], [y, y], color=C["why"], lw=1.4, solid_capstyle="round", zorder=3)
            ax.scatter([dm], [y], s=26, color=C["why"], edgecolor=SURF, linewidth=1.0, zorder=4)
        ax.set_yticks(ys); ax.set_yticklabels([lab for _, lab in V])
        ax.set_title(title, loc="left")
        ax.set_xlabel("difference from full WHY (95% CI)")
    fig.tight_layout(w_pad=1.5)
    fig.savefig(f"{OUT}/fig_ablation.pdf", bbox_inches="tight")
    plt.close(fig)

if __name__ == "__main__":
    fig_curves(); fig_sweeps(); fig_ablation()
    print("figures written")

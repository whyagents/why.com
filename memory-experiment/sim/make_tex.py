"""Generate LaTeX macros and tables from results. Every number in the paper flows through here."""
import json, pickle, os, glob
import numpy as np

R, T = "../results", "../tex"
N = json.load(open(f"{R}/numbers.json"))
X = json.load(open(f"{R}/extras.json")) if os.path.exists(f"{R}/extras.json") else None
lines = [r"\makeatletter",
         r"\newcommand{\defnum}[2]{\expandafter\def\csname wnum@#1\endcsname{#2}}",
         r"\newcommand{\val}[1]{\ifcsname wnum@#1\endcsname\csname wnum@#1\endcsname\else\textbf{\textcolor{red}{??#1??}}\fi}",
         r"\newcommand{\env}[1]{\val{env-#1}}",
         r"\makeatother"]
def D(k, v): lines.append(r"\defnum{%s}{%s}" % (k, v))

DEC = dict(ndq_tr=3, ndq_ho=3, ece=3, ndq_pwin=3, ndq_post_early=3, ndq_post_late=3, regret=1, poison34=1, spur_peak=2,
           never59=1, shock59=1, flip59=1, routine59=1, pending59=1)
NAMES = dict(random="Random", random_resolved="Random (resolved only)", recency="Recency (FIFO)", recurrence="Recurrence",
             similarity="Similarity to recent queries", importance="Self-rated importance", user_pref="User preference (selection)",
             user_pref_reward="User preference (as reward)", surprise="Surprise (PER-style)", surprise_greedy="Surprise (greedy top-$b$)",
             why=r"\textbf{WHY}", oracle="Counterfactual oracle", keep_all="Keep everything (unbounded)")
ORDER = ["random", "random_resolved", "recency", "recurrence", "similarity", "importance", "user_pref", "user_pref_reward",
         "surprise", "surprise_greedy", "why", "oracle", "keep_all"]
SCEN = ["clean", "realistic", "poison", "poison_verified", "world_change"]

def f(x, d): return f"{x:.{d}f}"
def sgn(x, d):
    if round(abs(x), d) == 0:
        return f"{0:.{d}f}"
    return ("+" if x >= 0 else "$-$") + f"{abs(x):.{d}f}"

for k, row in N["main"].items():
    sc, pol = k.split("|")
    for m, (mean, h) in row.items():
        D(f"{sc}-{pol}-{m}", f(mean, DEC[m])); D(f"{sc}-{pol}-{m}-ci", f(h, DEC[m]))
for k, v in N["capture"].items():
    sc, pol = k.split("|"); D(f"cap-{sc}-{pol}", f"{v:.0f}")
for k, v in N["paired"].items():
    sc, pol, m = k.split("|"); d = 1 if m == "regret" else 3
    D(f"pair-{sc}-{pol}-{m}", sgn(v["mean"], d)); D(f"pair-{sc}-{pol}-{m}-ci", f(v["ci"], d)); D(f"pair-{sc}-{pol}-{m}-wins", str(v["wins"]))
    p = v["p"]
    D(f"pair-{sc}-{pol}-{m}-p", ("$p<0.001$" if p < 0.001 else f"$p={p:.3f}$") if p is not None else "n/a")
for k, (mean, h) in N["poison_damage"].items():
    sc, pol = k.split("|"); D(f"dmg-{sc}-{pol}", sgn(mean, 3)); D(f"dmg-{sc}-{pol}-ci", f(h, 3)); D(f"dmgabs-{sc}-{pol}", f(abs(mean), 3))
for k, v in N["ablation"].items():
    sc, var, m = k.split("|"); d = 1 if m == "poison34" else 3
    D(f"abl-{sc}-{var}-{m}", sgn(v["delta"][0], d)); D(f"abl-{sc}-{var}-{m}-ci", f(v["delta"][1], d)); D(f"ablabs-{sc}-{var}-{m}", f(abs(v["delta"][0]), d))
    D(f"abl-{sc}-{var}-{m}-val", f(v["value"][0], d)); D(f"abl-{sc}-{var}-{m}-winsfull", str(v["wins_full"]))
for k, (mean, h) in N["capacity"].items():
    D(f"capsw-{k.replace('|', '-')}", f(mean, 3)); D(f"capsw-{k.replace('|', '-')}-ci", f(h, 3))
for k, (mean, h) in N["approval"].items():
    D(f"appr-{k.replace('|', '-')}", f(mean, 3)); D(f"appr-{k.replace('|', '-')}-ci", f(h, 3))
for k, (mean, h) in N["delay"].items():
    kk = k.replace("|", "-")
    D(f"delay-{kk}", sgn(mean, 3) if k.startswith("retro_gap") else f(mean, 3)); D(f"delay-{kk}-ci", f(h, 3))
if "retro" in N:
    for kk in ["delayed", "rescored", "immediate"]:
        D(f"retro-{kk}", f(N["retro"][kk][0], 0))
    D("retro-lag", f(N["retro"]["lag"][0], 1))
    D("retro-rr-delayed", f(N["retro_random_resolved_delayed"][0], 0))
D("env-routine", f(N["env_routine_share"], 0)); D("env-never", f(N["env_never_share"], 0))
D("env-delayed", f(N["env_delayed_share_of_resolvable"], 0)); D("env-selfreport", f(N["env_selfreport_share"], 0))
D("env-shockdays", f(N["env_shock_days"][0], 1)); D("nseeds", str(N["n_seeds"]))

# derived: best capacity-limited competitors in each scenario
WRITE_TIME = ["random", "recency", "recurrence", "similarity", "importance", "user_pref"]
LIMITED = WRITE_TIME + ["random_resolved", "user_pref_reward", "surprise", "surprise_greedy"]
for sc in SCEN:
    for grp, pols in [("heur", WRITE_TIME), ("limited", LIMITED)]:
        best = max(pols, key=lambda p: N["main"][f"{sc}|{p}"]["ndq_tr"][0])
        D(f"best{grp}-{sc}-name", NAMES[best].replace(r"\textbf{", "").replace("}", "")); D(f"best{grp}-{sc}-key", best)
        D(f"best{grp}-{sc}-val", f(N["main"][f"{sc}|{best}"]["ndq_tr"][0], 3))

# convergence diagnostics across every reported run
mg, nruns = 0.0, 0
for p in ["main", "ablation", "capacity", "approval", "delay"]:
    fp = f"{R}/{p}.pkl"
    if os.path.exists(fp):
        for r in pickle.load(open(fp, "rb")):
            mg = max(mg, r["fit_max_grad"]); nruns += 1
D("diag-maxgrad", f"{mg:.1e}".replace("e-0", r"\times10^{-").replace("e-", r"\times10^{-") + "}")
D("diag-nruns", f"{nruns:,}".replace(",", "{,}"))

# ------------------------------------------------ tables
def cell(sc, pol, m, bold=False):
    r = N["main"][f"{sc}|{pol}"][m]; d = DEC[m]
    s = f"{r[0]:.{d}f}" + r"{\scriptsize$\,\pm$" + f"{r[1]:.{d}f}" + "}"
    return r"\textbf{" + s + "}" if bold else s

with open(f"{T}/tab_main.tex", "w") as fh:
    fh.write(r"""\begin{table}[t]
\centering\small
\caption{Realistic scenario (delays, missing and noisy outcomes, shocks, approval bias), 20 seeds, mean $\pm$ 95\% CI. Decision quality and transfer: nights 40--59, 0 = random choice, 1 = optimal. Headroom: share of the oracle's advantage over random retention. Rows above the rule are capacity-limited ($C=300$); keep everything is unbounded.}
\label{tab:main}
\begin{tabular}{@{}lccccr@{}}
\toprule
Policy & Decision quality $\uparrow$ & Transfer $\uparrow$ & ECE$^\ast$ $\downarrow$ & Regret (\%) $\downarrow$ & Headroom\\
\midrule
""")
    for pol in ORDER:
        if pol == "oracle": fh.write(r"\midrule" + "\n")
        b = pol == "why"
        capv = N['capture']['realistic|' + pol]
        caps = f"{capv:.0f}\\%" if capv >= 0 else "$<$0\\%"
        fh.write(f"{NAMES[pol]} & {cell('realistic', pol, 'ndq_tr', b)} & {cell('realistic', pol, 'ndq_ho', b)} & {cell('realistic', pol, 'ece')} & {cell('realistic', pol, 'regret')} & {caps}\\\\\n")
    fh.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

with open(f"{T}/tab_scenarios.tex", "w") as fh:
    fh.write(r"""\begin{table}[t]
\centering\small
\caption{Decision quality across scenarios (mean over 20 seeds; nights 40--59 unless noted). Poison damage: change in decision quality over nights 25--44 relative to the same policy in the Realistic scenario on identical base streams. World change: nights 30--39 (first ten nights after the change) and 50--59.}
\label{tab:scenarios}
\setlength{\tabcolsep}{4.5pt}
\begin{tabular}{@{}lccccccc@{}}
\toprule
& & & \multicolumn{2}{c}{Poison damage (25--44)} & \multicolumn{2}{c}{World change} \\
\cmidrule(lr){4-5}\cmidrule(lr){6-7}
Policy & Clean & Realistic & self-report & verified & 30--39 & 50--59\\
\midrule
""")
    for pol in ORDER:
        if pol == "oracle": fh.write(r"\midrule" + "\n")
        g = lambda sc, m: f"{N['main'][sc + '|' + pol][m][0]:.3f}"
        dm = lambda sc: sgn(N["poison_damage"][sc + "|" + pol][0], 3)
        row = [NAMES[pol], g("clean", "ndq_tr"), g("realistic", "ndq_tr"), dm("poison"), dm("poison_verified"),
               g("world_change", "ndq_post_early"), g("world_change", "ndq_post_late")]
        fh.write(" & ".join(row) + r"\\" + "\n")
    fh.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

with open(f"{T}/tab_ablation.tex", "w") as fh:
    V = [("noS", "without Surprise $S$"), ("noC", "without Consequence $C$"), ("noK", "without Causal confidence $K$"),
         ("noT", "without Transferability $T$"), ("noU", "without Uncertainty reduction $U$"), ("noM", "without Manipulability discount"),
         ("noretro", "without retroactive tagging"), ("nogreedy", "without redundancy control"), ("prop", "with tag propagation")]
    fh.write(r"""\begin{table}[t]
\centering\small
\caption{Ablations of WHY (paired differences from the full method, 20 seeds, mean $\pm$ 95\% CI). Negative values mean the component helps. Poison share: percentage points of durable memory at night 34.}
\label{tab:ablation}
\begin{tabular}{@{}lcccc@{}}
\toprule
& Realistic & \multicolumn{3}{c}{Poisoning} \\
\cmidrule(lr){2-2}\cmidrule(lr){3-5}
Variant & $\Delta$ decision quality & $\Delta$ quality, nights 25--44 & $\Delta$ poison share & $\Delta$ ECE$^\ast$\\
\midrule
""")
    for v, lab in V:
        a = N["ablation"]
        def g(sc, m, d=3):
            e = a.get(f"{sc}|{v}|{m}")
            return "--" if e is None else sgn(e["delta"][0], d) + r"{\scriptsize$\,\pm$" + f"{e['delta'][1]:.{d}f}" + "}"
        fh.write(f"{lab} & {g('realistic', 'ndq_tr')} & {g('poison', 'ndq_pwin')} & {g('poison', 'poison34', 1)} & {g('poison', 'ece')}\\\\\n")
    fh.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

with open(f"{T}/tab_full.tex", "w") as fh:
    fh.write(r"""\begin{table}[H]
\centering\footnotesize
\caption{Full results by scenario (20 seeds; nights 40--59). DQ: decision quality; Tr: transfer; ECE$^\ast$: calibration error; Rg: regret (\% of random policy).}
\label{tab:full}
\setlength{\tabcolsep}{3pt}
\begin{tabular}{@{}l""" + "cccc" * 2 + r"""@{}}
\toprule
""")
    for block in [["clean", "realistic"], ["poison", "poison_verified"], ["world_change"]]:
        heads = {"clean": "Clean", "realistic": "Realistic", "poison": "Poisoning (self-report)", "poison_verified": "Poisoning (verified)", "world_change": "World change"}
        fh.write(" & " + " & ".join(r"\multicolumn{4}{c}{" + heads[s] + "}" for s in block) + r"\\" + "\n")
        fh.write(" & " + " & ".join(["DQ & Tr & ECE$^\\ast$ & Rg"] * len(block)) + r"\\" + "\n\\midrule\n")
        for pol in ORDER:
            cells = []
            for s in block:
                r = N["main"][f"{s}|{pol}"]
                cells += [f"{r['ndq_tr'][0]:.3f}", f"{r['ndq_ho'][0]:.3f}", f"{r['ece'][0]:.3f}", f"{r['regret'][0]:.1f}"]
            if len(block) == 1: cells += [""] * 4
            fh.write(NAMES[pol] + " & " + " & ".join(cells) + r"\\" + "\n")
        fh.write("\\midrule\n")
    fh.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")

if X:
    with open(f"{T}/tab_composition.tex", "w") as fh:
        fh.write(r"""\begin{table}[t]
\centering\small
\caption{What each policy remembered: composition of durable memory (\% of engrams, 20 seeds). Categories are exclusive, assigned in the order shown. Realistic at night 59; poison share from the Poisoning scenario at night 34, the end of the attack.}
\label{tab:composition}
\setlength{\tabcolsep}{5pt}
\begin{tabular}{@{}lcccccc@{}}
\toprule
& \multicolumn{5}{c}{Realistic, night 59} & Poisoning\\
\cmidrule(lr){2-6}\cmidrule(lr){7-7}
Policy & \shortstack{Never\\resolves} & \shortstack{Shock-\\confounded} & \shortstack{Corrupted\\report} & \shortstack{Routine\\duplicate} & Other & \shortstack{Poison\\(night 34)}\\
\midrule
""")
        for pol in ["random", "recency", "recurrence", "similarity", "importance", "user_pref", "surprise", "why", "oracle"]:
            c = X["composition"][f"realistic|{pol}"]; p = X["composition"][f"poison|{pol}"]
            fh.write(f"{NAMES[pol]} & {c[1]:.1f} & {c[2]:.1f} & {c[3]:.1f} & {c[4]:.1f} & {c[5]:.1f} & {p[0]:.1f}\\\\\n")
        fh.write("\\bottomrule\n\\end{tabular}\n\\end{table}\n")
        for pol in ["random", "recency", "recurrence", "similarity", "importance", "user_pref", "surprise", "why", "oracle"]:
            c = X["composition"][f"realistic|{pol}"]; p = X["composition"][f"poison|{pol}"]
            for i, nm in enumerate(["poison", "never", "shock", "flip", "routine", "other"]):
                D(f"comp-realistic-{pol}-{nm}", f(c[i], 1)); D(f"comp-poison-{pol}-{nm}", f(p[i], 1))
    dr = X["dream"]
    for k in ["night", "experiences_today", "outcomes_resolved", "consolidated", "beliefs_revised", "probe_size", "forgotten_tonight", "candidates", "poison_candidates", "poison_declined"]:
        D(f"dream-{k.replace('_', '')}", str(dr[k]))
    rm, dc = dr["remembered"], dr["declined"]
    for tag, e in [("rem", rm), ("dec", dc)]:
        for k in ["day", "family", "resolved_after_days", "outcome", "approval"]:
            D(f"dream-{tag}-{k.replace('_', '')}", str(e[k]))
        D(f"dream-{tag}-stakes", f(e["stakes"], 1)); D(f"dream-{tag}-predicted", f(e["predicted"], 2)); D(f"dream-{tag}-channel", e["channel"])
        for k in ["S", "C", "K", "T", "U", "M"]:
            D(f"dream-{tag}-{k}", f(e[k], 2))
        D(f"dream-{tag}-poison", "yes" if e["poison"] else "no")
    wc = dr["weight_change_week"]
    D("dream-wc-feature", str(wc["feature"])); D("dream-wc-before", sgn(wc["before"], 2)); D("dream-wc-after", sgn(wc["after"], 2)); D("dream-wc-true", sgn(wc["true"], 2))
    D("dream-spur", sgn(dr["spurious_weight"], 2))



# paired: WHY at capacity 1000 vs unbounded memory (realistic)
cap_r = pickle.load(open(f"{R}/capacity.pkl", "rb"))
w1000 = {r["spec"]["seed"]: r["ndq_tr"][40:].mean() for r in cap_r if r["spec"]["strategy"] == "why" and r["spec"].get("mem", {}).get("capacity") == 1000}
del cap_r
mm = pickle.load(open(f"{R}/main.pkl", "rb"))
ka = {r["spec"]["seed"]: r["ndq_tr"][40:].mean() for r in mm if r["spec"]["strategy"] == "keep_all" and r["spec"]["scenario"] == "realistic"}
del mm
from scipy import stats as _st
dd = np.array([w1000[s_] - ka[s_] for s_ in sorted(w1000)])
D("pair-cap1000-keep_all", sgn(dd.mean(), 3)); D("pair-cap1000-keep_all-ci", f(_st.t.ppf(0.975, len(dd) - 1) * dd.std(ddof=1) / np.sqrt(len(dd)), 3))
D("pair-cap1000-keep_all-p", f"{_st.ttest_1samp(dd, 0).pvalue:.2f}")

# ------------------------------------------------ derived quantities used in prose
M_ = N["main"]
D("waitshare", f(100 * (M_["realistic|random_resolved"]["ndq_tr"][0] - M_["realistic|random"]["ndq_tr"][0]) /
                 (M_["realistic|why"]["ndq_tr"][0] - M_["realistic|random"]["ndq_tr"][0]), 0))
D("ece-ratio-why-random", f(M_["realistic|why"]["ece"][0] / M_["realistic|random"]["ece"][0], 1))
res_main = pickle.load(open(f"{R}/main.pkl", "rb"))
for sc in ["poison", "poison_verified"]:
    for pol in ["why", "random", "random_resolved", "surprise", "importance", "user_pref", "oracle"]:
        rp, rh = [], []
        for r in res_main:
            if r["spec"]["scenario"] == sc and r["spec"]["strategy"] == pol:
                npz = r["cons_poison"].sum(); rp.append(npz / 200); rh.append((len(r["cons_poison"]) - npz) / 6000)
        D(f"pcons-{sc}-{pol}", f(100 * np.mean(rp), 0)); D(f"hcons-{sc}-{pol}", f(100 * np.mean(rh), 0))
        D(f"pratio-{sc}-{pol}", f(np.mean(rp) / np.mean(rh), 1))
del res_main
a = N["ablation"]
D("noM-poison-share-mult", f(a["poison|noM|poison34"]["value"][0] / N["main"]["poison|why"]["poison34"][0], 1))
D("noS-realistic-ece-val", f(a["realistic|noS|ece"]["value"][0], 3))
if os.path.exists(f"{R}/checks.json"):
    ck = json.load(open(f"{R}/checks.json"))
    D("check-vp-S-poison", f(ck["verified_poison_surprise"]["poison"], 2)); D("check-vp-S-honest", f(ck["verified_poison_surprise"]["honest"], 2))
    D("check-wc-full-early", f(ck["world_change_K"]["full"][0], 3)); D("check-wc-full-late", f(ck["world_change_K"]["full"][1], 3))
    D("check-wc-noK-early", f(ck["world_change_K"]["noK"][0], 3)); D("check-wc-noK-late", f(ck["world_change_K"]["noK"][1], 3))
if X:
    dr = X["dream"]; rm, dc = dr["remembered"], dr["declined"]
    def ep_sentence(e):
        when = "the same day" if e["resolved_after_days"] == 0 else (f"{e['resolved_after_days']} day" + ("s" if e["resolved_after_days"] != 1 else "") + " later")
        res_ = "it succeeded" if e["outcome"] == 1 else "it failed"
        return when, res_
    w1, r1 = ep_sentence(rm); w2, r2 = ep_sentence(dc)
    tier = {0: "low", 1: "medium", 2: "high"}
    box = r"""\begin{figure}[t]
\begin{tcolorbox}[colback=white,colframe=hair,boxrule=0.6pt,arc=3pt,left=10pt,right=10pt,top=8pt,bottom=8pt,fontupper=\small]
{\sffamily\bfseries\large WHY dreamed.}\hfill{\sffamily\footnotesize\color{ink2} Simulation run: Poisoning scenario, seed %(seed)d, night %(night)d}\\[6pt]
{\sffamily
\begin{tabular}{@{}r@{\hspace{6pt}}l@{\hspace{2.5em}}r@{\hspace{6pt}}l@{}}
\textbf{%(exp)d} & experiences today & \textbf{%(cons)d} & memories consolidated\\
\textbf{%(res)d} & outcomes resolved tonight & \textbf{%(rev)d} & of %(probe)d probe decisions changed\\
\textbf{%(cand)d} & resolved episodes competed for the slots & \textbf{%(forg)d} & forgotten tonight\\
\end{tabular}}\\[6pt]
\textbf{We remembered this.} A %(rtier)s-stakes decision from day %(rday)d. Its %(rchan)s outcome arrived %(rwhen)s: we had predicted a %(rpred)s chance of success, and %(rres)s. (Surprise %(rS)s, consequence %(rC)s, causal confidence %(rK)s, uncertainty reduction %(rU)s.)\\[4pt]
\textbf{We declined this.} The most important-looking episode we did not keep: a decision from day %(dday)d with a thumbs-up, maximal drama, and a %(dchan)s outcome that arrived %(dwhen)s saying %(dres)s. Manipulable channel, discount applied.%(dpois)s Tonight %(pdeclphrase)s poisoned episodes in the buffer were declined.\\[4pt]
\textbf{We changed our mind about this.} The belief that moved furthest toward the truth this week: the weight on rule feature %(wf)d went from %(wb)s to %(wa)s (true value %(wt)s). The weight on the feature the campaign was promoting stands at %(sp)s (true value 0).
\end{tcolorbox}
\vspace{-6pt}
\caption{A dream report generated from Experiment~1. Counts, factor values, and weights are read from the run; the wording is a fixed template. The belief shown is the rule weight whose error fell most over the past week, and ground truth is visible only because this is a simulation.}
\label{fig:dream}
\end{figure}
""" % dict(seed=dr["seed"], night=dr["night"], exp=dr["experiences_today"], cons=dr["consolidated"], res=dr["outcomes_resolved"],
           rev=dr["beliefs_revised"], probe=dr["probe_size"], cand=dr["candidates"], forg=dr["forgotten_tonight"],
           rtier=tier[rm["stakes_tier"]], rday=rm["day"], rchan=("self-reported" if rm["channel"] == "self-report" else rm["channel"]), rwhen=w1, rpred=f"{100*rm['predicted']:.0f}\\%", rres=r1,
           rS=f(rm["S"], 2), rC=f(rm["C"], 2), rK=f(rm["K"], 2), rU=f(rm["U"], 2),
           dday=dc["day"], dchan=("self-reported" if dc["channel"] == "self-report" else dc["channel"]), dwhen=w2, dres=("it worked" if dc["outcome"] == 1 else "it failed"),
           dpois=(" [Ground truth: poisoned.]" if dc["poison"] else " [Ground truth: honest.]"),
           pdeclphrase=(f"all {dr['poison_candidates']}" if dr["poison_declined"] == dr["poison_candidates"] else f"{dr['poison_declined']} of the {dr['poison_candidates']}"),
           wf=dr["weight_change_week"]["feature"], wb=sgn(dr["weight_change_week"]["before"], 2), wa=sgn(dr["weight_change_week"]["after"], 2),
           wt=sgn(dr["weight_change_week"]["true"], 2), sp=sgn(dr["spurious_weight"], 2))
    open(f"{T}/dream_box.tex", "w").write(box)

open(f"{T}/numbers.tex", "w").write("\n".join(lines) + "\n")
print("wrote numbers.tex with", len(lines), "lines")

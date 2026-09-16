"""Aggregate results into numbers.json + LaTeX macros + CSV tables. Every number quoted in the
paper is generated here from the result pickles."""
import pickle, json, os, sys, collections
import numpy as np
from scipy import stats

R = "../results"
LATE = slice(40, 60)          # late-phase window (nights 40-59)
PWIN = slice(25, 45)          # poison window + 10 nights after
POST = slice(30, 60)          # after world change

def load(name):
    p = f"{R}/{name}.pkl"
    return pickle.load(open(p, "rb")) if os.path.exists(p) else []

def ci(x):
    x = np.asarray(x, float)
    n = len(x)
    m = x.mean()
    if n < 2:
        return m, 0.0
    h = stats.t.ppf(0.975, n - 1) * x.std(ddof=1) / np.sqrt(n)
    return m, h

def key(sp):
    return (sp["scenario"], sp["strategy"], tuple(sp.get("ablate", ())), tuple(sorted(sp.get("mem", {}).items())), tuple(sorted(sp.get("env", {}).items())))

def index(results):
    d = collections.defaultdict(dict)
    for r in results:
        d[key(r["spec"])][r["spec"]["seed"]] = r
    return d

def metric(r, m):
    if m == "ndq_tr": return r["ndq_tr"][LATE].mean()
    if m == "ndq_ho": return r["ndq_ho"][LATE].mean()
    if m == "ece": return r["ece"][LATE].mean()
    if m == "regret": return 100 * r["regret"].sum() / r["rand_regret"].sum()
    if m == "ndq_pwin": return r["ndq_tr"][PWIN].mean()
    if m == "ndq_post_early": return r["ndq_tr"][30:40].mean()
    if m == "ndq_post_late": return r["ndq_tr"][50:60].mean()
    if m == "poison34": return 100 * r["c_poison"][34]
    if m == "spur_peak": return np.abs(r["spur_w"][PWIN]).max()
    if m == "never59": return 100 * r["c_never"][59]
    if m == "shock59": return 100 * r["c_shock"][59]
    if m == "flip59": return 100 * r["c_flip"][59]
    if m == "routine59": return 100 * r["c_routine"][59]
    if m == "pending59": return 100 * r["c_pending"][59]
    raise KeyError(m)

def series(d, k, m, seeds):
    return np.array([metric(d[k][s], m) for s in seeds if s in d[k]])

NAMES = dict(random="Random", random_resolved="Random (resolved only)", recency="Recency (FIFO)", recurrence="Recurrence",
             similarity="Similarity to recent queries", importance="Self-rated importance", user_pref="User preference (selection)",
             user_pref_reward="User preference (as reward)", surprise="Surprise (PER-style)", surprise_greedy="Surprise (greedy top-B)",
             why="WHY (consequence-weighted)", oracle="Counterfactual oracle", keep_all="Keep everything (unbounded)")

def main():
    out = {}
    main_r = load("main")
    d = index(main_r)
    seeds = sorted({r["spec"]["seed"] for r in main_r})
    out["n_seeds"] = len(seeds)
    strategies = [s for s in NAMES if any(k[1] == s and k[2] == () for k in d)]
    scen = ["clean", "realistic", "poison", "poison_verified", "world_change"]
    tab = {}
    for sc in scen:
        for st in strategies:
            k = (sc, st, (), (), ())
            if k not in d: continue
            row = {}
            for m in ["ndq_tr", "ndq_ho", "ece", "regret", "ndq_pwin", "ndq_post_early", "ndq_post_late", "poison34",
                      "spur_peak", "never59", "shock59", "flip59", "routine59", "pending59"]:
                x = series(d, k, m, seeds)
                row[m] = ci(x)
            tab[f"{sc}|{st}"] = row
    out["main"] = tab

    # oracle headroom capture (on seed means)
    cap = {}
    for sc in scen:
        try:
            rnd = tab[f"{sc}|random"]["ndq_tr"][0]; orc = tab[f"{sc}|oracle"]["ndq_tr"][0]
            for st in strategies:
                cap[f"{sc}|{st}"] = 100 * (tab[f"{sc}|{st}"]["ndq_tr"][0] - rnd) / (orc - rnd)
        except KeyError:
            pass
    out["capture"] = cap

    # paired: WHY minus each baseline
    paired = {}
    for sc in scen:
        kw = (sc, "why", (), (), ())
        if kw not in d: continue
        for st in strategies:
            kb = (sc, st, (), (), ())
            if st == "why" or kb not in d: continue
            for m in ["ndq_tr", "ndq_ho", "ece", "regret"]:
                a = series(d, kw, m, seeds); b = series(d, kb, m, seeds)
                diff = a - b
                mm, h = ci(diff)
                wins = int((diff > 0).sum()) if m in ("ndq_tr", "ndq_ho") else int((diff < 0).sum())
                paired[f"{sc}|{st}|{m}"] = dict(mean=mm, ci=h, wins=wins, p=float(stats.ttest_rel(a, b).pvalue) if len(a) > 1 else None)
    out["paired"] = paired

    # poison damage: paired vs realistic on identical base streams
    dmg = {}
    for psc in ["poison", "poison_verified"]:
        for st in strategies:
            kp, kr = (psc, st, (), (), ()), ("realistic", st, (), (), ())
            if kp not in d or kr not in d: continue
            a = series(d, kp, "ndq_pwin", seeds); b = series(d, kr, "ndq_pwin", seeds)
            dmg[f"{psc}|{st}"] = ci(a - b)
    out["poison_damage"] = dmg

    # mean curves for figures
    curves = {}
    for sc in scen:
        for st in strategies:
            k = (sc, st, (), (), ())
            if k not in d: continue
            curves[f"{sc}|{st}"] = dict(ndq_tr=np.mean([d[k][s]["ndq_tr"] for s in seeds], 0).tolist(),
                                        ndq_ho=np.mean([d[k][s]["ndq_ho"] for s in seeds], 0).tolist(),
                                        spur=np.mean([np.abs(d[k][s]["spur_w"]) for s in seeds], 0).tolist(),
                                        poison=np.mean([d[k][s]["c_poison"] for s in seeds], 0).tolist())
    out["curves"] = curves

    # retroactive tagging statistics for WHY (realistic)
    k = ("realistic", "why", (), (), ())
    if k in d:
        imm, delayed, rescored, lags = [], [], [], []
        for s in seeds:
            r = d[k][s]
            cd, ct, cn = r["cons_day"], r["cons_tau"], r["cons_night"]
            n = len(cd)
            delayed.append(100 * np.mean(ct > cd))
            rescored.append(100 * np.mean((ct <= cd) & (cn > cd)))
            imm.append(100 * np.mean((ct <= cd) & (cn == cd)))
            lags.append(np.mean(cn - cd))
        out["retro"] = dict(delayed=ci(delayed), rescored=ci(rescored), immediate=ci(imm), lag=ci(lags))
    # same categories for resolved-only random, for comparison
    k = ("realistic", "random_resolved", (), (), ())
    if k in d:
        delayed = [100 * np.mean(d[k][s]["cons_tau"] > d[k][s]["cons_day"]) for s in seeds]
        out["retro_random_resolved_delayed"] = ci(delayed)
    # share of all resolvable episodes that are delayed (environment property)
    try:
        import why_sim as W
        dl, nv, sr, rt, sd = [], [], [], [], []
        for s in seeds:
            w = W.make_world(s, W.make_env("realistic"))
            fin = w["tau"] < W.BIG
            dl.append(100 * np.mean(w["tau"][fin] > w["day"][fin])); nv.append(100 * np.mean(~fin))
            sr.append(100 * np.mean(w["selfrep"])); rt.append(100 * np.mean(w["routine"])); sd.append(int(w["shock_day"][:60].sum()))
        out["env_delayed_share_of_resolvable"] = float(np.mean(dl))
        out["env_never_share"] = float(np.mean(nv))
        out["env_selfreport_share"] = float(np.mean(sr))
        out["env_routine_share"] = float(np.mean(rt))
        out["env_shock_days"] = ci(sd)
    except Exception as e:
        print("env stats failed", e)

    # ablations
    ab = index(load("ablation"))
    abl = {}
    for sc in ["realistic", "poison"]:
        full = (sc, "why", (), (), ())
        if full not in d: continue
        for v in ["noS", "noC", "noK", "noT", "noU", "noM", "noretro", "nogreedy", "prop"]:
            kv = (sc, "why", (v,), (), ())
            if kv not in ab: continue
            for m in ["ndq_tr", "ndq_ho", "ndq_pwin", "ece", "poison34"]:
                a = np.array([metric(ab[kv][s], m) for s in seeds if s in ab[kv]])
                b = np.array([metric(d[full][s], m) for s in seeds if s in ab[kv]])
                abl[f"{sc}|{v}|{m}"] = dict(delta=ci(a - b), value=ci(a), wins_full=int(((b - a) > 0).sum()))
    out["ablation"] = abl

    # capacity sweep
    cp = index(load("capacity"))
    capt = {}
    for st in ["random_resolved", "importance", "surprise", "why", "oracle"]:
        for M in [50, 100, 300, 1000]:
            kk = ("realistic", st, (), (("capacity", M),), ()) if M != 300 else ("realistic", st, (), (), ())
            src = d if M == 300 else cp
            if kk not in src: continue
            capt[f"{st}|{M}"] = ci([metric(src[kk][s], "ndq_tr") for s in seeds if s in src[kk]])
    if ("realistic", "keep_all", (), (), ()) in d:
        capt["keep_all"] = tab["realistic|keep_all"]["ndq_tr"]
    out["capacity"] = capt

    # approval sweep
    ap = index(load("approval"))
    apt = {}
    for st in ["random_resolved", "user_pref", "user_pref_reward", "why"]:
        for b in [0.0, 0.75, 1.5, 3.0]:
            kk = ("realistic", st, (), (), (("approval_bias", b),)) if b != 1.5 else ("realistic", st, (), (), ())
            src = d if b == 1.5 else ap
            if kk not in src: continue
            apt[f"{st}|{b}"] = ci([metric(src[kk][s], "ndq_tr") for s in seeds if s in src[kk]])
    out["approval"] = apt

    # delay sweep
    dl = index(load("delay"))
    dlt = {}
    for ds in [0.0, 1.0, 1.6]:
        for st, abl_ in [("random_resolved", ()), ("surprise", ()), ("why", ()), ("importance", ()), ("why", ("noretro",))]:
            if ds == 1.0:
                kk = ("realistic", st, abl_, (), ())
                src = ab if abl_ else d
            else:
                kk = ("realistic", st, abl_, (), (("delay_scale", ds),))
                src = dl
            if kk not in src: continue
            nm = st + ("_noretro" if abl_ else "")
            dlt[f"{nm}|{ds}"] = ci([metric(src[kk][s], "ndq_tr") for s in seeds if s in src[kk]])
        # paired retro gap
        if ds == 1.0:
            ka, kb, sa, sb = ("realistic", "why", (), (), ()), ("realistic", "why", ("noretro",), (), ()), d, ab
        else:
            ka, kb, sa, sb = ("realistic", "why", (), (), (("delay_scale", ds),)), ("realistic", "why", ("noretro",), (), (("delay_scale", ds),)), dl, dl
        if ka in sa and kb in sb:
            dlt[f"retro_gap|{ds}"] = ci([metric(sa[ka][s], "ndq_tr") - metric(sb[kb][s], "ndq_tr") for s in seeds if s in sb[kb]])
    out["delay"] = dlt

    def conv(o):
        if isinstance(o, dict): return {k: conv(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)): return [conv(v) for v in o]
        if isinstance(o, (np.floating, np.integer)): return o.item()
        return o
    json.dump(conv(out), open(f"{R}/numbers.json", "w"), indent=1)
    print("wrote numbers.json")

if __name__ == "__main__":
    main()

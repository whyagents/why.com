"""Exclusive memory-composition breakdown and a dream report from a recorded WHY run.
Re-runs policies with record=True (same code path as the suites)."""
import json, sys, numpy as np
from multiprocessing import Pool
import why_sim as W

SEEDS = list(range(20))
POLS = ["random", "recency", "recurrence", "similarity", "importance", "user_pref", "surprise", "why", "oracle"]
CATS = ["Poison", "Never resolves", "Shock-confounded", "Corrupted self-report", "Routine duplicate", "Other"]

def composition(args):
    sc, seed, pol, night = args
    w = W.make_world(seed, W.make_env(sc))
    o = W.run(w, pol, record=True)
    cap = W.BASE_MEM["capacity"]
    sels = [rec["sel"] for rec in o["dream"][: night + 1]]
    dur = np.concatenate(sels)[-cap:] if len(sels) else np.zeros(0, int)
    tau = w["tau"][dur]
    cat = np.full(len(dur), 5)
    cat[w["routine"][dur]] = 4
    cat[o["flipped"][dur]] = 3
    cat[o["shock_aff"][dur]] = 2
    cat[tau >= W.BIG] = 1
    cat[w["poison"][dur]] = 0
    return sc, seed, pol, np.bincount(cat, minlength=6) / max(len(dur), 1)

def dream_report(seed=0, sc="poison", night=30):
    w = W.make_world(seed, W.make_env(sc))
    o = W.run(w, "why", record=True)
    rec, prev = o["dream"][night], o["dream"][night - 1]
    wl = rec["why"]
    c, picked = wl["c"], wl["picked"]
    lv = np.log(w["v"]); zst = (lv - lv.mean()) / lv.std()
    def describe(pos):
        i = int(c[pos])
        return dict(task=i, day=int(w["day"][i]), family=int(w["fam"][i]), stakes=float(w["v"][i]),
                    stakes_tier=int(w["tiers"][w["fam"][i]]), resolved_after_days=int(min(w["tau"][i], 10**6) - w["day"][i]),
                    channel="self-report" if w["selfrep"][i] else "verified", poison=bool(w["poison"][i]),
                    predicted=float(wl["p"][pos]), outcome=int(o["yobs"][i]), approval=int(o["appr"][i]),
                    drama=float(w["drama"][i]), rater_importance=float(w["drama"][i] + 0.5 * zst[i] + w["rater_noise"][i]),
                    S=float(wl["S"][pos]), C=float(wl["C"][pos]), K=float(wl["K"][pos]), T=float(wl["T"][pos]),
                    U=float(wl["U"][pos]), M=float(wl["M"][pos]))
    top = describe(int(picked[0]))
    not_picked = np.setdiff1d(np.arange(len(c)), picked)
    # the most "important-looking" episode WHY declined, by the simulated importance rater
    rater = np.array([w["drama"][c[j]] + 0.5 * zst[c[j]] + w["rater_noise"][c[j]] for j in not_picked])
    declined = describe(int(not_picked[int(np.argmax(rater))]))
    n_poison_declined = int(w["poison"][c[not_picked]].sum())
    n_poison_cands = int(w["poison"][c].sum())
    dth = rec["theta"] - prev["theta"]
    k = int(np.argmax(np.abs(dth[1:9]))) + 1
    theta_hist = np.array([r["theta"] for r in o["dream"]])
    # largest belief revision over the week before, for a more meaningful "changed our mind"
    # the rule-feature belief that moved furthest toward its true value over the past week
    err_prev = np.abs(theta_hist[night - 7, 1:9] - w["theta"][1:9]); err_now = np.abs(theta_hist[night, 1:9] - w["theta"][1:9])
    j = int(np.argmax(err_prev - err_now)) + 1
    tasks_today = int(o["n_tasks"][night])
    resolved = int((w["tau"] == night).sum())
    return dict(seed=seed, scenario=sc, night=night, experiences_today=tasks_today, outcomes_resolved=resolved,
                consolidated=int(len(rec["sel"])), beliefs_revised=int(o["revised"][night]), probe_size=int(W.BASE_ENV["n_probe"]),
                forgotten_tonight=int(len(rec["expiring"])), candidates=int(len(c)),
                poison_candidates=n_poison_cands, poison_declined=n_poison_declined,
                remembered=top, declined=declined,
                weight_change_night=dict(feature=k, before=float(prev["theta"][k]), after=float(rec["theta"][k]), true=float(w["theta"][k])),
                weight_change_week=dict(feature=j, before=float(theta_hist[night - 7, j]), after=float(theta_hist[night, j]), true=float(w["theta"][j])),
                spurious_weight=float(rec["theta"][W.SPUR]))

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "dream":
    X = json.load(open("../results/extras.json"))
    X["dream"] = dream_report(); X["dream_realistic"] = dream_report(seed=0, sc="realistic", night=45)
    json.dump(X, open("../results/extras.json", "w"), indent=1)
    print(json.dumps(X["dream"]["weight_change_week"]))
elif __name__ == "__main__":
    jobs = [(sc, s, p, night) for sc, night in [("realistic", 59), ("poison", 34)] for s in SEEDS for p in POLS]
    with Pool(2) as pool:
        res = pool.map(composition, jobs, chunksize=2)
    comp = {}
    for sc, seed, pol, frac in res:
        comp.setdefault(f"{sc}|{pol}", []).append(frac)
    comp = {k: (100 * np.mean(v, 0)).tolist() for k, v in comp.items()}
    dr = dream_report()
    dr2 = dream_report(seed=0, sc="realistic", night=45)
    json.dump(dict(categories=CATS, composition=comp, dream=dr, dream_realistic=dr2), open("../results/extras.json", "w"), indent=1)
    print(json.dumps(dr, indent=1))

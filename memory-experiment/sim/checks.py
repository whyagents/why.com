"""Two targeted checks quoted in the paper: (1) does causal confidence slow recovery after a real
world change? (2) how surprising are poisoned outcomes when they arrive through the verified channel?"""
import json, numpy as np, why_sim as W

out = {}
for var in [(), ("noK",)]:
    early, late = [], []
    for s in range(20):
        w = W.make_world(s, W.make_env("world_change"))
        o = W.run(w, "why", ablate=var)
        early.append(o["ndq_tr"][30:40].mean()); late.append(o["ndq_tr"][50:60].mean())
    out["full" if not var else "noK"] = (float(np.mean(early)), float(np.mean(late)))
Sp, Sh, Pp, Ph = [], [], [], []
for s in range(5):
    w = W.make_world(s, W.make_env("poison_verified"))
    o = W.run(w, "why", record=True)
    for night in range(25, 35):
        wl = o["dream"][night]["why"]
        c = wl["c"]; isp = w["poison"][c]
        Sp += list(wl["S"][isp]); Sh += list(wl["S"][~isp])
        picked = np.zeros(len(c), bool); picked[wl["picked"]] = True
        Pp.append(picked[isp].mean() if isp.any() else np.nan); Ph.append(picked[~isp].mean())
json.dump(dict(world_change_K=out, verified_poison_surprise=dict(poison=float(np.mean(Sp)), honest=float(np.mean(Sh)),
          sel_poison=float(np.nanmean(Pp)), sel_honest=float(np.mean(Ph)))), open("../results/checks.json", "w"), indent=1)
print(open("../results/checks.json").read())

import sys, pickle, time, itertools, os
import numpy as np
from multiprocessing import Pool
import why_sim as W

KEEP = ["ndq_tr", "ndq_ho", "ece", "spur_w", "revised", "regret", "rand_regret", "dur_size", "c_routine",
        "c_never", "c_shock", "c_flip", "c_poison", "c_pending", "n_resolved", "n_forgotten",
        "n_consolidated", "n_tasks", "cons_day", "cons_tau", "cons_night", "cons_poison", "final_theta", "fit_max_grad"]

_world_cache = {}

def job(spec):
    scen, seed, strat, ablate, mem, envo = spec["scenario"], spec["seed"], spec["strategy"], spec.get("ablate", ()), spec.get("mem", {}), spec.get("env", {})
    key = (scen, seed, tuple(sorted(envo.items())))
    if key not in _world_cache:
        _world_cache.clear()
        _world_cache[key] = W.make_world(seed, W.make_env(scen, **envo))
    w = _world_cache[key]
    t = time.time()
    o = W.run(w, strat, mem=mem, ablate=ablate)
    res = {k: o[k] for k in KEEP}
    res["spec"] = spec
    res["secs"] = time.time() - t
    return res

def run_jobs(specs, out_path, procs=2):
    t = time.time()
    # group by world so the per-process cache is effective
    specs = sorted(specs, key=lambda s: (s["scenario"], s["seed"], str(sorted(s.get("env", {}).items()))))
    results = []
    with Pool(procs) as pool:
        for i, res in enumerate(pool.imap(job, specs, chunksize=4)):
            results.append(res)
            if (i + 1) % 50 == 0:
                print(f"  {out_path}: {i+1}/{len(specs)} ({time.time()-t:.0f}s)", flush=True)
    with open(out_path, "wb") as f:
        pickle.dump(results, f)
    print(f"{out_path}: {len(results)} runs in {time.time()-t:.0f}s")
    return results

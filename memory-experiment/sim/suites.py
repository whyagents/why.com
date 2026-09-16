import sys, runner, why_sim as W

SEEDS = list(range(20))          # held-out evaluation seeds (dev seeds were 1000-1004)
VARIANTS = ["noS", "noC", "noK", "noT", "noU", "noM", "noretro", "nogreedy", "prop"]

def suite_main():
    return [dict(scenario=sc, seed=s, strategy=st) for sc in W.SCENARIOS for s in SEEDS for st in W.STRATEGIES]

def suite_ablation():
    return [dict(scenario=sc, seed=s, strategy="why", ablate=(v,)) for sc in ["realistic", "poison"] for s in SEEDS for v in VARIANTS]

def suite_capacity():
    return [dict(scenario="realistic", seed=s, strategy=st, mem=dict(capacity=M))
            for M in [50, 100, 1000] for s in SEEDS for st in ["random_resolved", "importance", "surprise", "why", "oracle"]]

def suite_approval():
    return [dict(scenario="realistic", seed=s, strategy=st, env=dict(approval_bias=b))
            for b in [0.0, 0.75, 3.0] for s in SEEDS for st in ["random_resolved", "user_pref", "user_pref_reward", "why"]]

def suite_delay():
    out = []
    for ds in [0.0, 1.6]:
        for s in SEEDS:
            for st in ["random_resolved", "surprise", "why", "importance"]:
                out.append(dict(scenario="realistic", seed=s, strategy=st, env=dict(delay_scale=ds)))
            out.append(dict(scenario="realistic", seed=s, strategy="why", ablate=("noretro",), env=dict(delay_scale=ds)))
    return out

if __name__ == "__main__":
    name = sys.argv[1]
    specs = globals()["suite_" + name]()
    runner.run_jobs(specs, f"../results/{name}.pkl")

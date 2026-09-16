"""Independent checks: (1) every \val key used in the TeX exists; (2) a sample of headline numbers is
recomputed directly from raw pickles (not via analysis.py) and compared with the macros; (3) the compiled
PDF has no unresolved macros or references."""
import re, glob, pickle, subprocess, numpy as np, sys

T = "../tex"
macros = dict(re.findall(r"\\defnum\{([^}]*)\}\{(.*)\}", open(f"{T}/numbers.tex").read()))
used = set()
for fn in glob.glob(f"{T}/*.tex"):
    if fn.endswith("numbers.tex"): continue
    src = open(fn).read()
    used |= set(re.findall(r"\\val\{([^}]*)\}", src))
    used |= {"env-" + k for k in re.findall(r"\\env\{([^}]*)\}", src)}
missing = sorted(k for k in used if k not in macros)
print(f"[1] macro keys used: {len(used)}, missing: {missing if missing else 'none'}")

main = pickle.load(open("../results/main.pkl", "rb"))
def raw(sc, pol, fn):
    return np.array([fn(r) for r in main if r["spec"]["scenario"] == sc and r["spec"]["strategy"] == pol])
checks = [
    ("realistic-why-ndq_tr", raw("realistic", "why", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("realistic-random_resolved-ndq_tr", raw("realistic", "random_resolved", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("realistic-keep_all-ndq_tr", raw("realistic", "keep_all", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("realistic-oracle-ndq_tr", raw("realistic", "oracle", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("realistic-why-ece", raw("realistic", "why", lambda r: r["ece"][40:60].mean()).mean(), 3),
    ("realistic-random-ece", raw("realistic", "random", lambda r: r["ece"][40:60].mean()).mean(), 3),
    ("world_change-keep_all-ndq_tr", raw("world_change", "keep_all", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("world_change-why-ndq_tr", raw("world_change", "why", lambda r: r["ndq_tr"][40:60].mean()).mean(), 3),
    ("poison_verified-why-poison34", raw("poison_verified", "why", lambda r: 100 * r["c_poison"][34]).mean(), 1),
    ("realistic-why-regret", (lambda a: a.mean())(raw("realistic", "why", lambda r: 100 * r["regret"].sum() / r["rand_regret"].sum())), 1),
]
for sc_, pol_ in [("poison", "why"), ("poison", "importance"), ("poison_verified", "why"), ("poison_verified", "random")]:
    a = raw(sc_, pol_, lambda r: r["ndq_tr"][25:45].mean()); b = raw("realistic", pol_, lambda r: r["ndq_tr"][25:45].mean())
    checks.append((f"dmg-{sc_}-{pol_}", (a - b).mean(), 3))
ok = True
for key, value, d in checks:
    shown = macros.get(key, "MISSING").replace("$-$", "-").replace("+", "")
    expect = f"{value:.{d}f}"
    match = abs(float(shown) - float(expect)) < 1.5 * 10 ** (-d) if shown != "MISSING" else False
    ok &= match
    print(f"[2] {key:34s} macro={macros.get(key)!s:>9s} raw={expect:>8s} {'OK' if match else 'MISMATCH'}")
print("[2] all recomputed numbers match" if ok else "[2] MISMATCHES FOUND")
txt = subprocess.run(["pdftotext", f"{T}/main.pdf", "-"], capture_output=True, text=True).stdout
bad = [m for m in ["??", "[?]"] if m in txt]
print(f"[3] PDF pages: {subprocess.run(['pdfinfo', f'{T}/main.pdf'], capture_output=True, text=True).stdout.split('Pages:')[1].split()[0]}; unresolved markers: {bad if bad else 'none'}")
log = open(f"{T}/main.log").read()
warn = [l for l in log.splitlines() if "undefined" in l.lower() or "Citation" in l and "undefined" in l]
print(f"[3] undefined refs/citations in log: {len(warn)}")
for l in warn[:10]: print("    ", l)

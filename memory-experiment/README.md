# Every Memory Needs a WHY: Experiment 1 code and results

Controlled simulation of capacity-limited memory consolidation for a continual decision-making agent.

## Layout
- `sim/why_sim.py`: environment, agent, 13 consolidation policies, counterfactual oracle
- `sim/runner.py`, `sim/suites.py`: parallel experiment suites (main, ablation, capacity, approval, delay)
- `sim/analysis.py`: aggregates raw runs into `results/numbers.json`
- `sim/extras.py`: exclusive memory-composition breakdown and the dream report (`results/extras.json`)
- `sim/checks.py`: two targeted checks quoted in the paper (`results/checks.json`)
- `sim/verify.py`: recomputes headline numbers from raw runs and checks the compiled PDF
- `sim/figs.py`: figures (`figs/*.pdf`)
- `sim/make_tex.py`: LaTeX macros and tables; every number in the paper is generated here
- `FREEZE.md`: parameters frozen before evaluation, and protocol deviations
- `results/*.pkl`: raw per-run results (per-night series for every run)

## Reproduce
```
cd sim
python3 suites.py main && python3 suites.py ablation && python3 suites.py capacity && python3 suites.py approval && python3 suites.py delay
python3 analysis.py && python3 extras.py && python3 checks.py && python3 figs.py && python3 make_tex.py
cd ../tex && pdflatex main && bibtex main && pdflatex main && pdflatex main
cd ../sim && python3 verify.py
```
Requires Python 3 with numpy, scipy, matplotlib. Two cores take roughly 40 minutes for all suites.

Evaluation seeds are 0-19; development seeds were 1000-1004. `results/discarded_main_buggy_solver.pkl` is the discarded first evaluation run (see FREEZE.md, deviation 3), kept for transparency.

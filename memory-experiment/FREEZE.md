# Experiment 1 freeze record

Frozen before any evaluation-seed run (evaluation seeds 0-19; development seeds 1000-1004).

Environment (BASE_ENV), memory (BASE_MEM) and WHY hyperparameters (WHY_HP) are exactly as in
sim/why_sim.py at freeze time. WHY_HP were set a priori and were not changed after development runs.

Protocol deviations after development runs (none touch WHY or environment parameters):
1. The surprise baseline was changed from greedy top-B |error| selection to PER-style stochastic
   prioritized sampling (P ~ (|error| + 0.01)^0.6, Schaul et al. 2016), because greedy top-B collapsed
   and would have been a strawman. The greedy version is still run and reported as `surprise_greedy`.
2. World generation was restructured so all random variables are drawn unconditionally and poison
   episodes come from a separate generator (common random numbers across scenarios). This fixed a
   bug that made realistic-vs-poison comparisons unpaired.
3. After the first full evaluation run, a keep-everything outlier (seed 12, decision quality 0.73) was traced
   to a numerical bug: the undamped Newton solver for the logistic MAP fit oscillated without converging
   on large or ill-conditioned memories (final gradient norms up to ~1e3). It affected several baselines on
   some seeds (and could affect any policy). The solver was replaced by damped Newton with Armijo
   backtracking; every run now records its worst final gradient (all < 1e-4 in reported runs). All results
   from the first evaluation run were discarded and every suite was re-run from scratch. No policy,
   environment or WHY hyperparameter was changed.

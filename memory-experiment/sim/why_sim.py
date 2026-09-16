"""
Every Memory Needs a WHY -- Experiment 1: controlled consolidation simulation.

A continual "three doors" decision environment. Each day an agent faces tasks with K=3
options, acts with Thompson sampling from a Bayesian logistic model, and observes
consequences that may be immediate, delayed, never resolved, noisy, confounded by
exogenous shocks, or deliberately poisoned. Each night a consolidation strategy chooses
which episodes from a short-lived episodic buffer are written into a capacity-limited
durable memory. The agent's model (its "weights") is refit only on durable memory.

All randomness is pre-drawn per world (common random numbers across strategies).
"""
import numpy as np

P, D, K = 12, 13, 3          # 12 option features + intercept; 3 options ("doors")
AGREE, SPUR = 9, 10          # x-index of agreeableness feature and of the poison's spurious feature
BIG = 10 ** 9                # "never resolves"

BASE_ENV = dict(
    n_days=60, tasks_per_day=100, n_train_fam=8, n_heldout_fam=3,
    routine_share=0.35, protos_per_fam=2,
    delay=True, delay_scale=1.0, never_share=0.2,
    channels=True, self_report_share=0.3, self_report_flip=0.2,
    approval_bias=1.5, approval_quality=1.5,
    drama=True,
    shocks=True, shock_rate=0.07, shock_fail=0.6,
    poison=None, poison_start=25, poison_end=35, poison_per_day=20,
    world_change=False, change_day=30,
    n_probe=500,
)

SCENARIOS = {
    "clean": dict(delay=False, never_share=0.0, channels=False, approval_bias=0.0, drama=False, shocks=False),
    "realistic": dict(),
    "poison": dict(poison="self"),
    "poison_verified": dict(poison="verified"),
    "world_change": dict(world_change=True),
}

BASE_MEM = dict(buffer_days=8, budget=20, capacity=300, prior_sd=1.5)

# WHY hyperparameters: fixed a priori (before any evaluation run).
WHY_HP = dict(eps=0.05, lam_m=0.7, k_center=3.0, k_slope=2.0, t_len2=8.0, t_ref_days=2, prop_eta=1.0)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


# ----------------------------------------------------------------------------- world
def make_env(scenario, **overrides):
    env = dict(BASE_ENV)
    env.update(SCENARIOS[scenario])
    env.update(overrides)
    return env


def _novel(rng, fams, subsets):
    n = len(fams)
    U = np.zeros((n, K, P))
    for f in np.unique(fams):
        ii = np.where(fams == f)[0]
        U[np.ix_(ii, np.arange(K), subsets[f])] = rng.normal(0, 1, (len(ii), K, len(subsets[f])))
    U[:, :, 8] = rng.normal(0, 1, (n, K))            # agreeableness
    U[:, :, 9:12] = rng.normal(0, 1, (n, K, 3))      # distractors (u9 = poison target)
    return U


def make_world(seed, env):
    """All random variables are drawn unconditionally and in a fixed order, so the base task
    stream (tasks, outcomes, noise) is identical across scenarios for a given seed. Poison
    episodes come from a separate generator and are inserted without reordering base tasks."""
    rng = np.random.default_rng(seed)
    nT, nH = env["n_train_fam"], env["n_heldout_fam"]
    nF = nT + nH
    nD, npd = env["n_days"], env["tasks_per_day"]

    theta = np.zeros(D)
    theta[1:9] = rng.uniform(0.6, 1.8, 8) * rng.choice([-1.0, 1.0], 8)
    theta[AGREE] = -0.3                              # flattering options are slightly worse
    theta_after = theta.copy()
    top2 = np.argsort(np.abs(theta[1:9]))[-2:] + 1
    theta_after[top2] *= -1.0                        # used only in world_change

    while True:
        subs = [np.sort(rng.choice(8, 4, replace=False)) for _ in range(nT)]
        if np.bincount(np.concatenate(subs), minlength=8).min() >= 2:
            break
    train_set = {tuple(s) for s in subs}
    held = []
    while len(held) < nH:
        s = tuple(np.sort(rng.choice(8, 4, replace=False)))
        if s not in train_set and s not in held:
            held.append(s)
    subsets = [np.array(s) for s in subs] + [np.array(s) for s in held]
    tiers = np.concatenate([rng.permutation(np.array([0, 0, 0, 1, 1, 1, 2, 2])[:nT]), rng.integers(0, 3, nH)])
    mu = np.array([0.0, 0.6, 1.2])[tiers]
    fbias = rng.normal(0, 0.3, nF)
    ppf = env["protos_per_fam"]
    protos = _novel(rng, np.repeat(np.arange(nT), ppf), subsets).reshape(nT, ppf, K, P)
    shock_day = rng.random(nD + 8) < env["shock_rate"]
    shock_day[:5] = False
    if not env["shocks"]:
        shock_day[:] = False

    def attributes(g, fam, n):
        return dict(
            v=np.exp(g.normal(mu[fam], 0.5)),
            drama=2.0 * (g.random(n) < 0.15) + g.normal(0, 0.3, n),
            u_d=g.random(n), dlen=g.integers(1, 7, n), u_self=g.random(n),
            r=g.random((n, K)), appr_draw=g.random(n), flip_draw=g.random(n), shock_draw=g.random(n),
            rater_noise=g.normal(0, 0.5, n), tie=g.random(n), Z=g.standard_normal((n, D)),
            gumbel=g.gumbel(size=(n, 12)))

    # ---- base stream (identical across scenarios)
    bd, bf, bt, br, bU = [], [], [], [], []
    for day in range(nD):
        f = rng.integers(0, nT, npd)
        U = _novel(rng, f, subsets)
        r = rng.random(npd) < env["routine_share"]
        pr = rng.integers(0, ppf, npd)
        noise = rng.normal(0, 0.05, (npd, K, P))
        ri = np.where(r)[0]
        base = protos[f[ri], pr[ri]]
        U[ri] = base + noise[ri] * (base != 0)
        bd.append(np.full(npd, day)); bf.append(f); bt.append(np.where(r, f * 10 + pr, 1000 + day * npd + np.arange(npd)))
        br.append(r); bU.append(U)
    bd, bf, bt, br, bU = map(np.concatenate, (bd, bf, bt, br, bU))
    battr = attributes(rng, bf, len(bd))

    # ---- poison stream (separate generator)
    gp = np.random.default_rng(seed + 104729)
    pdays = np.arange(env["poison_start"], env["poison_end"]) if env["poison"] else np.zeros(0, int)
    m = env["poison_per_day"]
    pd_ = np.repeat(pdays, m)
    pf = gp.integers(0, nT, len(pd_))
    pU = _novel(gp, pf, subsets) if len(pd_) else np.zeros((0, K, P))
    pattr = attributes(gp, pf, len(pd_))

    # ---- merge: base order fixed per seed, poison inserted at random positions
    go = np.random.default_rng(seed + 15485863)
    order = []
    for day in range(nD):
        bidx = np.where(bd == day)[0][go.permutation(npd)]
        pidx = len(bd) + np.where(pd_ == day)[0]
        if len(pidx):
            slots = np.sort(gp.integers(0, len(bidx) + 1, len(pidx)))
            seq = list(bidx)
            for k_, s_ in enumerate(slots):
                seq.insert(s_ + k_, pidx[k_])
            bidx = np.array(seq)
        order.append(bidx)
    order = np.concatenate(order)

    cat = lambda a, b: np.concatenate([a, b])[order]
    day = cat(bd, pd_); fam = cat(bf, pf); topic = cat(bt, 10 ** 7 + np.arange(len(pd_)))
    routine = cat(br, np.zeros(len(pd_), bool)); poison = cat(np.zeros(len(bd), bool), np.ones(len(pd_), bool))
    U = np.concatenate([bU, pU])[order]
    A = {k: np.concatenate([battr[k], pattr[k]])[order] for k in battr}
    N = len(day)
    X = np.concatenate([np.ones((N, K, 1)), U], axis=2)
    day_start = np.searchsorted(day, np.arange(nD + 1))

    th_t = np.where((env["world_change"] & (day >= env["change_day"]))[:, None], theta_after[None], theta[None])
    pstar = sigmoid(np.einsum("nkd,nd->nk", X, th_t) + fbias[fam][:, None])

    drama = A["drama"] if env["drama"] else np.zeros(N)
    drama = np.where(poison, 2.5, drama)
    tier = tiers[fam]
    p_never = env["never_share"]
    p_del = np.minimum(np.array([0.1, 0.3, 0.5])[tier] * env["delay_scale"], 1 - p_never) if env["delay"] else np.zeros(N)
    tau = np.where(A["u_d"] < p_never, BIG, np.where(A["u_d"] < p_never + p_del, day + A["dlen"], day))
    tau = np.where(poison, day, tau)
    selfrep = (A["u_self"] < env["self_report_share"]) if env["channels"] else np.zeros(N, bool)
    if env["poison"]:
        selfrep = np.where(poison, env["poison"] == "self", selfrep)

    rp = np.random.default_rng(seed + 7919)

    def probe(fam_pool, routine_share):
        n = env["n_probe"]
        f = rp.choice(fam_pool, n)
        Up = _novel(rp, f, subsets)
        r = rp.random(n) < routine_share
        pr = rp.integers(0, ppf, n)
        noise = rp.normal(0, 0.05, (n, K, P))
        ri = np.where(r)[0]
        if len(ri):
            b = protos[f[ri], pr[ri]]
            Up[ri] = b + noise[ri] * (b != 0)
        Xp = np.concatenate([np.ones((n, K, 1)), Up], axis=2)
        vp = np.exp(rp.normal(mu[f], 0.5))
        ps0 = sigmoid(Xp @ theta + fbias[f][:, None])
        ps1 = sigmoid(Xp @ theta_after + fbias[f][:, None])
        return dict(X=Xp, Xflat=Xp.reshape(-1, D), v=vp, ps0=ps0, ps1=ps1, fam=f, routine=r)

    probe_tr = probe(np.arange(nT), env["routine_share"])
    probe_ho = probe(np.arange(nT, nF), 0.0)
    return dict(
        env=env, seed=seed, N=N, day=day, day_start=day_start, fam=fam, topic=topic, routine=routine,
        poison=poison, X=X, pstar=pstar, v=A["v"], drama=drama, tau=tau, selfrep=selfrep, shock_day=shock_day,
        theta=theta, theta_after=theta_after, tiers=tiers, subsets=subsets,
        r=A["r"], appr_draw=A["appr_draw"], flip_draw=A["flip_draw"], shock_draw=A["shock_draw"],
        rater_noise=A["rater_noise"], tie=A["tie"], Z=A["Z"], gumbel=A["gumbel"],
        probe_tr=probe_tr, probe_ho=probe_ho,
    )


# ----------------------------------------------------------------------------- learner
def _penalized_nll(X, y, prior_prec, theta):
    z = X @ theta
    return np.sum(np.logaddexp(0.0, z) - y * z) + 0.5 * prior_prec * theta @ theta


FIT_DIAG = {"max_grad": 0.0}


def fit_laplace(X, y, prior_prec, theta0, iters=60):
    """MAP logistic regression by damped Newton with Armijo backtracking (globally convergent for
    this strongly convex objective), then a Laplace posterior at the optimum."""
    theta = theta0.copy()
    I = np.eye(D)
    f = _penalized_nll(X, y, prior_prec, theta)
    for _ in range(iters):
        p = sigmoid(X @ theta)
        g = X.T @ (p - y) + prior_prec * theta
        if np.abs(g).max() < 1e-6:
            break
        H = (X * (p * (1 - p))[:, None]).T @ X + prior_prec * I
        step = np.linalg.solve(H, g)
        t, dec = 1.0, g @ step
        f_new = f
        for _ls in range(40):
            f_new = _penalized_nll(X, y, prior_prec, theta - t * step)
            if f_new <= f - 1e-4 * t * dec:
                break
            t *= 0.5
        theta = theta - t * step
        f = f_new
        if np.abs(t * step).max() < 1e-9:
            break
    p = sigmoid(X @ theta)
    g = X.T @ (p - y) + prior_prec * theta
    FIT_DIAG["max_grad"] = max(FIT_DIAG["max_grad"], float(np.abs(g).max()))
    H = (X * (p * (1 - p))[:, None]).T @ X + prior_prec * I
    return theta, np.linalg.inv(H)


def policy_values(Th, pr, after):
    """Normalized decision quality of greedy policies (rows of Th) on a probe set."""
    Th = np.atleast_2d(Th)
    n = pr["v"].shape[0]
    ps = pr["ps1"] if after else pr["ps0"]
    S = (Th @ pr["Xflat"].T).reshape(Th.shape[0], n, K)
    a = S.argmax(2)
    pch = ps[np.arange(n)[None, :], a]
    V = (pch * pr["v"][None]).mean(1)
    Vr = (pr["v"] * ps.mean(1)).mean()
    Vo = (pr["v"] * ps.max(1)).mean()
    return (V - Vr) / (Vo - Vr), a


def ece_star(theta, pr, after):
    ps = pr["ps1"] if after else pr["ps0"]
    S = pr["X"] @ theta
    n = S.shape[0]
    a = S.argmax(1)
    ph = sigmoid(S[np.arange(n), a])
    pt = ps[np.arange(n), a]
    b = np.clip((ph * 10).astype(int), 0, 9)
    e = 0.0
    for k in range(10):
        m = b == k
        if m.any():
            e += m.mean() * abs(ph[m].mean() - pt[m].mean())
    return e


# ----------------------------------------------------------------------------- run
STRATEGIES = ["random", "random_resolved", "recency", "recurrence", "similarity", "importance",
              "user_pref", "user_pref_reward", "surprise", "surprise_greedy", "why", "oracle", "keep_all"]


class State:
    pass


def _need(st, c):
    """Transferability / need: mean RBF similarity of an episode to the recent task distribution."""
    w = st.world
    lo = w["day_start"][max(0, st.night - st.hp["t_ref_days"] + 1)]
    hi = w["day_start"][st.night + 1]
    ref = w["X"][lo:hi, :, 1:].reshape(-1, P)
    xe = st.xch[c, 1:]
    d2 = (xe ** 2).sum(1)[:, None] + (ref ** 2).sum(1)[None] - 2 * xe @ ref.T
    t = np.exp(-np.maximum(d2, 0) / (2 * st.hp["t_len2"])).mean(1)
    return t / max(t.max(), 1e-12)


def _day_K(st):
    """Causal confidence per resolution day: down-weight days whose outcomes deviate jointly
    from the model's expectation (an exogenous shock signature)."""
    w, hp = st.world, st.hp
    H = st.mem["buffer_days"]
    lo = max(0, st.night - H - 7)
    ii = np.where((w["tau"] >= lo) & (w["tau"] <= st.night))[0]
    Kd = np.ones(st.night + 1)
    if len(ii) == 0:
        return Kd
    p = sigmoid(st.xch[ii] @ st.theta)
    r = st.yobs[ii] - p
    dd = w["tau"][ii]
    stats = {}
    for d in range(lo, st.night + 1):
        m = dd == d
        if m.sum() >= 10:
            stats[d] = (r[m].mean(), np.sqrt((p[m] * (1 - p[m])).sum()) / m.sum())
    for d in range(max(0, st.night - H + 1), st.night + 1):
        if d not in stats:
            continue
        base = [stats[b][0] for b in range(d - 7, d) if b in stats]
        if len(base) < 3:
            continue
        z = (stats[d][0] - np.median(base)) / max(stats[d][1], 1e-9)
        Kd[d] = 1.0 / (1.0 + np.exp(hp["k_slope"] * (abs(z) - hp["k_center"])))
    return Kd


def select(st, cands):
    w, mem, hp, strat, abl = st.world, st.mem, st.hp, st.strategy, st.ablate
    B = mem["budget"]
    tie = w["tie"]
    resolved = w["tau"][cands] <= st.night

    def topB(c, score):
        if len(c) == 0:
            return c
        o = np.lexsort((tie[c], score))[::-1]
        return c[o[:B]]

    if strat == "keep_all":
        return cands
    if strat == "random":
        return topB(cands, tie[cands])
    if strat == "random_resolved":
        c = cands[resolved]
        return topB(c, tie[c])
    if strat == "recency":
        return topB(cands, cands.astype(float))
    if strat == "recurrence":
        lo = w["day_start"][max(0, st.night - mem["buffer_days"] + 1)]
        hi = w["day_start"][st.night + 1]
        tops, counts = np.unique(w["topic"][lo:hi], return_counts=True)
        cnt = counts[np.searchsorted(tops, w["topic"][cands])]
        return topB(cands, cnt.astype(float))
    if strat == "similarity":
        return topB(cands, _need(st, cands))
    if strat == "importance":
        lv = np.log(w["v"])
        score = w["drama"][cands] + 0.5 * (lv[cands] - lv.mean()) / lv.std() + w["rater_noise"][cands]
        return topB(cands, score)
    if strat in ("user_pref", "user_pref_reward"):
        return topB(cands, st.appr[cands])
    if strat == "surprise":
        # PER-style (Schaul et al. 2016): sample without replacement with P(i) ~ (|delta_i| + 0.01)^0.6
        c = cands[resolved]
        pri = (np.abs(st.yobs[c] - sigmoid(st.xch[c] @ st.theta)) + 0.01) ** 0.6
        age = np.clip(st.night - w["day"][c], 0, w["gumbel"].shape[1] - 1)
        return topB(c, np.log(pri) + w["gumbel"][c, age])
    if strat == "surprise_greedy":
        c = cands[resolved]
        return topB(c, np.abs(st.yobs[c] - sigmoid(st.xch[c] @ st.theta)))
    if strat == "why":
        return select_why(st, cands, resolved)
    if strat == "oracle":
        return select_oracle(st, cands)
    raise ValueError(strat)


def select_why(st, cands, resolved):
    w, mem, hp, abl = st.world, st.mem, st.hp, st.ablate
    B, eps = mem["budget"], hp["eps"]
    if "noretro" in abl:
        c = cands[w["day"][cands] == st.night]          # decide once, on the first night
        res = w["tau"][c] <= st.night
    else:
        c = cands[resolved]                              # defer until the consequence is known
        res = np.ones(len(c), bool)
    if len(c) == 0:
        return c
    x = st.xch[c]
    y = st.yobs[c].copy()
    theta, Sigma = st.theta.copy(), st.Sigma.copy()
    Kd = st.Kd
    Kf = np.where(res, Kd[np.minimum(w["tau"][c], st.night)], 1.0)
    Mf = np.where(res, w["selfrep"][c].astype(float), 0.5)
    vv = w["v"][c]
    lo = w["day_start"][max(0, st.night - mem["buffer_days"] + 1)]
    vmean = w["v"][lo:w["day_start"][st.night + 1]].mean()
    Cf = np.minimum(vv / vmean, 3.0) / 3.0
    Tf = _need(st, c)
    if "prop" in abl:
        newly = cands[(w["tau"][cands] == st.night)]
        if len(newly):
            pn = sigmoid(st.xch[newly] @ st.theta)
            sn = np.abs(st.yobs[newly] - pn) * np.minimum(w["v"][newly] / vmean, 3.0) / 3.0
            keep = sn >= np.quantile(sn, 0.9)
            xn, sn = st.xch[newly][keep, 1:], sn[keep]
            d2 = (x[:, 1:] ** 2).sum(1)[:, None] + (xn ** 2).sum(1)[None] - 2 * x[:, 1:] @ xn.T
            boost = (np.exp(-np.maximum(d2, 0) / (2 * hp["t_len2"])) * sn[None]).max(1)
            Tf = Tf * (1 + hp["prop_eta"] * boost / max(boost.max(), 1e-12))
            Tf = Tf / Tf.max()

    def factors(theta, Sigma):
        p = sigmoid(x @ theta)
        S = np.where(res, np.abs(y - p), 2 * p * (1 - p))
        wgt = p * (1 - p)
        info = 0.5 * np.log1p(wgt * np.einsum("nd,de,ne->n", x, Sigma, x))
        return p, S, wgt, info

    p, S, wgt, info = factors(theta, Sigma)
    info0 = max(info.max(), 1e-12)
    S_init, U_init, p_init = S.copy(), np.minimum(info / info0, 1.0), p.copy()
    fl = lambda f: eps + (1 - eps) * f
    base = np.ones(len(c))
    if "noC" not in abl: base *= fl(Cf)
    if "noK" not in abl: base *= fl(Kf)
    if "noT" not in abl: base *= fl(Tf)
    if "noM" not in abl: base *= (1 - hp["lam_m"] * Mf)

    def score(S, info):
        s = base.copy()
        if "noS" not in abl: s *= fl(S)
        if "noU" not in abl: s *= fl(np.minimum(info / info0, 1.0))
        return s

    if "nogreedy" in abl:
        sc = score(S, info)
        o = np.lexsort((w["tie"][c], sc))[::-1]
        return c[o[:B]]

    avail = np.ones(len(c), bool)
    picked = []
    for _ in range(min(B, len(c))):
        sc = np.where(avail, score(S, info), -np.inf)
        j = int(np.argmax(sc))
        picked.append(j)
        avail[j] = False
        if res[j]:                                         # rank-1 Laplace update: redundancy
            sx = Sigma @ x[j]
            den = 1.0 + wgt[j] * x[j] @ sx
            theta = theta + sx * (y[j] - p[j]) / den
            Sigma = Sigma - wgt[j] * np.outer(sx, sx) / den
            p, S, wgt, info = factors(theta, Sigma)
    st.why_last = dict(c=c, picked=np.array(picked, int), S=S_init, U=U_init, p=p_init, C=Cf, K=Kf, T=Tf, M=Mf)
    return c[np.array(picked, int)]


def select_oracle(st, cands):
    """Greedy counterfactual oracle: value of storing each episode (with the label it will
    carry) = change in true future decision quality. Knows eventual labels and true p*."""
    w, B = st.world, st.mem["budget"]
    c = cands[w["tau"][cands] < BIG]
    if len(c) == 0:
        return c
    x = st.xch[c]
    y = st.yobs[c]
    theta, Sigma = st.theta.copy(), st.Sigma.copy()
    avail = np.ones(len(c), bool)
    picked = []
    v_cur = policy_values(theta, w["probe_tr"], st.after)[0][0]
    for _ in range(min(B, len(c))):
        p = sigmoid(x @ theta)
        wg = p * (1 - p)
        Sx = x @ Sigma
        den = 1.0 + wg * (Sx * x).sum(1)
        Th = theta[None] + Sx * ((y - p) / den)[:, None]
        vals = policy_values(Th, w["probe_tr"], st.after)[0]
        gain = np.where(avail, vals - v_cur, -np.inf)
        j = int(np.argmax(gain))
        picked.append(j)
        avail[j] = False
        sx = Sigma @ x[j]
        dj = 1.0 + wg[j] * x[j] @ sx
        theta = theta + sx * (y[j] - p[j]) / dj
        Sigma = Sigma - wg[j] * np.outer(sx, sx) / dj
        v_cur = vals[j]
    return c[np.array(picked, int)]


def run(world, strategy, mem=None, hp=None, ablate=(), record=False):
    env = world["env"]
    mem = dict(BASE_MEM, **(mem or {}))
    hp = dict(WHY_HP, **(hp or {}))
    N, nD = world["N"], env["n_days"]
    X, pstar, tau, v = world["X"], world["pstar"], world["tau"], world["v"]
    ds = world["day_start"]
    prior_prec = 1.0 / mem["prior_sd"] ** 2
    label_approval = strategy == "user_pref_reward"
    capacity = BIG if strategy == "keep_all" else mem["capacity"]

    FIT_DIAG["max_grad"] = 0.0
    st = State()
    st.world, st.mem, st.hp, st.strategy, st.ablate = world, mem, hp, strategy, tuple(ablate)
    st.theta = np.zeros(D)
    st.Sigma = np.eye(D) * mem["prior_sd"] ** 2
    st.xch = np.zeros((N, D)); st.yobs = np.zeros(N); st.appr = np.zeros(N)
    st.after = False
    chosen = np.full(N, -1)
    shock_aff = np.zeros(N, bool); flipped = np.zeros(N, bool)
    consolidated = np.zeros(N, bool); cons_night = np.full(N, -1)
    durable = np.zeros(0, int)

    out = {k: np.zeros(nD) for k in ["ndq_tr", "ndq_ho", "ece", "spur_w", "revised", "regret", "rand_regret",
                                     "dur_size", "c_routine", "c_never", "c_shock", "c_flip", "c_poison",
                                     "c_pending", "n_resolved", "n_forgotten", "n_consolidated", "n_tasks"]}
    prev_a = None
    dream = []

    for day in range(nD):
        idx = np.arange(ds[day], ds[day + 1])
        L = np.linalg.cholesky(st.Sigma + 1e-10 * np.eye(D))
        Th = st.theta[None] + world["Z"][idx] @ L.T
        a = np.einsum("nkd,nd->nk", X[idx], Th).argmax(1)
        chosen[idx] = a
        st.xch[idx] = X[idx, a]
        pc = pstar[idx, a]
        pz = world["poison"][idx]
        best = pstar[idx].max(1)
        out["regret"][day] = (v[idx] * (best - pc))[~pz].sum()
        out["rand_regret"][day] = (v[idx] * (best - pstar[idx].mean(1)))[~pz].sum()
        al = env["approval_bias"] * X[idx, a, AGREE] + env["approval_quality"] * (2 * pc - 1)
        ap = (world["appr_draw"][idx] < sigmoid(al)).astype(float)
        ap[pz] = 1.0
        st.appr[idx] = ap
        y = (world["r"][idx, a] < pc).astype(float)
        y[pz] = (X[idx, a, SPUR][pz] > 0).astype(float)
        fl = world["selfrep"][idx] & (world["flip_draw"][idx] < env["self_report_flip"]) & ~pz
        y[fl] = 1.0 - y[fl]
        flipped[idx] = fl
        t = tau[idx]
        sh = np.zeros(len(idx), bool)
        fin = (t < BIG) & ~pz
        sdays = world["shock_day"]
        sh[fin] = sdays[np.minimum(t[fin], len(sdays) - 1)] & (world["shock_draw"][idx][fin] < env["shock_fail"])
        y[sh] = 0.0
        shock_aff[idx] = sh
        st.yobs[idx] = y

        # ---------------- night: the dream cycle
        st.night = day
        st.after = env["world_change"] and day >= env["change_day"]
        lo = ds[max(0, day - mem["buffer_days"] + 1)]
        buf = np.arange(lo, ds[day + 1])
        cands = buf[~consolidated[buf]]
        st.Kd = _day_K(st) if strategy == "why" else None
        sel = select(st, cands)
        consolidated[sel] = True
        cons_night[sel] = day
        durable = np.concatenate([durable, sel])
        if len(durable) > capacity:
            durable = durable[-capacity:]
        if label_approval:
            dl, ylab = durable, st.appr[durable]
        else:
            m = tau[durable] <= day
            dl, ylab = durable[m], st.yobs[durable][m]
        if len(dl):
            st.theta, st.Sigma = fit_laplace(st.xch[dl], ylab, prior_prec, st.theta)
        # ---------------- metrics
        q, a_tr = policy_values(st.theta, world["probe_tr"], st.after)
        out["ndq_tr"][day] = q[0]
        out["ndq_ho"][day] = policy_values(st.theta, world["probe_ho"], st.after)[0][0]
        out["ece"][day] = ece_star(st.theta, world["probe_tr"], st.after)
        out["spur_w"][day] = st.theta[SPUR]
        out["revised"][day] = 0 if prev_a is None else int((a_tr[0] != prev_a).sum())
        prev_a = a_tr[0]
        out["dur_size"][day] = len(durable)
        if len(durable):
            out["c_routine"][day] = world["routine"][durable].mean()
            out["c_never"][day] = (tau[durable] >= BIG).mean()
            out["c_shock"][day] = shock_aff[durable].mean()
            out["c_flip"][day] = flipped[durable].mean()
            out["c_poison"][day] = world["poison"][durable].mean()
            out["c_pending"][day] = ((tau[durable] > day) & (tau[durable] < BIG)).mean()
        out["n_tasks"][day] = len(idx)
        out["n_resolved"][day] = int(((tau <= day) & (tau >= max(0, day - 7)) & (tau == day)).sum())
        expiring = np.arange(ds[max(0, day - mem["buffer_days"] + 1)], ds[max(0, day - mem["buffer_days"] + 1) + 1]) \
            if day - mem["buffer_days"] + 1 >= 0 else np.zeros(0, int)
        out["n_forgotten"][day] = int((~consolidated[expiring]).sum())
        out["n_consolidated"][day] = len(sel)

        if record:
            rec = dict(night=day, theta=st.theta.copy(), sel=sel.copy(), expiring=expiring[~consolidated[expiring]].copy())
            if strategy == "why" and hasattr(st, "why_last"):
                rec["why"] = {k: np.array(val).copy() for k, val in st.why_last.items()}
                rec["Kd"] = st.Kd.copy()
            dream.append(rec)

    cons = np.where(consolidated)[0]
    out["cons_day"] = world["day"][cons]
    out["cons_tau"] = np.minimum(tau[cons], 10 ** 6)
    out["cons_night"] = cons_night[cons]
    out["cons_poison"] = world["poison"][cons]
    out["final_theta"] = st.theta
    out["fit_max_grad"] = FIT_DIAG["max_grad"]
    if record:
        out["dream"] = dream
        out["chosen"] = chosen
        out["yobs"] = st.yobs
        out["appr"] = st.appr
        out["shock_aff"] = shock_aff
        out["flipped"] = flipped
    return out

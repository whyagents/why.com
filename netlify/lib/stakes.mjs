// Stake is the 1-10 belief-revision scale the client already clamps
// (why-app.js clampHeat). It measures how much answering a door would revise
// what the reader believes - not how loud the wording is. Bands are forced
// apart so a board always spans the ladder: a board of three reversals reads as
// provocative and measures nothing, because the vote split then carries no
// information about what the crowd reached for.
export const STAKE_BANDS = Object.freeze({
  mechanism: Object.freeze({
    range: [3, 4],
    brief: "explain how the thing in the answer actually works. make the machinery legible without threatening what the reader believes.",
  }),
  consequence: Object.freeze({
    range: [6, 7],
    brief: "follow the answer forward to what it causes, costs or enables next. extend the belief; do not overturn it.",
  }),
  reversal: Object.freeze({
    range: [9, 10],
    brief: "threaten a belief the answer just implied. name the evidence, actor or condition under which its framing is wrong.",
  }),
});

export const STAKE_BAND_NAMES = Object.freeze(Object.keys(STAKE_BANDS));

// One definition of the boundaries, so the generator, the episode tests and any
// later analysis cannot drift apart.
export const bandOf = (stake) => {
  const value = Math.round(Number(stake));
  if (!Number.isFinite(value)) return "";
  if (value <= STAKE_BANDS.mechanism.range[1] + 1) return "mechanism";
  if (value <= STAKE_BANDS.consequence.range[1] + 1) return "consequence";
  return "reversal";
};

export const clampStake = (value) => {
  const stake = Math.round(Number(value));
  return Number.isFinite(stake) ? Math.min(10, Math.max(1, stake)) : 0;
};

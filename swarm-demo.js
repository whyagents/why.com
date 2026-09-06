(() => {
  "use strict";

  // Offline pilot boundary. Replace `answer` with the approved Swarm/OpenRouter
  // request later; the WHY client contract can remain unchanged.
  const CARDS = Object.freeze([
    {
      question: "How would Swarm route the first request?",
      answer: "this is a canned Swarm pilot response. the complete WHY loop is active, but no model, OpenRouter request or external inference ran.",
    },
    {
      question: "What should the pilot measure first?",
      answer: "start with time to first words, successful three-choice boards and second-click rate. clever infrastructure means nothing if curiosity dies on the loading screen.",
    },
    {
      question: "Where would OpenRouter enter the loop?",
      answer: "the adapter would send one bounded request through OpenRouter, then return the same answer-and-three-questions contract this offline page already consumes.",
    },
    {
      question: "How does WHY preserve user choice?",
      answer: "WHY presents three distinct directions and records the selected path locally. the two rejected paths remain useful signals without becoming a public identity file.",
    },
    {
      question: "What happens when one model stalls?",
      answer: "Swarm can route around a stalled provider, but the interface should never pretend an empty response succeeded. failure must arrive clearly enough to retry.",
    },
    {
      question: "Can rejected paths improve ranking?",
      answer: "yes. every choice is also two rejections. across enough comparisons, WHY can learn which possibilities deserve the next click—not merely which topics appear often.",
    },
    {
      question: "How would the adapter switch providers?",
      answer: "provider choice belongs behind this adapter. WHY should ask for one stable response shape while Swarm handles routing, fallback and provider-specific machinery.",
    },
    {
      question: "What data should stay on-device?",
      answer: "raw curiosity paths, behavioral preferences and personal memory should stay local by default. a pilot only needs the smallest context required to improve the next turn.",
    },
    {
      question: "When is another model call worthwhile?",
      answer: "only when the extra call materially improves the three questions. orchestration earns its latency when users click deeper, not when the architecture diagram gets busier.",
    },
    {
      question: "How would Swarm handle receipts?",
      answer: "verification should be a separate bounded path: retrieve evidence, return citations and never let a slow source block the first useful answer.",
    },
    {
      question: "What proves the pilot actually works?",
      answer: "the proof is behavioral: faster first words, fewer failed boards, more second clicks and longer coherent paths than the current routing baseline.",
    },
    {
      question: "Could this work without user accounts?",
      answer: "yes. local path memory can personalize the session without a login. cross-device persistence can remain optional instead of becoming the price of entry.",
    },
  ]);

  const hash = (value) => {
    let result = 2166136261;
    for (const character of String(value || "")) {
      result ^= character.codePointAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  };

  const answer = ({ query = "", domain = "technology" } = {}) => {
    const normalized = String(query).trim().toLowerCase();
    const exactIndex = CARDS.findIndex((card) => card.question.toLowerCase() === normalized);
    const index = exactIndex >= 0 ? exactIndex : hash(normalized) % CARDS.length;
    const card = CARDS[index];
    const offsets = [1, 4, 7];
    const roles = ["deepen", "contradiction", "consequence"];
    const pulls = offsets.map((offset, doorIndex) => {
      const target = CARDS[(index + offset) % CARDS.length];
      return {
        role: roles[doorIndex],
        heat: 7 + doorIndex,
        label: target.question,
        query: target.question,
        grounding: "off",
      };
    });
    return {
      answer: card.answer,
      voiceNote: {
        domain,
        prompt: "three Swarm pilot paths",
        copyStyle: "question_v2",
        pulls,
      },
      domain,
      sources: [],
      receiptsAvailable: false,
      preview: false,
      grounding: "off",
      groundingStatus: "offline_swarm_pilot",
      elapsedMs: 120,
    };
  };

  window.WHY_SWARM_DEMO = Object.freeze({
    greeting: "Hello Swarm. We look forward to piloting your services.",
    answer,
  });
})();

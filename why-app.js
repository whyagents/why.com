(() => {
  "use strict";

  const THREADS_KEY = "whyUltimateThreads.v2";
  const THREADS_QUARANTINE_KEY = "whyUltimateThreads.quarantine.v1";
  const THREADS_V1_KEY = "whyUltimateThreads.v1";
  const LEGACY_THREADS_KEY = "whyUltimate.googleBase.v1";
  const LEDGER_KEY = "whyLedger.v2";
  const LEDGER_V1_KEY = "whyLedger.v1";
  const NAME_PROFILE_KEY = "whyVisitorProfile.v2";
  const LEGACY_NAME_KEY = "whyVisitorProfile.v1";
  const CURIOSITY_KEY = "whyCuriosityProfile.v1";
  const CURIOSITY_GRAPH_KEY = "whyCuriosityGraph.v1";
  const RABBIT_HOLE_KEY = "whyRabbitHoles.v1";
  const DAILY_PROGRESS_KEY = "whyDailyWhy.v1";
  const ANALYTICS_KEY = "whyAnalytics.dev.v1";
  const VISIT_KEY = "whyVisit.v1";
  const STORAGE_PERSISTENCE_KEY = "whyStoragePersistence.v1";
  const STORAGE_TARGET_BYTES = Math.floor(4.35 * 1024 * 1024);
  const STORAGE_PERSIST_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
  const PATH_EXPORT_VERSION = 1;
  const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
  const MEMORY_MIN_PULLS = 10;
  const MEMORY_MIN_PATHS = 3;
  const RANKING_OUTCOME_LIMIT = 120;
  const RANKING_ACTIVE_DAY_LIMIT = 30;
  const MEANINGFUL_RETURN_AWAY_MS = 6 * 60 * 60 * 1000;
  const NORMAL_ANSWER_WORD_LIMIT = 38;
  const MANAGED_STORAGE_KEYS = [
    THREADS_KEY, THREADS_QUARANTINE_KEY, THREADS_V1_KEY, LEGACY_THREADS_KEY,
    LEDGER_KEY, LEDGER_V1_KEY, NAME_PROFILE_KEY, LEGACY_NAME_KEY, CURIOSITY_KEY, CURIOSITY_GRAPH_KEY,
    RABBIT_HOLE_KEY, DAILY_PROGRESS_KEY, ANALYTICS_KEY, VISIT_KEY, STORAGE_PERSISTENCE_KEY,
  ];
  const API_VERSION = 4;
  const PAGE_PARAMS = new URLSearchParams(location.search);
  const BROWSER_TIME_ZONE = (() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      return /^[A-Za-z0-9_+\-/]{1,64}$/.test(timeZone) ? timeZone : "UTC";
    } catch {
      return "UTC";
    }
  })();
  const SWARM_ADAPTER = document.body.dataset.swarmDemo === "true" ? window.WHY_SWARM_DEMO : null;
  const SWARM_DEMO = Boolean(SWARM_ADAPTER?.answer && SWARM_ADAPTER?.greeting);
  const ADS_ADAPTER = document.body.dataset.adsDemo === "true" ? window.WHY_ADS_DEMO : null;
  const ADS_DEMO = Boolean(ADS_ADAPTER?.answer && ADS_ADAPTER?.greeting && Array.isArray(ADS_ADAPTER?.homeChoices) && ADS_ADAPTER.homeChoices.length === 3);
  const DAILY_PAGE_ID = String(document.body.dataset.dailyEpisodeId || location.pathname.match(/^\/daily\/(\d{4}-\d{2}-\d{2})\/?/)?.[1] || "").trim().slice(0, 32);
  const LOCAL_PREVIEW_HOST = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const REVIEW = location.protocol === "file:" || (LOCAL_PREVIEW_HOST && PAGE_PARAMS.has("review"));
  const DEBUG = REVIEW || (LOCAL_PREVIEW_HOST && PAGE_PARAMS.has("debug"));
  const SELF_HARM_METHOD = "(?:jump\\s+off\\s+(?:a|the)?\\s*(?:bridge|building|cliff|roof)|overdose(?:\\s+(?:tonight|now|on\\s+[^?.!]{1,30}))?|take\\s+all\\s+(?:of\\s+)?(?:my\\s+)?(?:pills|medication|medicine)|hang\\s+myself|drown\\s+myself|poison\\s+myself|walk\\s+into\\s+traffic|step\\s+in\\s+front\\s+of\\s+(?:a\\s+)?(?:train|car|truck))";
  const SELF_HARM_CRISIS = new RegExp(`\\b(?:kill myself|shoot myself|hang myself|drown myself|poison myself|end my life|take my own life|hurt myself|harm myself|self[- ]harm|cut myself|take all (?:of )?(?:my )?(?:pills|medication|medicine)|(?:commit(?:ted|ting)?|attempt(?:ed|ing)?) suicide|want to die|how (?:can|could|do) i die|do not want to live|don't want to live|do not want to wake up|don't want to wake up|thinking (?:about|of) suicide|suicidal|not worth living|no reason to live|cannot go on|can't go on|better off dead|wish i (?:were|was) dead|i\\s+(?:(?:am|'m)\\s+(?:going|planning|about)\\s+to|plan\\s+to|intend\\s+to|might|will)\\s+${SELF_HARM_METHOD})\\b`, "i");
  const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");
  const FINE_POINTER = matchMedia("(hover:hover) and (pointer:fine)");
  const $ = (selector, root = document) => root.querySelector(selector);

  const views = {
    home: $("#homeView"),
    loading: $("#loadingView"),
    answer: $("#answerView"),
    error: $("#errorView"),
  };

  const LENS_SETS = {
    public: ["money", "power", "cost"],
    science: ["mechanism", "evidence", "exception"],
    problem: ["method", "assumption", "check"],
    personal: ["habit", "fear", "reward"],
    decision: ["upside", "risk", "alternative"],
    technology: ["design", "failure", "tradeoff"],
  };
  const DOMAINS = Object.keys(LENS_SETS);
  const VALID_LENSES = new Set(Object.values(LENS_SETS).flat());
  const DOOR_ROLES = ["deepen", "contradiction", "consequence", "origin", "surprise", "pattern"];
  const VALID_ROLES = new Set(DOOR_ROLES);
  const QUEST_PROMISES = ["microscope", "trapdoor", "telescope"];
  const VALID_PROMISES = new Set(QUEST_PROMISES);
  const PROMISE_FOR_ROLE = Object.freeze({
    deepen: "microscope", origin: "microscope",
    contradiction: "trapdoor", surprise: "trapdoor",
    consequence: "telescope", pattern: "telescope",
  });
  const LEGACY_ROLE_ALIASES = Object.freeze({ reveal: "contradiction", jump: "pattern" });
  const canonicalRole = (value) => {
    const role = String(value || "").toLowerCase().trim();
    return LEGACY_ROLE_ALIASES[role] || role;
  };
  const DEFAULT_DOMAIN = "public";
  const LEGACY_GENERIC_DOOR_LABELS = new Set([
    "who gets paid?", "who decides?", "who pays later?",
    "what causes it?", "what proves it?", "when does it fail?",
    "solve it cleanly", "check the premise", "prove the result",
    "the pattern repeats", "what feels unsafe?", "what is the payoff?",
    "best real outcome", "what can break?", "the third option",
    "why built this way?", "where it breaks", "what gets traded?",
  ]);
  const QUESTION_DOOR_STARTER = /^(?:why|how|what|which|where|when|who|did|does|do|can|could|would|is|are|was|were)\b/i;
  const CONCEPT_LABEL_TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}'’&+\-]*$/u;
  const GENERIC_CONCEPT_LABELS = new Set([
    "deeper", "origin", "surprise", "consequence", "another angle", "more", "why",
    "evidence", "interesting", "learn more", "next question", "mechanism", "twist", "beyond", "underworld", "heresy", "aftershock",
  ]);
  const isQuestionDoorLabel = (label) => {
    const text = cleanText(label, 72).toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    return words.length >= 3 && words.length <= 12 && text.length <= 72 && QUESTION_DOOR_STARTER.test(text) && /[?]$/.test(text);
  };
  const isConceptDoorLabel = (value) => {
    const label = cleanText(value, 24).toLowerCase();
    const words = label.split(/\s+/u).filter(Boolean);
    return label.length <= 24 && words.length >= 1 && words.length <= 2 &&
      words.every((word) => CONCEPT_LABEL_TOKEN.test(word)) && !GENERIC_CONCEPT_LABELS.has(label);
  };

  const RABBIT_CATEGORIES = Object.freeze(["sports", "entertainment", "travel", "technology", "business", "politics"]);
  const HOMEPAGE_CATEGORIES = Object.freeze(["sports", "technology", "politics"]);
  const SEED_BANK = [
    { category: "sports", domain: "public", label: "star power", query: "Why are superstar athletes becoming bigger than their teams?" },
    { category: "sports", domain: "public", label: "dynasty decay", query: "Why do sports dynasties collapse faster than they are built?" },
    { category: "sports", domain: "science", label: "home advantage", query: "Why does home-field advantage survive modern analytics?" },
    { category: "sports", domain: "decision", label: "aging stars", query: "Why do losing teams keep paying for aging stars?" },
    { category: "sports", domain: "public", label: "women's boom", query: "Why are women's sports suddenly attracting record investment?" },
    { category: "sports", domain: "personal", label: "winning forgives", query: "Why do fans forgive cheating when their team wins?" },
    { category: "sports", domain: "science", label: "pressure misses", query: "Why does pressure make elite athletes miss easy shots?" },
    { category: "sports", domain: "public", label: "player power", query: "Why are college athletes becoming more powerful than coaches?" },
    { category: "sports", domain: "personal", label: "rivalry memory", query: "Why do rivalries outlive the players who created them?" },
    { category: "sports", domain: "public", label: "global games", query: "Why do some sports become global while others stay local?" },

    { category: "entertainment", domain: "public", label: "vanishing stars", query: "Why are there fewer true movie stars than twenty years ago?" },
    { category: "entertainment", domain: "public", label: "nostalgia wins", query: "Why does nostalgia keep beating new ideas at the box office?" },
    { category: "entertainment", domain: "personal", label: "lovable villains", query: "Why do audiences root for villains they would hate in life?" },
    { category: "entertainment", domain: "technology", label: "tiktok songs", query: "Why are short videos changing the way songs are written?" },
    { category: "entertainment", domain: "technology", label: "vanishing hits", query: "Why do streaming hits disappear faster than television classics?" },
    { category: "entertainment", domain: "public", label: "scandal premium", query: "Why does celebrity scandal sometimes make careers even bigger?" },
    { category: "entertainment", domain: "public", label: "theater survival", query: "Why are movie theaters surviving when everything streams at home?" },
    { category: "entertainment", domain: "personal", label: "fictional intimacy", query: "Why do fictional relationships feel more real than celebrity ones?" },
    { category: "entertainment", domain: "personal", label: "ending damage", query: "Why does one bad ending ruin an entire television series?" },
    { category: "entertainment", domain: "public", label: "concert boom", query: "Why are live concerts booming in the age of infinite content?" },

    { category: "travel", domain: "public", label: "destination status", query: "Why do some cities become destinations while equally beautiful ones don't?" },
    { category: "travel", domain: "personal", label: "return speed", query: "Why does travel feel shorter on the way home?" },
    { category: "travel", domain: "personal", label: "shared escape", query: "Why do tourists crowd the same places they hoped to escape?" },
    { category: "travel", domain: "public", label: "airport time", query: "Why are airports designed to make time feel strange?" },
    { category: "travel", domain: "public", label: "borrowed borders", query: "Why do some borders divide people who share the same culture?" },
    { category: "travel", domain: "public", label: "discovery tax", query: "Why does a place feel different after everyone discovers it?" },
    { category: "travel", domain: "decision", label: "cheap flights", query: "Why are the cheapest flights often the most expensive journeys?" },
    { category: "travel", domain: "personal", label: "stranger trust", query: "Why do travelers trust strangers more when they are abroad?" },
    { category: "travel", domain: "public", label: "beauty evicts", query: "Why do beautiful places become unaffordable for people born there?" },
    { category: "travel", domain: "personal", label: "staged cities", query: "Why do some cities feel alive while others feel staged?" },

    { category: "technology", domain: "technology", label: "cheaper ai", query: "Why does cheaper AI keep making Nvidia more valuable?" },
    { category: "technology", domain: "technology", label: "network decay", query: "Why do social networks get worse as they become essential?" },
    { category: "technology", domain: "technology", label: "time promise", query: "Why does every new technology promise to save us time?" },
    { category: "technology", domain: "technology", label: "black boxes", query: "Why do powerful algorithms struggle to explain their own decisions?" },
    { category: "technology", domain: "technology", label: "machine trust", query: "Why are people trusting AI they know can be wrong?" },
    { category: "technology", domain: "technology", label: "privacy loses", query: "Why does convenience keep defeating privacy?" },
    { category: "technology", domain: "technology", label: "open walls", query: "Why do open platforms eventually build walls?" },
    { category: "technology", domain: "technology", label: "habit rent", query: "Why do digital products become subscriptions after winning our habits?" },
    { category: "technology", domain: "technology", label: "worse jobs", query: "Why does better technology sometimes create worse jobs?" },
    { category: "technology", domain: "technology", label: "same gatekeepers", query: "Why do we keep rebuilding the internet around the same gatekeepers?" },

    { category: "business", domain: "public", label: "commodity power", query: "Why do dominant companies get stronger after their products become commodities?" },
    { category: "business", domain: "decision", label: "growth addiction", query: "Why do companies reward growth even when it destroys profit?" },
    { category: "business", domain: "decision", label: "distribution wins", query: "Why are the best products not always the ones that win?" },
    { category: "business", domain: "public", label: "luxury destruction", query: "Why do luxury brands destroy products instead of discounting them?" },
    { category: "business", domain: "decision", label: "startup graves", query: "Why do corporations buy startups they later shut down?" },
    { category: "business", domain: "public", label: "cancellation maze", query: "Why do subscription businesses make cancellation deliberately difficult?" },
    { category: "business", domain: "decision", label: "funded rivals", query: "Why do investors fund rivals that cannot all survive?" },
    { category: "business", domain: "decision", label: "smart slowdown", query: "Why do companies become slower as they hire smarter people?" },
    { category: "business", domain: "personal", label: "artificial scarcity", query: "Why does scarcity increase desire even when it is artificial?" },
    { category: "business", domain: "public", label: "middlemen survive", query: "Why do middlemen survive industries built to remove them?" },

    { category: "politics", domain: "public", label: "inflation memory", query: "Why do voters punish inflation after prices stop rising quickly?" },
    { category: "politics", domain: "public", label: "outsider capture", query: "Why do political outsiders become insiders faster than supporters expect?" },
    { category: "politics", domain: "public", label: "distrusted leaders", query: "Why do democracies choose leaders they claim to distrust?" },
    { category: "politics", domain: "public", label: "anger outruns", query: "Why does political anger spread faster than political knowledge?" },
    { category: "politics", domain: "public", label: "rigged defeat", query: "Why do losing candidates keep insisting the system was rigged?" },
    { category: "politics", domain: "public", label: "local blindness", query: "Why are local elections ignored when they shape daily life?" },
    { category: "politics", domain: "public", label: "emergency forever", query: "Why do governments preserve emergency powers after emergencies end?" },
    { category: "politics", domain: "public", label: "compromise betrayal", query: "Why does compromise look like betrayal in polarized politics?" },
    { category: "politics", domain: "public", label: "scandal immunity", query: "Why do political scandals matter less when everyone expects corruption?" },
    { category: "politics", domain: "public", label: "sacred borders", query: "Why do borders become sacred lines drawn by forgotten deals?" },
  ];

  const $number = (value, cap = Number.MAX_SAFE_INTEGER) =>
    Math.max(0, Math.min(cap, Number(value) || 0));
  const cleanText = (value, max = 4000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  const cleanName = (value) =>
    String(value || "")
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ")
      .slice(0, 40);
  const safeDomain = (value) => DOMAINS.includes(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : DEFAULT_DOMAIN;
  const clampHeat = (value) => {
    const heat = Math.round(Number(value));
    return Number.isFinite(heat) ? Math.min(10, Math.max(1, heat)) : 0;
  };
  const escapeHtml = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function uid(prefix = "id") {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function stableSelectionId(...parts) {
    const raw = parts.join("|");
    return `selection_${hashString(raw)}_${hashString([...raw].reverse().join(""))}`;
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function removeStoredKey(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
  }

  function writeJSON(key, value) {
    const raw = serializedJSON(value);
    if (!raw) return false;
    return writeRaw(key, raw);
  }

  function writeRaw(key, raw) {
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  }

  let threadLoadIssue = null;
  let threadQuarantined = false;

  function quarantineThreadIssue() {
    if (!threadLoadIssue || threadQuarantined) return true;
    try {
      localStorage.setItem(THREADS_QUARANTINE_KEY, threadLoadIssue.raw);
      threadQuarantined = true;
      return true;
    } catch {
      return false;
    }
  }

  function domStringBytes(key, raw) {
    return 2 * (String(key || "").length + String(raw || "").length);
  }

  function serializedJSON(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  function managedStorageBytes(threadPayload = null, serializedThreadPayload = null) {
    let total = 0;
    for (const key of MANAGED_STORAGE_KEYS) {
      const raw = key === THREADS_KEY && serializedThreadPayload !== null
        ? serializedThreadPayload
        : key === THREADS_KEY && threadPayload !== null
          ? serializedJSON(threadPayload)
          : readRaw(key);
      if (raw !== null && raw !== "") total += domStringBytes(key, raw);
    }
    return total;
  }

  function validSources(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).flatMap((source) => {
      try {
        const url = new URL(String(source?.url || ""));
        if (!["http:", "https:"].includes(url.protocol) || seen.has(url.href)) return [];
        seen.add(url.href);
        return [{ url: url.href, title: cleanText(source?.title || url.hostname, 160) }];
      } catch {
        return [];
      }
    }).slice(0, 3);
  }

  function sanitizeMessage(message, threadId, index) {
    if (!message || !["user", "assistant"].includes(message.role)) return null;
    const storedContent = String(message.content || "").trim().slice(0, 8000);
    const content = message.role === "assistant" ? cleanSpokenAnswer(storedContent).trim() : storedContent;
    if (!content) return null;
    const id = cleanText(message.id, 100) || `${threadId}_m${index}`;
    if (message.role === "user") {
      const via = message.via && typeof message.via === "object" ? {
        doorId: cleanText(message.via.doorId, 100),
        role: VALID_ROLES.has(canonicalRole(message.via.role)) ? canonicalRole(message.via.role) : "",
        promise: VALID_PROMISES.has(message.via.promise) ? message.via.promise : PROMISE_FOR_ROLE[canonicalRole(message.via.role)] || "",
        lens: VALID_LENSES.has(message.via.lens) ? message.via.lens : "",
        domain: safeDomain(message.via.domain),
        label: cleanText(message.via.label, 70),
        copyStyle: ["concept_v1", "question_v1", "question_v2"].includes(message.via.copyStyle) ? message.via.copyStyle : "question_v2",
        heat: clampHeat(message.via.heat),
        grounding: ["off", "optional", "required"].includes(message.via.grounding) ? message.via.grounding : "optional",
        memoryConnected: message.via.memoryConnected === true,
        dailyParentNodeId: cleanText(message.via.dailyParentNodeId, 100),
      } : null;
      return {
        id,
        role: "user",
        content,
        source: ["seed", "typed", "door", "daily"].includes(message.source) ? message.source : (via ? "door" : "typed"),
        ...(cleanText(message.selectionId, 140) ? { selectionId: cleanText(message.selectionId, 140) } : {}),
        ...(message.migratedAward === true ? { migratedAward: true } : {}),
        ...(["pending", "committed", "none", "baseline"].includes(message.awardState) ? { awardState: message.awardState } : {}),
        ...(via ? { via } : {}),
      };
    }
    return {
      id,
      nodeId: cleanText(message.nodeId, 100) || `node_${hashString(`${threadId}:${index}:${content.slice(0, 80)}`)}`,
      ...(cleanText(message.replyTo, 100) ? { replyTo: cleanText(message.replyTo, 100) } : {}),
      role: "assistant",
      content,
      domain: safeDomain(message.domain),
      voiceNote: message.voiceNote && typeof message.voiceNote === "object" ? message.voiceNote : null,
      sources: validSources(message.sources),
      receiptsAvailable: Boolean(message.receiptsAvailable),
      groundingStatus: cleanText(message.groundingStatus, 60),
      safetyMode: message.safetyMode === "crisis" ? "crisis" : "",
      preview: Boolean(message.preview),
    };
  }

  function sanitizeThread(thread, index, usedIds) {
    if (!thread || typeof thread !== "object") return null;
    let id = cleanText(thread.id, 100) || `legacy_${index}_${hashString(thread.title || index)}`;
    while (usedIds.has(id)) id = `${id}_${index}`;
    usedIds.add(id);
    const messages = (Array.isArray(thread.messages) ? thread.messages : [])
      .map((message, messageIndex) => sanitizeMessage(message, id, messageIndex))
      .filter(Boolean);
    let waitingForAnswer = false;
    let hasCompletedNode = false;
    for (const message of messages) {
      if (message.role === "user") waitingForAnswer = true;
      if (message.role === "assistant" && waitingForAnswer) {
        hasCompletedNode = true;
        waitingForAnswer = false;
      }
    }
    if (waitingForAnswer) {
      const interrupted = messages[messages.length - 1];
      // Door pulls carry enough stable context to resume after a reload. A
      // typed turn does not, so do not leave an invisible orphan in the path.
      if (interrupted?.role === "user" && interrupted.source === "door" && !interrupted.selectionId) {
        const parentAnswerIndex = messages.length - 2;
        const parentAnswer = messages[parentAnswerIndex];
        const parentQuestion = [...messages.slice(0, parentAnswerIndex)].reverse().find((message) => message.role === "user")?.content || "";
        const doorId = `door_${hashString(`${parentQuestion}:${interrupted.content.toLowerCase()}`)}`;
        interrupted.selectionId = stableSelectionId(id, parentAnswer?.nodeId || parentAnswer?.id || "legacy", doorId, interrupted.content);
        interrupted.migratedAward = true;
      }
    }
    // A lone root question is enough to reconstruct the original request after
    // a reload. Keep only that deliberate shape; malformed multi-turn orphans
    // still get discarded instead of becoming dead history rows.
    const recoverableInitial = !hasCompletedNode && messages.length === 1 && messages[0]?.role === "user";
    if (!hasCompletedNode && !recoverableInitial) return null;
    return {
      id,
      title: cleanText(thread.title || messages.find((message) => message.role === "user")?.content || "Untitled path", 180),
      createdAt: $number(thread.createdAt) || $number(thread.updatedAt) || Date.now(),
      updatedAt: $number(thread.updatedAt) || Date.now(),
      ...(cleanText(thread.dailyEpisodeId, 32) ? { dailyEpisodeId: cleanText(thread.dailyEpisodeId, 32) } : {}),
      messages,
    };
  }

  function loadThreads() {
    const currentRaw = readRaw(THREADS_KEY);
    let current = null;
    if (currentRaw !== null) {
      try { current = JSON.parse(currentRaw); }
      catch { threadLoadIssue = { raw: currentRaw, reason: "invalid_json" }; }
    }
    if (Array.isArray(current?.threads)) {
      const usedIds = new Set();
      const threads = current.threads.map((thread, index) => sanitizeThread(thread, index, usedIds)).filter(Boolean);
      if (threads.length !== current.threads.length) {
        threadLoadIssue = { raw: currentRaw, reason: "rejected_threads" };
      }
      return { version: 2, threads };
    }
    if (currentRaw !== null) {
      if (!threadLoadIssue) threadLoadIssue = { raw: currentRaw, reason: "invalid_shape" };
      return { version: 2, threads: [] };
    }
    const v1 = readJSON(THREADS_V1_KEY);
    if (Array.isArray(v1?.threads)) {
      const usedIds = new Set();
      const threads = v1.threads.map((thread, index) => sanitizeThread(thread, index, usedIds)).filter(Boolean);
      // An explicitly empty v1 store means the user cleared it. Only a
      // non-empty-but-invalid source may fall through to an older legacy key.
      if (v1.threads.length === 0) return { version: 2, threads: [] };
      if (threads.length) return { version: 2, threads };
    }
    const legacy = readJSON(LEGACY_THREADS_KEY);
    if (Array.isArray(legacy?.history)) {
      const usedIds = new Set();
      const threads = legacy.history.map((item, index) => sanitizeThread({
        id: item?.id || `legacy_${index}_${hashString(item?.query || index)}`,
        title: item?.query,
        updatedAt: item?.updatedAt,
        messages: [
          { role: "user", content: item?.query, source: "typed" },
          { role: "assistant", content: item?.answer, sources: item?.sources, preview: item?.preview },
        ],
      }, index, usedIds)).filter(Boolean);
      return { version: 2, threads };
    }
    return { version: 2, threads: [] };
  }

  function loadNameProfile() {
    const current = readJSON(NAME_PROFILE_KEY);
    if (current) return {
      name: cleanName(current.name),
      declined: Boolean(current.declined),
      nameUses: $number(current.nameUses, 100),
      lastNameUsePull: $number(current.lastNameUsePull, 100000),
    };
    const legacy = readJSON(LEGACY_NAME_KEY) || {};
    return { name: cleanName(legacy.name), declined: false, nameUses: 0, lastNameUsePull: 0 };
  }

  function defaultLedger() {
    return {
      version: 2,
      journalVersion: 1,
      legacyBaselineTotal: 0,
      legacyBaselinePulls: 0,
      total: 0,
      explorationPoints: 0,
      insightPoints: 0,
      pulls: 0,
      best: 0,
      lastHeat: 0,
      coldRun: 0,
      highInsightPulls: 0,
      deepestPath: 0,
      currentDepthStreak: 0,
      longestDepthStreak: 0,
      awardedSelectionIds: [],
    };
  }

  function loadLedger() {
    const current = readJSON(LEDGER_KEY);
    if (current?.version === 2) {
      const total = $number(current.total);
      const pulls = $number(current.pulls);
      const journalled = $number(current.journalVersion, 99) >= 1;
      return {
      ...defaultLedger(),
      journalVersion: 1,
      legacyBaselineTotal: journalled ? $number(current.legacyBaselineTotal) : total,
      legacyBaselinePulls: journalled ? $number(current.legacyBaselinePulls) : pulls,
      total,
      explorationPoints: $number(current.explorationPoints),
      insightPoints: $number(current.insightPoints),
      pulls,
      best: $number(current.best, 10),
      lastHeat: $number(current.lastHeat, 10),
      coldRun: $number(current.coldRun),
      highInsightPulls: $number(current.highInsightPulls),
      deepestPath: $number(current.deepestPath),
      currentDepthStreak: $number(current.currentDepthStreak),
      longestDepthStreak: $number(current.longestDepthStreak),
      awardedSelectionIds: Array.isArray(current.awardedSelectionIds)
        ? current.awardedSelectionIds.map((id) => cleanText(id, 140)).filter(Boolean).slice(-5000)
        : [],
      };
    }
    const old = readJSON(LEDGER_V1_KEY) || {};
    const legacyTotal = $number(old.total);
    const legacyPulls = $number(old.pulls);
    return {
      ...defaultLedger(),
      legacyBaselineTotal: legacyTotal,
      legacyBaselinePulls: legacyPulls,
      total: legacyTotal,
      pulls: legacyPulls,
      best: $number(old.best, 10),
      lastHeat: $number(old.lastHeat, 10),
      coldRun: $number(old.coldRun),
    };
  }

  function defaultRanking() {
    return {
      version: 2,
      activeDays: [],
      impressions: { role: {}, lens: {}, heat: {}, promise: {} },
      outcomes: [],
    };
  }

  const rankingHeatBucket = (heat) => heat >= 8 ? "high" : heat <= 3 ? "low" : "mid";

  function sanitizedRankingCounter(value, allowed) {
    return Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {})
      .filter(([key]) => allowed.has(key))
      .map(([key, count]) => [key, $number(count, 100000)])
      .filter(([, count]) => count > 0));
  }

  function sanitizeRanking(value) {
    const source = value && typeof value === "object" ? value : {};
    const activeDays = [...new Set((Array.isArray(source.activeDays) ? source.activeDays : [])
      .map((day) => cleanText(day, 10))
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))]
      .sort()
      .slice(-RANKING_ACTIVE_DAY_LIMIT);
    const outcomes = (Array.isArray(source.outcomes) ? source.outcomes : [])
      .flatMap((outcome) => {
        const id = cleanText(outcome?.id, 140);
        const role = canonicalRole(outcome?.role);
        const lens = cleanText(outcome?.lens, 30).toLowerCase();
        const heat = ["low", "mid", "high"].includes(outcome?.heat) ? outcome.heat : "";
        const promise = VALID_PROMISES.has(outcome?.promise) ? outcome.promise : PROMISE_FOR_ROLE[role];
        if (!id || !VALID_ROLES.has(role) || !VALID_LENSES.has(lens) || !heat) return [];
        const alternatives = (Array.isArray(outcome?.alternatives) ? outcome.alternatives : []).flatMap((alternative) => {
          const alternativeRole = canonicalRole(alternative?.role);
          const alternativeLens = cleanText(alternative?.lens, 30).toLowerCase();
          const alternativePromise = VALID_PROMISES.has(alternative?.promise) ? alternative.promise : PROMISE_FOR_ROLE[alternativeRole];
          const alternativeHeat = ["low", "mid", "high"].includes(alternative?.heat) ? alternative.heat : "";
          if (!VALID_ROLES.has(alternativeRole) || !VALID_LENSES.has(alternativeLens) || !alternativeHeat || !VALID_PROMISES.has(alternativePromise)) return [];
          return [{
            role: alternativeRole,
            lens: alternativeLens,
            heat: alternativeHeat,
            promise: alternativePromise,
            position: Math.max(1, Math.min(3, $number(alternative?.position, 3) || 1)),
          }];
        }).slice(0, 2);
        return [{
          id,
          role,
          lens,
          heat,
          promise,
          alternatives,
          position: Math.max(1, Math.min(3, $number(outcome?.position, 3) || 1)),
          startDepth: $number(outcome?.startDepth, 999),
          maxDepth: $number(outcome?.maxDepth, 999),
          selectedAt: $number(outcome?.selectedAt),
          updatedAt: $number(outcome?.updatedAt),
          answerVisible: outcome?.answerVisible === true,
          continued: outcome?.continued === true,
          failed: outcome?.failed === true,
          returned: outcome?.returned === true,
        }];
      })
      .sort((left, right) => left.selectedAt - right.selectedAt)
      .slice(-RANKING_OUTCOME_LIMIT);
    return {
      version: 2,
      activeDays,
      impressions: {
        role: sanitizedRankingCounter(source.impressions?.role, VALID_ROLES),
        lens: sanitizedRankingCounter(source.impressions?.lens, VALID_LENSES),
        heat: sanitizedRankingCounter(source.impressions?.heat, new Set(["low", "mid", "high"])),
        promise: sanitizedRankingCounter(source.impressions?.promise, VALID_PROMISES),
      },
      outcomes,
    };
  }

  function defaultCuriosity() {
    return {
      version: 3,
      topicCounts: {},
      domainCounts: {},
      roleCounts: {},
      averageDepth: 0,
      depthSamples: 0,
      deepestPath: 0,
      preferredHeatRange: { low: 0, mid: 0, high: 0 },
      recentTopics: [],
      totalPulls: 0,
      ranking: defaultRanking(),
    };
  }

  function boundedCounts(value, allowed = null) {
    const entries = Object.entries(value && typeof value === "object" ? value : {})
      .filter(([key]) => !allowed || allowed.has(key))
      .map(([key, count]) => [cleanText(key, 36).toLowerCase(), $number(count, 100000)])
      .filter(([key, count]) => key && count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    return Object.fromEntries(entries);
  }

  const SENSITIVE_TOPIC_PATTERN = /\b(?:abortion|abuse|adhd|addiction|anxiety|autism|bipolar|cancer|custody|depression|diagnos(?:is|ed)?|disability|divorce|eating[- ]?disorder|fertility|grief|health|illness|medical|medication|miscarriage|pregnancy|relationship|self[- ]?harm|sex|sexuality|suicid(?:e|al)|therapy|trauma)\b/i;
  const isSensitiveTopic = (topic) => SENSITIVE_TOPIC_PATTERN.test(cleanText(topic, 80));

  function boundedTopicCounts(value, recentTopics = []) {
    const counts = Object.entries(value && typeof value === "object" ? value : {})
      .map(([key, count]) => [cleanText(key, 36).toLowerCase(), $number(count, 100000)])
      .filter(([key, count]) => key && count > 0 && !isSensitiveTopic(key));
    const byFrequency = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 28);
    const selected = new Map(byFrequency);
    const countMap = new Map(counts);
    for (const topic of recentTopics) {
      if (selected.size >= 40) break;
      const key = cleanText(topic, 36).toLowerCase();
      if (key && !isSensitiveTopic(key) && countMap.has(key)) selected.set(key, countMap.get(key));
    }
    for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      if (selected.size >= 40) break;
      selected.set(key, count);
    }
    return Object.fromEntries(selected);
  }

  function loadCuriosity() {
    const current = readJSON(CURIOSITY_KEY) || {};
    const recentTopics = Array.isArray(current.recentTopics)
      ? current.recentTopics.map((topic) => cleanText(topic, 36).toLowerCase())
        .filter((topic) => topic && !isSensitiveTopic(topic)).slice(0, 12)
      : [];
    return {
      ...defaultCuriosity(),
      topicCounts: boundedTopicCounts(current.topicCounts, recentTopics),
      domainCounts: boundedCounts(current.domainCounts, new Set(DOMAINS)),
      roleCounts: boundedCounts(current.roleCounts, VALID_ROLES),
      averageDepth: $number(current.averageDepth, 999),
      depthSamples: $number(current.depthSamples, 100000),
      deepestPath: $number(current.deepestPath, 999),
      preferredHeatRange: {
        low: $number(current.preferredHeatRange?.low),
        mid: $number(current.preferredHeatRange?.mid),
        high: $number(current.preferredHeatRange?.high),
      },
      recentTopics,
      totalPulls: $number(current.totalPulls),
      ranking: sanitizeRanking(current.ranking),
    };
  }

  const v2ThreadsRawAtBoot = readRaw(THREADS_KEY);
  const legacyThreadBackups = v2ThreadsRawAtBoot ? [] : [THREADS_V1_KEY, LEGACY_THREADS_KEY]
    .map((key) => ({ key, raw: readRaw(key) }))
    .filter((entry) => entry.raw !== null);
  let threadMigrationPending = !v2ThreadsRawAtBoot && legacyThreadBackups.length > 0;
  let state = loadThreads();
  let curiosityGraph = null;
  let nameProfile = loadNameProfile();
  let ledger = loadLedger();
  let curiosity = loadCuriosity();
  let dailyRevealTimer = null;
  let dailyEpisode = null;
  let dailyStats = { available: false, participants: 0, nodes: {} };
  let dailyLoadState = "loading";
  let dailyProgress = loadDailyProgress();
  let dailyRootSelectionPending = false;
  let rabbitLauncherTracked = false;
  let homeHeroCategory = HOMEPAGE_CATEGORIES[0];
  let homeHeroRotationTimer = null;
  let homeHeroTypingTimer = null;
  let homeHeroPaused = false;
  const homeHeroSeeds = new Map();
  let active = null;
  let navigationEpoch = 0;
  let foregroundController = null;
  let transitionTimer = null;
  let toastTimer = null;
  let pendingRequest = null;
  let persistenceRequestStarted = false;
  const volatileThreadIds = new Set();
  const warnedStorageAreas = new Set();
  let lastVisibleNodeId = "";
  let historyReturnFocus = null;
  let interaction = { status: "idle", nodeId: "", answerVisibleAt: 0 };
  const shownImpressions = new Set();
  const receiptControllers = new Map();
  const DOOR_FEEDBACK_HOLD_MS = 520;

  function pacificDayKey(timestamp = Date.now()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  const previousVisit = readJSON(VISIT_KEY);
  const nowAtBoot = Date.now();
  const currentPacificDay = pacificDayKey(nowAtBoot);
  const previousVisitAt = $number(previousVisit?.lastVisitAt);
  const hasMeaningfulHistory = state.threads.some((thread) => completedNodes(thread).length >= 2);
  const RETURNING = Boolean(
    hasMeaningfulHistory &&
    previousVisitAt &&
    nowAtBoot - previousVisitAt >= MEANINGFUL_RETURN_AWAY_MS &&
    pacificDayKey(previousVisitAt) !== currentPacificDay
  );
  if (!DEBUG) removeStoredKey(ANALYTICS_KEY);
  writeJSON(VISIT_KEY, { ...(previousVisit && typeof previousVisit === "object" ? previousVisit : {}), lastVisitAt: nowAtBoot });

  const session = {
    id: uid("session"),
    startedAt: Date.now(),
    typedFollowups: 0,
    pulls: 0,
    abandonedTracked: false,
    returnAcknowledgementAvailable: RETURNING,
    nameCadenceClaimed: false,
  };

  function resetPathSession() {
    session.typedFollowups = 0;
    session.pulls = 0;
    session.abandonedTracked = false;
    shownImpressions.clear();
  }

  function mergeThreadLists(preferredThreads, storedThreads) {
    const merged = new Map();
    for (const thread of [...storedThreads, ...preferredThreads]) {
      const existing = merged.get(thread.id);
      if (!existing || thread.updatedAt >= existing.updatedAt) merged.set(thread.id, thread);
    }
    return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function storedThreadsForMerge() {
    const raw = readRaw(THREADS_KEY);
    if (!raw) return [];
    try {
      const payload = JSON.parse(raw);
      if (!Array.isArray(payload?.threads)) {
        threadLoadIssue = { raw, reason: "invalid_shape" };
        threadQuarantined = false;
        return null;
      }
      const usedIds = new Set();
      const threads = payload.threads.map((thread, index) => sanitizeThread(thread, index, usedIds)).filter(Boolean);
      if (threads.length !== payload.threads.length) {
        threadLoadIssue = { raw, reason: "rejected_threads" };
        threadQuarantined = false;
        return null;
      }
      return threads;
    } catch {
      threadLoadIssue = { raw, reason: "invalid_json" };
      threadQuarantined = false;
      return null;
    }
  }

  function persistThreads({ mergeStored = true } = {}) {
    if (!quarantineThreadIssue()) return false;
    let candidateThreads;
    try { candidateThreads = structuredClone(state.threads); }
    catch {
      try { candidateThreads = JSON.parse(JSON.stringify(state.threads)); }
      catch { return false; }
    }
    if (mergeStored && !threadMigrationPending) {
      const storedThreads = storedThreadsForMerge();
      if (storedThreads === null) {
        if (!quarantineThreadIssue()) return false;
      } else {
        candidateThreads = mergeThreadLists(candidateThreads, storedThreads);
      }
    }
    const fullPayload = { version: 2, threads: candidateThreads };

    // Migration is all-or-nothing: never make a receipt-stripped or
    // turn-pruned payload the only durable copy of an older history.
    if (threadMigrationPending) {
      const fullPayloadRaw = serializedJSON(fullPayload);
      if (!fullPayloadRaw) return false;
      if (writeRaw(THREADS_KEY, fullPayloadRaw)) {
        for (const backup of legacyThreadBackups) removeStoredKey(backup.key);
        threadMigrationPending = false;
        return true;
      }
      for (const backup of legacyThreadBackups) removeStoredKey(backup.key);
      if (writeRaw(THREADS_KEY, fullPayloadRaw)) {
        threadMigrationPending = false;
        return true;
      }
      removeStoredKey(THREADS_KEY);
      for (const backup of legacyThreadBackups) {
        try { localStorage.setItem(backup.key, backup.raw); } catch {}
      }
      return false;
    }

    const tryCandidate = () => {
      const payload = { version: 2, threads: candidateThreads };
      const raw = serializedJSON(payload);
      if (!raw) return false;
      // The graph is a recoverable shadow during this release. Preserve accepted
      // paths first: evict the graph before pruning receipts, turns or paths.
      if (managedStorageBytes(null, raw) > STORAGE_TARGET_BYTES && readRaw(CURIOSITY_GRAPH_KEY) !== null) {
        removeStoredKey(CURIOSITY_GRAPH_KEY);
      }
      if (managedStorageBytes(null, raw) > STORAGE_TARGET_BYTES) return false;
      if (!writeRaw(THREADS_KEY, raw)) return false;
      state.threads = candidateThreads;
      return true;
    };

    if (tryCandidate()) return true;

    // Compact in deliberate stages. Each path is serialized at most once per
    // stage, instead of once for every removed message pair.
    for (const thread of [...candidateThreads].reverse()) {
      for (const message of thread.messages || []) {
        if (message.role === "assistant" && message.sources?.length) message.sources = [];
      }
      if (tryCandidate()) return true;
    }
    for (const thread of [...candidateThreads].reverse()) {
      if (thread.messages.length > 4) thread.messages = thread.messages.slice(-4);
      if (tryCandidate()) return true;
    }
    while (candidateThreads.length > 1) {
      candidateThreads.pop();
      if (tryCandidate()) return true;
    }
    return false;
  }

  function persistNameProfile() {
    const persisted = writeJSON(NAME_PROFILE_KEY, nameProfile);
    if (!persisted) warnStorageHealth("profile");
    return persisted;
  }
  function persistLedger() { return writeJSON(LEDGER_KEY, ledger); }
  function persistCuriosity({ warn = true } = {}) {
    const persisted = writeJSON(CURIOSITY_KEY, curiosity);
    if (!persisted && warn) warnStorageHealth("curiosity");
    return persisted;
  }

  function track(name, properties = {}) {
    const event = {
      eventId: uid("evt"),
      name,
      timestamp: Date.now(),
      monotonicMs: Math.round(performance.now()),
      sessionId: session.id,
      ...properties,
    };
    if (DEBUG) try {
      const storedEvents = readJSON(ANALYTICS_KEY);
      const events = Array.isArray(storedEvents) ? storedEvents : [];
      events.push(event);
      writeJSON(ANALYTICS_KEY, events.slice(-250));
    } catch {}
    if (DEBUG) console.debug("[WHY]", name, properties);
    if (globalThis.WHYConsent?.statisticsAllowed?.() === true) {
      try { globalThis.whyAnalytics?.track?.(name, properties); } catch {}
    }
  }

  function storagePressureState(estimate) {
    const usage = Number(estimate?.usage);
    const quota = Number(estimate?.quota);
    if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return "unknown";
    const ratio = usage / quota;
    return ratio >= 0.8 ? "high" : ratio >= 0.5 ? "medium" : "low";
  }

  async function requestPersistentStorage() {
    if (persistenceRequestStarted) return;
    const storage = navigator.storage;
    if (!storage?.persisted || !storage?.persist) return;
    const previous = readJSON(STORAGE_PERSISTENCE_KEY) || {};
    if (previous.attemptedAt && Date.now() - $number(previous.attemptedAt) < STORAGE_PERSIST_RETRY_MS) return;
    persistenceRequestStarted = true;
    let stateName = "best_effort";
    try {
      const alreadyPersistent = await storage.persisted();
      const granted = alreadyPersistent || await storage.persist();
      stateName = granted ? (alreadyPersistent ? "already_persistent" : "granted") : "best_effort";
      const pressure = storage.estimate ? storagePressureState(await storage.estimate()) : "unknown";
      writeJSON(STORAGE_PERSISTENCE_KEY, { attemptedAt: Date.now(), state: stateName, pressure });
      track("storage_persistence", { state: `${stateName}_${pressure}` });
    } catch {
      writeJSON(STORAGE_PERSISTENCE_KEY, { attemptedAt: Date.now(), state: "error", pressure: "unknown" });
      track("storage_persistence", { state: "error_unknown" });
    }
  }

  function setMenuOpen(open) {
    const menu = $("#navMenu");
    const dropdown = $("#navDropdown");
    const button = $(".nav-menu-btn", menu);
    menu?.classList.toggle("open", Boolean(open));
    button?.setAttribute("aria-expanded", String(Boolean(open)));
    if (dropdown) {
      dropdown.inert = !open;
      dropdown.toggleAttribute("inert", !open);
      dropdown.setAttribute("aria-hidden", String(!open));
    }
  }

  function show(name) {
    Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
    setMenuOpen(false);
    if (name !== "home") stopHomeHeroMotion();
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function inline(value) {
    let output = escapeHtml(value);
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, rawUrl) => {
      try {
        const url = new URL(rawUrl);
        return ["http:", "https:"].includes(url.protocol)
          ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
          : text;
      } catch {
        return text;
      }
    });
  }

  function markdown(markdownText) {
    const lines = String(markdownText || "").replace(/\r/g, "").split("\n");
    const output = [];
    let paragraph = [];
    let list = "";
    const closeParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (!list) return;
      output.push(`</${list}>`);
      list = "";
    };
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { closeParagraph(); closeList(); continue; }
      const heading = line.match(/^(#{2,3})\s+(.+)$/);
      if (heading) {
        closeParagraph(); closeList();
        // "Short answer" was a fixed label on every single reply — a line of chrome
        // above content that is self-evidently the answer. Dropped at render so
        // already-stored history loses it too, not just newly generated replies.
        if (/^short\s+answer$/i.test(heading[2].trim())) continue;
        output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
        continue;
      }
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        closeParagraph();
        const type = ordered ? "ol" : "ul";
        if (list !== type) { closeList(); list = type; output.push(`<${type}>`); }
        output.push(`<li>${inline((unordered || ordered)[1])}</li>`);
        continue;
      }
      closeList();
      paragraph.push(line);
    }
    closeParagraph(); closeList();
    return output.join("");
  }

  function completedNodes(thread) {
    const nodes = [];
    const messages = Array.isArray(thread?.messages) ? thread.messages : [];
    let pendingUser = null;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (message.role === "user") pendingUser = { message, index };
      if (message.role === "assistant" && pendingUser) {
        nodes.push({
          id: message.nodeId || message.id,
          question: pendingUser.message.content,
          user: pendingUser.message,
          userIndex: pendingUser.index,
          answer: message,
          answerIndex: index,
          depth: nodes.length + 1,
        });
        pendingUser = null;
      }
    }
    return nodes;
  }

  function graphNodeKey(node) {
    const identity = `${node?.id || ""}|${node?.question || ""}|${node?.answer?.content || ""}`;
    return `graph_${hashString(identity)}_${hashString([...identity].reverse().join(""))}`;
  }

  function graphQuestionSnapshot(user) {
    return {
      id: cleanText(user?.id, 100),
      content: cleanText(user?.content, 4000),
      source: ["seed", "typed", "door", "daily"].includes(user?.source) ? user.source : "typed",
      ...(cleanText(user?.selectionId, 140) ? { selectionId: cleanText(user.selectionId, 140) } : {}),
      ...(user?.via ? {
        via: {
          doorId: cleanText(user.via.doorId, 100),
          role: VALID_ROLES.has(canonicalRole(user.via.role)) ? canonicalRole(user.via.role) : "",
          promise: VALID_PROMISES.has(user.via.promise) ? user.via.promise : PROMISE_FOR_ROLE[canonicalRole(user.via.role)] || "",
          lens: VALID_LENSES.has(user.via.lens) ? user.via.lens : "",
          domain: safeDomain(user.via.domain),
          label: cleanText(user.via.label, 70),
          copyStyle: ["concept_v1", "question_v1", "question_v2"].includes(user.via.copyStyle) ? user.via.copyStyle : "question_v2",
          heat: clampHeat(user.via.heat),
          memoryConnected: user.via.memoryConnected === true,
        },
      } : {}),
    };
  }

  function graphAnswerSnapshot(answer) {
    return {
      id: cleanText(answer?.id, 100),
      nodeId: cleanText(answer?.nodeId, 100),
      replyTo: cleanText(answer?.replyTo, 100),
      content: cleanSpokenAnswer(answer?.content).trim().slice(0, 8000),
      domain: safeDomain(answer?.domain),
      voiceNote: answer?.voiceNote && typeof answer.voiceNote === "object" ? answer.voiceNote : null,
      sources: validSources(answer?.sources),
      receiptsAvailable: Boolean(answer?.receiptsAvailable),
      groundingStatus: cleanText(answer?.groundingStatus, 60),
      safetyMode: answer?.safetyMode === "crisis" ? "crisis" : "",
      preview: Boolean(answer?.preview),
    };
  }

  function buildCuriosityGraph(threads) {
    const nodes = {};
    const edges = {};
    const paths = [];
    for (const thread of Array.isArray(threads) ? threads : []) {
      const completed = completedNodes(thread);
      const nodeIds = [];
      for (const node of completed) {
        const id = graphNodeKey(node);
        nodeIds.push(id);
        if (!nodes[id]) {
          nodes[id] = {
            id,
            sourceNodeId: cleanText(node.id, 100),
            question: graphQuestionSnapshot(node.user),
            answer: graphAnswerSnapshot(node.answer),
          };
        }
        if (nodeIds.length > 1) {
          const from = nodeIds[nodeIds.length - 2];
          const edgeIdentity = `${from}|${id}|${node.user?.selectionId || node.user?.id || ""}`;
          const edgeId = `edge_${hashString(edgeIdentity)}_${hashString([...edgeIdentity].reverse().join(""))}`;
          if (!edges[edgeId]) {
            edges[edgeId] = {
              id: edgeId,
              from,
              to: id,
              selectionId: cleanText(node.user?.selectionId, 140),
              source: node.user?.source === "door" ? "door" : "typed",
              role: VALID_ROLES.has(canonicalRole(node.user?.via?.role)) ? canonicalRole(node.user.via.role) : "",
              label: cleanText(node.user?.via?.label, 70),
            };
          }
        }
      }
      if (nodeIds.length) {
        paths.push({
          id: cleanText(thread.id, 100),
          title: cleanText(thread.title, 180),
          createdAt: $number(thread.createdAt) || Date.now(),
          updatedAt: $number(thread.updatedAt) || Date.now(),
          nodeIds,
        });
      }
    }
    return { product: "WHY", version: 1, nodes, edges, paths };
  }

  function persistCuriosityGraph(graph) {
    const raw = serializedJSON(graph);
    if (!raw) return false;
    const previousRaw = readRaw(CURIOSITY_GRAPH_KEY);
    const projectedBytes = managedStorageBytes() - (previousRaw ? domStringBytes(CURIOSITY_GRAPH_KEY, previousRaw) : 0) + domStringBytes(CURIOSITY_GRAPH_KEY, raw);
    if (projectedBytes > STORAGE_TARGET_BYTES) {
      removeStoredKey(CURIOSITY_GRAPH_KEY);
      return false;
    }
    return writeRaw(CURIOSITY_GRAPH_KEY, raw);
  }

  function refreshCuriosityGraph() {
    curiosityGraph = buildCuriosityGraph(state.threads);
    return persistCuriosityGraph(curiosityGraph);
  }

  function currentNode(thread = active) {
    const nodes = completedNodes(thread);
    return nodes[nodes.length - 1] || null;
  }

  function trailingUser(thread) {
    const messages = thread?.messages || [];
    const last = messages[messages.length - 1];
    return last?.role === "user" ? last : null;
  }

  function safeTopicWords(query, domain) {
    if (domain === "personal" || /\b(?:my|i|me)\b/i.test(query) || SENSITIVE_TOPIC_PATTERN.test(query)) return [];
    const stop = new Set("why what who how when where which does did do is are was were the a an and or but to of for in on at from with this that it really actually still people human humans thing things".split(" "));
    return cleanText(query, 180).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word)).slice(0, 3);
  }

  function noteCuriosity({ query = "", domain = "", role = "", heat = 0, depth = 0, pull = false }) {
    const safe = safeDomain(domain);
    if (domain) curiosity.domainCounts[safe] = (curiosity.domainCounts[safe] || 0) + 1;
    if (VALID_ROLES.has(role)) curiosity.roleCounts[role] = (curiosity.roleCounts[role] || 0) + 1;
    const topics = safeTopicWords(query, safe);
    for (const topic of topics) curiosity.topicCounts[topic] = (curiosity.topicCounts[topic] || 0) + 1;
    if (topics.length) curiosity.recentTopics = [...topics, ...curiosity.recentTopics.filter((topic) => !topics.includes(topic))].slice(0, 12);
    if (pull) {
      curiosity.totalPulls += 1;
      const bucket = heat >= 8 ? "high" : heat <= 3 ? "low" : "mid";
      curiosity.preferredHeatRange[bucket] += 1;
    }
    if (depth > 0) curiosity.deepestPath = Math.max(curiosity.deepestPath, depth);
    curiosity.topicCounts = boundedTopicCounts(curiosity.topicCounts, curiosity.recentTopics);
    persistCuriosity();
  }

  function noteAcceptedAnswer(query, domain, depth) {
    noteCuriosity({ query, domain, depth });
  }

  function touchRankingDay() {
    const days = new Set(curiosity.ranking.activeDays);
    days.add(currentPacificDay);
    curiosity.ranking.activeDays = [...days].sort().slice(-RANKING_ACTIVE_DAY_LIMIT);
  }

  function noteRankingImpression(door) {
    const role = canonicalRole(door?.role);
    const lens = cleanText(door?.lens, 30).toLowerCase();
    if (!VALID_ROLES.has(role) || !VALID_LENSES.has(lens)) return false;
    const heat = rankingHeatBucket(clampHeat(door?.heat));
    const promise = VALID_PROMISES.has(door?.promise) ? door.promise : PROMISE_FOR_ROLE[role];
    curiosity.ranking.impressions.role[role] = (curiosity.ranking.impressions.role[role] || 0) + 1;
    curiosity.ranking.impressions.lens[lens] = (curiosity.ranking.impressions.lens[lens] || 0) + 1;
    curiosity.ranking.impressions.heat[heat] = (curiosity.ranking.impressions.heat[heat] || 0) + 1;
    curiosity.ranking.impressions.promise[promise] = (curiosity.ranking.impressions.promise[promise] || 0) + 1;
    return true;
  }

  function updateRankingOutcome(selectionId, updates = {}) {
    const id = cleanText(selectionId, 140);
    if (!id) return false;
    const outcome = curiosity.ranking.outcomes.find((candidate) => candidate.id === id);
    if (!outcome) return false;
    if (updates.answerVisible === true) outcome.answerVisible = true;
    if (updates.continued === true) outcome.continued = true;
    if (updates.returned === true) outcome.returned = true;
    if (typeof updates.failed === "boolean") outcome.failed = updates.failed;
    if (Number.isFinite(Number(updates.maxDepth))) outcome.maxDepth = Math.max(outcome.maxDepth, $number(updates.maxDepth, 999));
    outcome.updatedAt = Date.now();
    touchRankingDay();
    persistCuriosity();
    return true;
  }

  function noteRankingSelection(selectionId, door, startDepth, priorSelectionId = "", board = []) {
    if (priorSelectionId) updateRankingOutcome(priorSelectionId, { continued: true, maxDepth: startDepth + 1 });
    const id = cleanText(selectionId, 140);
    if (!id || curiosity.ranking.outcomes.some((outcome) => outcome.id === id)) return;
    curiosity.ranking.outcomes.push({
      id,
      role: canonicalRole(door.role),
      lens: cleanText(door.lens, 30).toLowerCase(),
      heat: rankingHeatBucket(door.heat),
      promise: VALID_PROMISES.has(door.promise) ? door.promise : PROMISE_FOR_ROLE[canonicalRole(door.role)],
      alternatives: (Array.isArray(board) ? board : [])
        .filter((candidate) => candidate?.id !== door.id)
        .slice(0, 2)
        .map((candidate) => ({
          role: canonicalRole(candidate.role),
          lens: cleanText(candidate.lens, 30).toLowerCase(),
          heat: rankingHeatBucket(candidate.heat),
          promise: VALID_PROMISES.has(candidate.promise) ? candidate.promise : PROMISE_FOR_ROLE[canonicalRole(candidate.role)],
          position: Math.max(1, Math.min(3, $number(candidate.position, 3) || 1)),
        })),
      position: Math.max(1, Math.min(3, $number(door.position, 3) || 1)),
      startDepth: $number(startDepth, 999),
      maxDepth: $number(startDepth, 999),
      selectedAt: Date.now(),
      updatedAt: Date.now(),
      answerVisible: false,
      continued: false,
      failed: false,
      returned: false,
    });
    curiosity.ranking.outcomes = curiosity.ranking.outcomes.slice(-RANKING_OUTCOME_LIMIT);
    touchRankingDay();
    persistCuriosity();
  }

  function markRankingReturn() {
    const latest = [...curiosity.ranking.outcomes].reverse().find((outcome) => outcome.answerVisible && !outcome.failed);
    if (latest) updateRankingOutcome(latest.id, { returned: true, maxDepth: latest.maxDepth });
  }

  function memoryCuesFor(currentThreadId) {
    const graph = curiosityGraph || buildCuriosityGraph(state.threads);
    const meaningful = graph.paths.filter((path) => path.nodeIds.length >= 3);
    if (curiosity.totalPulls < MEMORY_MIN_PULLS || meaningful.length < MEMORY_MIN_PATHS) return [];
    const seen = new Set();
    return meaningful
      .filter((path) => path.id !== currentThreadId)
      .sort((left, right) =>
        right.nodeIds.length - left.nodeIds.length ||
        right.updatedAt - left.updatedAt)
      .flatMap((path) => {
        const root = graph.nodes[path.nodeIds[0]];
        const pathNodes = [...path.nodeIds]
          .reverse()
          .map((nodeId) => graph.nodes[nodeId])
          .filter(Boolean);
        const signedNode = pathNodes.find((node) => node?.answer?.voiceNote?.signature?.mechanism);
        const latestNode = pathNodes[0];
        const domain = safeDomain(signedNode?.answer?.domain || root?.answer?.domain);
        if (domain === "personal") return [];
        const topics = safeTopicWords(root?.question?.content, domain).slice(0, 3);
        const derivedMechanism = safeTopicWords(latestNode?.question?.content, domain).slice(0, 4).join(" ");
        const mechanism = cleanText(signedNode?.answer?.voiceNote?.signature?.mechanism || derivedMechanism, 48).toLowerCase();
        const entity = cleanText(signedNode?.answer?.voiceNote?.signature?.entity || topics[0], 48).toLowerCase();
        const key = `${mechanism}|${entity}|${topics.join("|")}`;
        if (!topics.length || !mechanism || isSensitiveTopic(mechanism) || isSensitiveTopic(entity) || seen.has(key)) return [];
        seen.add(key);
        return [{ domain, topics, mechanism, entity }];
      })
      .slice(0, 3);
  }

  function curiositySummary(currentThreadId) {
    return {
      memoryCues: memoryCuesFor(currentThreadId).slice(0, 1),
    };
  }

  function recentLabel(query) {
    const words = safeTopicWords(query, "public");
    return (words.length ? words : cleanText(query, 80).split(" ")).slice(0, 3).join(" ");
  }

  function loadDailyProgress() {
    const source = readJSON(DAILY_PROGRESS_KEY);
    const tokens = {};
    for (const [episodeId, token] of Object.entries(source?.tokens || {}).slice(-14)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(episodeId) && /^[A-Za-z0-9_-]{20,96}$/.test(String(token || ""))) tokens[episodeId] = token;
    }
    const results = {};
    for (const [key, result] of Object.entries(source?.results || {}).slice(-40)) {
      const counts = Object.fromEntries(Object.entries(result?.counts || {})
        .slice(0, 3)
        .map(([doorId, count]) => [cleanText(doorId, 100), $number(count, 10000000)]));
      results[cleanText(key, 160)] = {
        selectedDoorId: cleanText(result?.selectedDoorId, 100),
        total: $number(result?.total, 10000000),
        counts,
        available: result?.available === true,
        pending: result?.pending === true,
        updatedAt: $number(result?.updatedAt),
      };
    }
    const revealedEpisodes = Array.isArray(source?.revealedEpisodes)
      ? source.revealedEpisodes.filter((episodeId) => /^\d{4}-\d{2}-\d{2}$/.test(episodeId)).slice(-14)
      : [];
    return { version: 1, tokens, results, revealedEpisodes };
  }

  function persistDailyProgress() {
    writeJSON(DAILY_PROGRESS_KEY, dailyProgress);
  }

  function normalizeDailyEpisode(value) {
    const episodeId = cleanText(value?.id, 32);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(episodeId)) return null;
    const nodes = (Array.isArray(value?.nodes) ? value.nodes : []).slice(0, 12).flatMap((node) => {
      const id = cleanText(node?.id, 100);
      const question = cleanText(node?.question, 180);
      const answer = cleanText(node?.answer, 4000);
      const domain = safeDomain(node?.domain);
      if (!id || !question || !answer) return [];
      const doors = (Array.isArray(node?.doors) ? node.doors : []).slice(0, 3).flatMap((door) => {
        const label = cleanText(door?.label, 24).toLowerCase();
        let query = cleanText(door?.query, 160).toLowerCase().replace(/[.!]+$/g, "");
        if (!query.endsWith("?")) query = `${query}?`;
        const role = canonicalRole(door?.role);
        const promise = VALID_PROMISES.has(door?.promise) ? door.promise : PROMISE_FOR_ROLE[role];
        const lens = cleanText(door?.lens, 30).toLowerCase();
        if (!cleanText(door?.id, 100) || !isConceptDoorLabel(label) || !isQuestionDoorLabel(query) || !VALID_ROLES.has(role) || !VALID_PROMISES.has(promise) || !LENS_SETS[domain].includes(lens)) return [];
        return [{
          id: cleanText(door.id, 100),
          query,
          label,
          role,
          promise,
          lens,
          domain,
          heat: clampHeat(door?.heat) || 7,
          grounding: ["off", "optional", "required"].includes(door?.grounding) ? door.grounding : "optional",
          targetNodeId: cleanText(door?.targetNodeId, 100),
        }];
      });
      if (doors.length !== 3) return [];
      return [{ id, question, answer, domain, sources: validSources(node?.sources), doors }];
    });
    const rootNodeId = cleanText(value?.rootNodeId, 100);
    const nodeIds = new Set(nodes.map((node) => node.id));
    if (!nodes.length || !nodeIds.has(rootNodeId) || nodes.some((node) => node.doors.some((door) => door.targetNodeId && !nodeIds.has(door.targetNodeId)))) return null;
    return {
      id: episodeId,
      publishedDate: cleanText(value?.publishedDate, 10) || episodeId,
      slug: cleanText(value?.slug, 80),
      question: cleanText(value?.question, 180),
      rootNodeId,
      nodes,
    };
  }

  function normalizeDailyStats(value) {
    const nodes = {};
    for (const [nodeId, node] of Object.entries(value?.nodes || {}).slice(0, 20)) {
      const counts = Object.fromEntries(Object.entries(node?.counts || {}).slice(0, 3)
        .map(([doorId, count]) => [cleanText(doorId, 100), $number(count, 10000000)]));
      nodes[cleanText(nodeId, 100)] = { total: $number(node?.total, 10000000), counts };
    }
    return {
      available: value?.available === true,
      participants: $number(value?.participants, 10000000),
      nodes,
    };
  }

  // Mirrors netlify/lib/slate-order.mjs exactly. Presentation order must be a
  // deterministic function of this browser's own per-episode token so the server
  // can recompute the slot a door occupied without trusting the client, while
  // the token stays per-episode and votes stay unlinkable across days.
  const fnv1a = (value) => {
    let hash = 0x811c9dc5;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };
  const avalanche = (value) => {
    let hash = value >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
  const slotKey = (token, nodeId, doorId) => avalanche(fnv1a(`${token}:${nodeId}:${doorId}`));
  const permuteDoors = (doors, token, nodeId) => {
    const list = Array.isArray(doors) ? doors.slice() : [];
    if (!token) return list;
    return list
      .map((door) => ({ door, key: slotKey(token, nodeId, door?.id || "") }))
      .sort((a, b) => (a.key - b.key) || (String(a.door?.id) < String(b.door?.id) ? -1 : 1))
      .map((entry) => entry.door);
  };

  // The vote split is already fetched and, until now, discarded. Showing it is
  // what turns a private choice into something worth carrying out of the page.
  function dailySplitCopy(nodeId) {
    const node = dailyNode(nodeId);
    const result = dailyProgress.results[dailyResultKey(nodeId)];
    if (!node || !result || !result.available) return [];
    const total = Math.max(1, $number(result.total, 10000000));
    return permuteDoors(node.doors, dailyBrowserToken(), node.id).map((door) => ({
      id: door.id,
      label: door.query,
      stake: clampHeat(door.heat),
      share: Math.round(($number(result.counts?.[door.id], 10000000) / total) * 100),
      mine: door.id === result.selectedDoorId,
    }));
  }

  function dailyNode(nodeId) {
    return dailyEpisode?.nodes?.find((node) => node.id === nodeId) || null;
  }

  function dailyDoor(nodeId, doorId) {
    return dailyNode(nodeId)?.doors?.find((door) => door.id === doorId) || null;
  }

  function dailyResultKey(nodeId) {
    return `${dailyEpisode?.id || "unknown"}:${nodeId}`;
  }

  function dailyBrowserToken() {
    if (!dailyEpisode) return "";
    const existing = dailyProgress.tokens[dailyEpisode.id];
    if (/^[A-Za-z0-9_-]{20,96}$/.test(existing || "")) return existing;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
    dailyProgress.tokens[dailyEpisode.id] = token;
    persistDailyProgress();
    return token;
  }

  function dailyExplorerCopy() {
    if (!dailyStats.available) return "collective paths appear after you choose";
    const count = dailyStats.participants;
    if (count < 1) return "be the first recorded explorer";
    return `${count.toLocaleString()} recorded ${count === 1 ? "explorer" : "explorers"} today`;
  }

  async function recordDailyChoice(nodeId, doorId) {
    if (!dailyEpisode || !dailyDoor(nodeId, doorId)) return null;
    const key = dailyResultKey(nodeId);
    const previous = dailyProgress.results[key];
    const known = dailyStats.nodes?.[nodeId] || { total: 0, counts: {} };
    const selectedDoorId = previous?.selectedDoorId || doorId;
    dailyProgress.results[key] = {
      selectedDoorId,
      total: known.total,
      counts: { ...known.counts },
      available: dailyStats.available,
      pending: true,
      updatedAt: Date.now(),
    };
    persistDailyProgress();
    try {
      const response = await fetch("/api/daily-why", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId: dailyEpisode.id,
          nodeId,
          doorId,
          browserToken: dailyBrowserToken(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("count unavailable");
      dailyStats.available = true;
      dailyStats.participants = $number(payload.participants, 10000000);
      dailyStats.nodes[nodeId] = { total: $number(payload.total, 10000000), counts: payload.counts || {} };
      dailyProgress.results[key] = {
        selectedDoorId: cleanText(payload.selectedDoorId, 100) || selectedDoorId,
        total: $number(payload.total, 10000000),
        counts: payload.counts || {},
        available: true,
        pending: false,
        updatedAt: Date.now(),
      };
      persistDailyProgress();
      const countedDoorId = cleanText(payload.selectedDoorId, 100) || selectedDoorId;
      return {
        available: true,
        recorded: payload.recorded === true,
        selectedDoorId: countedDoorId,
        count: $number(payload.counts?.[countedDoorId], 10000000),
        total: $number(payload.total, 10000000),
      };
    } catch {
      dailyProgress.results[key] = { ...dailyProgress.results[key], pending: false, available: false, updatedAt: Date.now() };
      persistDailyProgress();
      return null;
    }
  }

  async function loadDailyWhy() {
    if (ADS_DEMO) {
      dailyLoadState = "failed";
      return;
    }
    const requestedEpisode = DAILY_PAGE_ID;
    const apiUrl = requestedEpisode ? `/api/daily-why?episode=${encodeURIComponent(requestedEpisode)}` : "/api/daily-why";
    const staticUrl = requestedEpisode ? `/daily/${encodeURIComponent(requestedEpisode)}/episode.json` : "/daily-why.json";
    let payload = null;
    try {
      const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (response.ok) payload = await response.json();
    } catch {}
    if (!normalizeDailyEpisode(payload?.episode)) {
      try {
        const response = await fetch(staticUrl, { headers: { Accept: "application/json" } });
        if (response.ok) payload = await response.json();
      } catch {}
    }
    dailyEpisode = normalizeDailyEpisode(payload?.episode);
    dailyStats = normalizeDailyStats(payload?.stats);
    dailyLoadState = dailyEpisode ? "ready" : "failed";
    if (DAILY_PAGE_ID && !active && !views.home.hidden) renderSeeds();
  }

  function dailyVoiceNote(node) {
    return {
      domain: node.domain,
      prompt: "three ways forward",
      copyStyle: "question_v2",
      // `label` is what every door board paints. Episodes store a compact internal
      // handle there and the real question in `query`, which is why the homepage
      // was showing two-word abstractions instead of something worth clicking.
      pulls: permuteDoors(node.doors, dailyBrowserToken(), node.id).map((door) => ({ ...door, label: door.query, memoryConnected: false })),
    };
  }

  function appendDailyAnswer(thread, user, node) {
    thread.messages.push({
      id: uid("answer"),
      nodeId: node.id,
      replyTo: user.id,
      role: "assistant",
      content: node.answer,
      domain: node.domain,
      voiceNote: dailyVoiceNote(node),
      sources: node.sources,
      receiptsAvailable: false,
      groundingStatus: "editorial_sources",
      doorState: "ready",
      doorGeneration: { status: "editorial", attempts: 0, candidateCount: 3 },
      safetyMode: "",
      preview: false,
    });
  }

  function setDailyPathUrl(replace = false) {
    if (!dailyEpisode || location.protocol === "file:") return;
    const method = replace ? "replaceState" : "pushState";
    try { history[method]({ dailyWhy: dailyEpisode.id }, "", `/daily/${dailyEpisode.id}/`); } catch {}
  }

  function openDailyRootPath(root, door, position) {
    const target = dailyNode(door.targetNodeId);
    if (!target) {
      startPath(door.query, "daily", root.domain);
      return;
    }
    invalidateNavigation();
    resetPathSession();
    ledger.currentDepthStreak = 0;
    persistLedger();
    const thread = newThread(root.question);
    thread.dailyEpisodeId = dailyEpisode.id;
    const via = {
      ...door,
      doorId: door.id,
      copyStyle: "question_v2",
      domain: root.domain,
      position,
      dailyParentNodeId: root.id,
    };
    const selectionId = stableSelectionId(thread.id, root.id, door.id, door.query);
    const user = appendUser(thread, root.question, "daily", via, selectionId);
    user.awardState = "committed";
    appendDailyAnswer(thread, user, target);
    active = thread;
    state.threads.unshift(thread);
    const result = scoreSelection({ selectionId, heat: door.heat, depth: 1 });
    session.pulls = 1;
    noteCuriosity({ role: door.role, heat: door.heat, pull: true });
    noteAcceptedAnswer(door.query, target.domain, 1);
    noteRankingSelection(selectionId, via, 0, "", dailyVoiceNote(root).pulls);
    if (!saveThread(thread)) warnVolatileThread(thread.id, "daily_start");
    writeJSON(VISIT_KEY, { ...(readJSON(VISIT_KEY) || {}), dailyCompletedDay: currentPacificDay, lastVisitAt: Date.now() });
    setDailyPathUrl();
    track("rabbit_hole_started", { source: "daily", depth: 1, zeroTyping: true });
    track("door_selected", { source: "daily", depth: 0, nextDepth: 1, position, role: door.role, promise: door.promise, copyStyle: "question_v2" });
    if (!result.duplicate) track("first_door_selected", { source: "daily", depth: 0, nextDepth: 1, position, role: door.role, promise: door.promise, copyStyle: "question_v2" });
    renderActiveNode(thread);
  }

  function showDailySplitReveal(nodeId, selectedDoorId) {
    const card = $(".daily-home-card");
    const board = card && $("[data-daily-root-board]", card);
    const split = dailySplitCopy(nodeId);
    if (!card || !board || split.length !== 3) return false;
    const selected = split.find((door) => door.id === selectedDoorId);
    if (!selected) return false;
    board.classList.add("is-split");
    board.setAttribute("aria-label", "How people chose");
    board.innerHTML = `<strong class="daily-split-choice">you chose ${escapeHtml(selected.label)}</strong><div class="daily-split-bars">${split.map((door) => `<span class="daily-split-item${door.mine ? " is-mine" : ""}"><b>${escapeHtml(door.label)}</b><i>${door.share}%</i></span>`).join("")}</div>`;
    card.classList.add("is-showing-split");
    track("todays_why_split_revealed", { source: "daily", doorCount: 3 });
    return true;
  }

  async function selectDailyRootDoor(button) {
    if (dailyRootSelectionPending || !dailyEpisode) return;
    const root = dailyNode(dailyEpisode.rootNodeId);
    const door = root && dailyDoor(root.id, cleanText(button.dataset.dailyDoorId, 100));
    if (!root || !door) return;
    const position = Math.max(1, Math.min(3, Number(button.dataset.position) || 1));
    const selectionEpoch = navigationEpoch;
    dailyRootSelectionPending = true;
    markDailyRevealSeen();
    clearTimeout(dailyRevealTimer);
    dailyRevealTimer = null;
    const board = button.closest("[data-daily-root-board]");
    board?.classList.add("is-resolving");
    board?.querySelectorAll("button").forEach((candidate) => {
      candidate.disabled = true;
      candidate.classList.toggle("is-selected", candidate === button);
    });
    triggerDoorHaptic({ jackpot: false, gained: 3 });
    track("todays_why_selected", { source: "daily", depth: 0, position, role: door.role, promise: door.promise });

    const proofPromise = recordDailyChoice(root.id, door.id);
    const proof = await Promise.race([proofPromise, wait(700).then(() => null)]);
    if (selectionEpoch !== navigationEpoch || !button.isConnected) {
      dailyRootSelectionPending = false;
      return;
    }
    const matchesSelection = proof?.selectedDoorId === door.id;
    const splitShown = matchesSelection && showDailySplitReveal(root.id, door.id);
    await wait(splitShown ? (REDUCED_MOTION.matches ? 650 : 850) : (REDUCED_MOTION.matches ? 0 : 220));
    openDailyRootPath(root, door, position);
    dailyRootSelectionPending = false;
  }

  function markDailyRevealSeen() {
    if (!dailyEpisode || dailyProgress.revealedEpisodes.includes(dailyEpisode.id)) return;
    dailyProgress.revealedEpisodes = [...dailyProgress.revealedEpisodes, dailyEpisode.id].slice(-14);
    persistDailyProgress();
  }

  function finishDailyReveal(card, electrify = true) {
    if (!card?.isConnected) return;
    const target = $("[data-daily-question]", card);
    if (target) {
      target.textContent = dailyEpisode?.question || target.textContent;
      target.classList.remove("is-typing");
    }
    card.classList.add("is-ready");
    if (electrify && !REDUCED_MOTION.matches) {
      card.classList.add("is-electrified");
      setTimeout(() => card.classList.remove("is-electrified"), 3050);
    }
    markDailyRevealSeen();
  }

  function revealDailyQuestion() {
    clearTimeout(dailyRevealTimer);
    dailyRevealTimer = null;
    const card = $(".daily-home-card");
    const target = card && $("[data-daily-question]", card);
    if (!card || !target || !dailyEpisode) return;
    const question = dailyEpisode.question;
    if (REDUCED_MOTION.matches || dailyProgress.revealedEpisodes.includes(dailyEpisode.id)) {
      finishDailyReveal(card, false);
      return;
    }
    const characters = Array.from(question);
    const weight = characters.reduce((sum, character) => sum + (/[?!.:;,]/.test(character) ? 2.8 : 1), 0);
    const pace = Math.max(37, Math.min(97, 3350 / Math.max(1, weight)));
    let index = 0;
    target.textContent = "";
    target.classList.add("is-typing");
    const typeNext = () => {
      if (!card.isConnected) return;
      if (index >= characters.length) {
        dailyRevealTimer = setTimeout(() => {
          dailyRevealTimer = null;
          finishDailyReveal(card);
        }, 280);
        return;
      }
      const character = characters[index];
      target.textContent += character;
      index += 1;
      dailyRevealTimer = setTimeout(typeNext, pace * (/[?!.:;,]/.test(character) ? 2.8 : 1));
    };
    dailyRevealTimer = setTimeout(typeNext, 300);
  }

  function exploredQuestions() {
    return new Set(
      state.threads
        .flatMap((thread) => completedNodes(thread).map((node) => cleanText(node.question, 4000).toLowerCase()))
        .filter(Boolean)
        .slice(0, 300),
    );
  }

  // Pools are generated once per category per day and shared by everyone who
  // arrives that day, so the first choice stays comparable across people. The
  // built-in SEED_BANK is the floor, never the ceiling: if generation is
  // unavailable the launchpad still works, it is just less fresh.
  const categorySeedPools = new Map();
  let categorySeedDay = "";

  function localCategoryPool(category) {
    return SEED_BANK.filter((seed) => seed.category === category);
  }

  async function loadCategorySeeds(category) {
    const day = currentPacificDay;
    if (categorySeedDay !== day) { categorySeedPools.clear(); categorySeedDay = day; }
    if (categorySeedPools.has(category)) return categorySeedPools.get(category);
    if (SWARM_DEMO) {
      const seeds = localCategoryPool(category);
      categorySeedPools.set(category, seeds);
      return seeds;
    }
    categorySeedPools.set(category, null);
    try {
      const response = await fetch(`/api/category-seeds?category=${encodeURIComponent(category)}`);
      if (!response.ok) return null;
      const payload = await response.json();
      const seeds = (Array.isArray(payload?.seeds) ? payload.seeds : [])
        .map((seed) => ({
          category,
          domain: safeDomain(seed?.domain),
          label: cleanText(seed?.label, 40).toLowerCase(),
          query: cleanText(seed?.query, 4000),
        }))
        .filter((seed) => seed.label && seed.query.endsWith("?"));
      if (seeds.length) categorySeedPools.set(category, seeds);
      return seeds.length ? seeds : null;
    } catch {
      return null;
    }
  }

  function prefetchCategorySeeds() {
    for (const category of RABBIT_CATEGORIES) loadCategorySeeds(category);
  }

  function chooseRabbitSeed(category) {
    const normalized = cleanText(category, 32).toLowerCase();
    if (!RABBIT_CATEGORIES.includes(normalized)) return null;
    const pool = categorySeedPools.get(normalized) || localCategoryPool(normalized);
    if (!pool.length) return null;
    const stored = readJSON(RABBIT_HOLE_KEY) || {};
    const cursors = stored.cursors && typeof stored.cursors === "object" ? stored.cursors : {};
    const lastQueries = stored.lastQueries && typeof stored.lastQueries === "object" ? stored.lastQueries : {};
    const cursor = Math.max(0, Math.floor(Number(cursors[normalized]) || 0));
    const dayOffset = Number.parseInt(hashString(`${currentPacificDay}:${normalized}`), 36) || 0;
    const offset = (dayOffset + cursor) % pool.length;
    const rotated = pool.slice(offset).concat(pool.slice(0, offset));
    const asked = exploredQuestions();
    const lastQuery = cleanText(lastQueries[normalized], 4000).toLowerCase();
    const seed = rotated.find((candidate) => !asked.has(candidate.query.toLowerCase()) && candidate.query.toLowerCase() !== lastQuery)
      || rotated.find((candidate) => candidate.query.toLowerCase() !== lastQuery)
      || rotated[0];
    writeJSON(RABBIT_HOLE_KEY, {
      cursors: { ...cursors, [normalized]: cursor + 1 },
      lastQueries: { ...lastQueries, [normalized]: seed.query },
    });
    return seed;
  }

  function rabbitHoleMarkup() {
    return `<section class="rabbit-launcher" aria-labelledby="rabbitLauncherTitle">
      <h2 id="rabbitLauncherTitle">Pick a rabbit hole</h2>
      <div class="rabbit-grid">${RABBIT_CATEGORIES.map((category) => `<button class="rabbit-category" type="button" data-rabbit-category="${category}">${category}</button>`).join("")}</div>
    </section>`;
  }

  function stopHomeHeroMotion() {
    clearTimeout(homeHeroRotationTimer);
    clearTimeout(homeHeroTypingTimer);
    homeHeroRotationTimer = null;
    homeHeroTypingTimer = null;
  }

  function homeHeroSeed(category) {
    if (homeHeroSeeds.has(category)) return homeHeroSeeds.get(category);
    const seed = chooseRabbitSeed(category);
    if (seed) homeHeroSeeds.set(category, seed);
    return seed;
  }

  function scheduleHomeHeroRotation() {
    clearTimeout(homeHeroRotationTimer);
    if (ADS_DEMO || SWARM_DEMO || REDUCED_MOTION.matches || DAILY_PAGE_ID || views.home.hidden || homeHeroPaused) return;
    homeHeroRotationTimer = setTimeout(() => {
      const index = HOMEPAGE_CATEGORIES.indexOf(homeHeroCategory);
      showHomeHeroCategory(HOMEPAGE_CATEGORIES[(index + 1) % HOMEPAGE_CATEGORIES.length]);
    }, 4600);
  }

  function typeHomeHeroQuestion(target, question) {
    clearTimeout(homeHeroTypingTimer);
    const characters = Array.from(question);
    const pace = Math.max(25, Math.min(52, 1450 / Math.max(1, characters.length)));
    let index = 0;
    target.textContent = "";
    target.classList.add("is-typing");
    const typeNext = () => {
      if (!target.isConnected) return;
      if (index >= characters.length) {
        target.textContent = question;
        target.classList.remove("is-typing");
        scheduleHomeHeroRotation();
        return;
      }
      const character = characters[index];
      target.textContent += character;
      index += 1;
      homeHeroTypingTimer = setTimeout(typeNext, pace * (/[?!.:;,]/.test(character) ? 2.2 : 1));
    };
    homeHeroTypingTimer = setTimeout(typeNext, 220);
  }

  function showHomeHeroCategory(category, { animate = true } = {}) {
    if (!HOMEPAGE_CATEGORIES.includes(category)) return;
    const seed = homeHeroSeed(category);
    const target = $("[data-home-hero-question]");
    if (!seed || !target) return;
    stopHomeHeroMotion();
    homeHeroCategory = category;
    document.querySelectorAll("[data-home-category]").forEach((button) => {
      const activeCategory = button.dataset.homeCategory === category;
      button.classList.toggle("is-active", activeCategory);
      button.setAttribute("aria-pressed", String(activeCategory));
    });
    if (animate && !REDUCED_MOTION.matches) typeHomeHeroQuestion(target, seed.query);
    else {
      target.textContent = seed.query;
      target.classList.remove("is-typing");
      scheduleHomeHeroRotation();
    }
  }

  function homeHeroMarkup() {
    const initialSeed = homeHeroSeed(homeHeroCategory) || localCategoryPool(homeHeroCategory)[0];
    const demoAdapter = ADS_DEMO ? ADS_ADAPTER : SWARM_DEMO ? SWARM_ADAPTER : null;
    const question = demoAdapter ? demoAdapter.greeting : initialSeed?.query || "What deserves your attention next?";
    const ownForm = demoAdapter ? "" : `<form class="start-question-form daily-own-form" id="startQuestionForm" aria-label="Ask WHY" hidden>
          <svg class="ic search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="M20.4 20.4 15.6 15.6"/></svg>
          <input class="start-question-input" id="startQuestionInput" aria-label="Ask your own question" placeholder="Ask anything…" maxlength="4000" autocomplete="off">
          <button class="start-question-submit" type="submit" aria-label="Ask WHY"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.4V4.6M5.6 11 12 4.6 18.4 11"/></svg></button>
        </form>`;
    const ownAction = ADS_DEMO
      ? `<span class="daily-own-toggle ads-demo-note">Investor demo · sample campaign</span>`
      : SWARM_DEMO
        ? `<a class="daily-own-toggle swarm-whitepaper" href="whitepaper.pdf" target="_blank" rel="noopener">WHY Whitepaper</a>`
      : `<div class="home-action-row"><button class="daily-own-toggle" type="button" data-action="open-daily-search">Ask WHY.</button>
      <button class="daily-own-toggle" type="button" data-action="close-daily-search" hidden>Ask WHY.</button>
      <a class="daily-own-toggle home-pro-link" href="/pro">WHY. Pro</a></div>`;
    const choiceMarkup = ADS_DEMO
      ? ADS_ADAPTER.homeChoices.slice(0, 3).map((choice) => {
          const label = cleanText(choice?.label, 24).toLowerCase();
          const query = cleanText(choice?.query, 160);
          const domain = safeDomain(choice?.domain || "public");
          return `<button class="home-category" type="button" data-ads-seed="true" data-query="${escapeHtml(query)}" data-domain="${escapeHtml(domain)}" aria-label="${escapeHtml(`${label} — ${query}`)}">${escapeHtml(label)}</button>`;
        }).join("")
      : HOMEPAGE_CATEGORIES.map((category) => {
          const seed = homeHeroSeed(category);
          return `<button class="home-category${category === homeHeroCategory ? " is-active" : ""}" type="button" data-home-category="${category}" aria-pressed="${category === homeHeroCategory}" aria-label="${escapeHtml(`${category} — ${seed?.query || "open a rabbit hole"}`)}">${category === "sports" ? "sport" : category}</button>`;
        }).join("");
    return `<section class="home-hero">
      <h1><span class="home-hero-question" data-home-hero-question aria-live="polite">${escapeHtml(question)}</span></h1>
      <div class="home-choice-slot">
        <div class="home-category-row" aria-label="Choose a curiosity category">${choiceMarkup}</div>
        ${ownForm}
      </div>
      ${ownAction}
    </section>`;
  }

  function renderSeeds() {
    clearTimeout(dailyRevealTimer);
    dailyRevealTimer = null;
    stopHomeHeroMotion();
    if (!DAILY_PAGE_ID) {
      homeHeroPaused = false;
      $("#seedBoard").innerHTML = homeHeroMarkup();
      if (!rabbitLauncherTracked) {
        rabbitLauncherTracked = true;
        track("rabbit_hole_categories_shown", { source: "rabbit", area: "homepage", doorCount: HOMEPAGE_CATEGORIES.length });
      }
      if (ADS_DEMO) {
        const target = $("[data-home-hero-question]");
        if (target && !REDUCED_MOTION.matches) typeHomeHeroQuestion(target, ADS_ADAPTER.greeting);
        else if (target) target.textContent = ADS_ADAPTER.greeting;
        return;
      }
      for (const category of HOMEPAGE_CATEGORIES) loadCategorySeeds(category);
      if (SWARM_DEMO) {
        const target = $("[data-home-hero-question]");
        if (target && !REDUCED_MOTION.matches) typeHomeHeroQuestion(target, SWARM_ADAPTER.greeting);
        else if (target) target.textContent = SWARM_ADAPTER.greeting;
        return;
      }
      showHomeHeroCategory(homeHeroCategory);
      return;
    }
    const dailyLoading = dailyLoadState === "loading";
    const root = !dailyLoading && dailyEpisode ? dailyNode(dailyEpisode.rootNodeId) : null;
    const rootDoors = root ? dailyVoiceNote(root).pulls : [];
    const dailyCard = dailyLoading ? `<section class="daily-home-card" aria-busy="true">
      <span class="daily-kicker">Today’s WHY</span>
      <span class="daily-home-loading">finding today’s question…</span>
    </section>` : dailyEpisode && rootDoors.length === 3 ? `<section class="daily-home-card" aria-label="Today’s WHY: ${escapeHtml(dailyEpisode.question)}">
      <span class="daily-kicker">Today’s WHY</span>
      <h1><span class="daily-question-text" data-daily-question>${escapeHtml(dailyEpisode.question)}</span></h1>
      <div class="daily-root-board" data-daily-root-board aria-label="Choose one of three paths">${rootDoors.map((door, index) => `<button class="daily-root-door" type="button" data-daily-door-id="${escapeHtml(door.id)}" data-position="${index + 1}" aria-label="${escapeHtml(`${door.label} — ${door.query}`)}"><span>${escapeHtml(door.label)}</span></button>`).join("")}</div>
      <small class="daily-explorers">${escapeHtml(dailyExplorerCopy())}</small>
    </section>` : `<section class="daily-home-card is-ready" aria-label="Today’s WHY is unavailable">
      <span class="daily-kicker">Today’s WHY</span>
      <h1>today’s question missed its cue.</h1>
      <small class="daily-explorers">Ask your own while we find it.</small>
    </section>`;
    $("#seedBoard").innerHTML = `${dailyCard}
    ${rabbitHoleMarkup()}
    <button class="daily-own-toggle" type="button" data-action="open-daily-search">Ask WHY.</button>
    <form class="start-question-form daily-own-form" id="startQuestionForm" aria-label="Ask WHY"${dailyEpisode || dailyLoading ? " hidden" : ""}>
      <svg class="ic search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4"/><path d="M20.4 20.4 15.6 15.6"/></svg>
      <input class="start-question-input" id="startQuestionInput" aria-label="Ask your own question" placeholder="Ask anything…" maxlength="4000" autocomplete="off">
      <button class="start-question-submit" type="submit" aria-label="Ask WHY"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.4V4.6M5.6 11 12 4.6 18.4 11"/></svg></button>
    </form>`;
    prefetchCategorySeeds();
    revealDailyQuestion();
  }

  function normalizeVoiceNote(note, query, priorDomain = "") {
    const source = note && typeof note === "object" ? note : {};
    const domain = safeDomain(source.domain || priorDomain || guessDomain(query));
    const pulls = [];
    const seen = new Set([cleanText(query).toLowerCase()]);
    const seenLabels = new Set();
    const explicitCopyStyle = ["concept_v1", "question_v1", "question_v2"].includes(source.copyStyle) ? source.copyStyle : "";
    const simpleDoors = Array.isArray(source.doors) ? source.doors.slice(0, 3) : null;
    const simpleQuestions = Array.isArray(source.questions) ? source.questions.slice(0, 3) : null;
    const candidates = simpleDoors || (simpleQuestions
      ? simpleQuestions.map((question) => ({ query: question, label: question }))
      : Array.isArray(source.pulls) ? source.pulls.slice(0, 3) : []);
    const inferredConcept = simpleDoors || (candidates.length === 3 && candidates.every((candidate) =>
      isConceptDoorLabel(candidate?.label) && cleanText(candidate?.label, 24).toLowerCase() !== cleanText(candidate?.query, 160).toLowerCase()));
    const copyStyle = explicitCopyStyle || (inferredConcept ? "concept_v1" : "question_v2");
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      let doorQuery = cleanText(candidate?.query || candidate?.label, 160).toLowerCase().replace(/[.!]+$/g, "");
      if (!doorQuery.endsWith("?")) doorQuery = `${doorQuery}?`;
      const words = doorQuery.split(/\s+/).filter(Boolean);
      const minimumWords = copyStyle === "concept_v1" ? 4 : 3;
      if (words.length < minimumWords || words.length > 16 || !QUESTION_DOOR_STARTER.test(doorQuery) || seen.has(doorQuery)) continue;
      if (LEGACY_GENERIC_DOOR_LABELS.has(doorQuery)) continue;
      const candidateLabel = cleanText(candidate?.label, copyStyle === "concept_v1" ? 24 : 72).toLowerCase();
      const label = copyStyle === "concept_v1"
        ? candidateLabel
        : (isQuestionDoorLabel(candidateLabel) ? candidateLabel : doorQuery);
      const labelKey = label.toLowerCase();
      if (copyStyle === "concept_v1" && (!isConceptDoorLabel(label) || seenLabels.has(labelKey))) continue;
      seen.add(doorQuery);
      seenLabels.add(labelKey);
      const fallbackRole = ["deepen", "contradiction", "consequence"][index];
      const requestedRole = canonicalRole(candidate?.role);
      const role = VALID_ROLES.has(requestedRole) ? requestedRole : fallbackRole;
      const suppliedLens = String(candidate?.lens || "").toLowerCase();
      const lens = VALID_LENSES.has(suppliedLens) && LENS_SETS[domain].includes(suppliedLens)
        ? suppliedLens
        : LENS_SETS[domain][index];
      pulls.push({
        id: `door_${hashString(`${query}:${doorQuery}`)}`,
        role,
        promise: VALID_PROMISES.has(candidate?.promise)
          ? candidate.promise
          : PROMISE_FOR_ROLE[role],
        lens,
        heat: clampHeat(candidate?.stake ?? candidate?.heat) || [7, 8, 7][index],
        label,
        query: doorQuery,
        grounding: ["off", "optional", "required"].includes(candidate?.grounding) ? candidate.grounding : "optional",
        memoryConnected: index === 2 && candidate?.memoryConnected === true,
      });
    }
    const signatureSource = source.signature && typeof source.signature === "object" ? source.signature : null;
    const signature = signatureSource && domain !== "personal"
      ? {
          mechanism: cleanText(signatureSource.mechanism, 48).toLowerCase(),
          consequence: cleanText(signatureSource.consequence, 48).toLowerCase(),
          entity: cleanText(signatureSource.entity, 48).toLowerCase(),
        }
      : null;
    return {
      domain,
      prompt: cleanText(source.prompt || "three ways forward", 100),
      copyStyle,
      pulls: pulls.length === 3 ? pulls : [],
      ...(signature?.mechanism ? { signature } : {}),
    };
  }

  function guessDomain(query) {
    const text = String(query || "").toLowerCase();
    if (/\b(solve|calculate|equation|integral|derivative|divide|compute|error|bug|syntax|=)\b/.test(text)) return "problem";
    if (/\b(should i|should we|worth it|better to|which should|buy or rent)\b/.test(text)) return "decision";
    if (/\b(architecture|database|api|latency|server|deploy|software|protocol|algorithm|ai)\b/.test(text)) return "technology";
    if (/\b(procrastinat|anxious|motivat|habit|lonely|jealous|relationship|why do i|love)\b/.test(text)) return "personal";
    if (/\b(atom|molecul|gravity|evolution|cell|virus|weather|chemical|physics|biology|freeze|float|dream)\b/.test(text)) return "science";
    return DEFAULT_DOMAIN;
  }

  function sourceMarkup(list, options = {}) {
    const sources = validSources(list);
    if (sources.length) return `<details class="thread-sources"><summary>Receipts · ${sources.length}</summary><div class="source-list">${sources.map((source, index) => `<a class="source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(source.title)}</a>`).join("")}</div></details>`;
    if (!options.available) return "";
    const label = options.groundingStatus === "web_requested_no_receipts" ? "verify this answer" : "check receipts";
    return `<button class="receipts-request" type="button" data-receipts="${escapeHtml(options.query || "")}" data-answer-id="${escapeHtml(options.answerId || "")}" data-thread-id="${escapeHtml(options.threadId || "")}">${label}</button>`;
  }

  const PATH_FILLER_WORDS = new Set([
    "a", "an", "the", "its", "really", "actually", "just", "still", "ever", "leaders",
  ]);

  function pathLabel(question, suggestedLabel = "") {
    const source = cleanText(suggestedLabel || question, 100);
    const didQuestion = /^(?:why|how|when|where|what|which|who)\s+did\s+/i.test(source);
    let text = source
      .replace(/[?!.]+$/g, "")
      .replace(/^(?:why|how|when|where|what|which|who)\s+(?:(?:did|does|do|is|are|was|were|can|could|would|will|has|have|had)\s+)?/i, "")
      .replace(/\b(?:go|went)\s+into\b/gi, "in")
      .replace(/\s+/g, " ")
      .trim();
    const possession = didQuestion ? text.match(/^(.+?)\s+\S+\s+its\s+(.+)$/i) : null;
    if (possession) {
      const actor = possession[1].replace(/^the\s+/i, "").trim();
      text = `${actor}${/s$/i.test(actor) ? "'" : "'s"} ${possession[2]}`;
    }
    let words = text.split(" ").filter(Boolean);
    const focused = words.filter((word) => !PATH_FILLER_WORDS.has(word.toLowerCase()));
    if (focused.length >= 2) words = focused;
    const label = words.slice(0, 3).join(" ");
    return cleanText(label || recentLabel(question) || question, 46);
  }

  function pathMarkup(nodes, threadId) {
    const desktopStart = Math.max(0, nodes.length - 5);
    const mobileStart = Math.max(0, nodes.length - 3);
    const steps = nodes.map((node, index) => {
      const isCurrent = index === nodes.length - 1;
      const classes = ["path-step"];
      if (index < desktopStart) classes.push("is-desktop-hidden");
      if (index < mobileStart) classes.push("is-mobile-hidden");
      if (isCurrent) classes.push("is-current");
      const arrow = index ? '<i class="path-arrow" aria-hidden="true">→</i>' : "";
      const label = pathLabel(node.question, node.user.via?.label);
      const crumb = isCurrent
        ? `<strong class="path-crumb path-current" aria-current="page">${escapeHtml(label)}</strong>`
        : `<a class="path-crumb" href="#path-${escapeHtml(node.id)}" data-path-thread="${escapeHtml(threadId)}" data-path-node="${escapeHtml(node.id)}" aria-label="Return to ${escapeHtml(node.question)}">${escapeHtml(label)}</a>`;
      return `<span class="${classes.join(" ")}">${arrow}${crumb}</span>`;
    }).join("");
    const desktopMore = desktopStart ? `<span class="path-more path-more-desktop">+${desktopStart}</span>` : "";
    const mobileMore = mobileStart ? `<span class="path-more path-more-mobile">+${mobileStart}</span>` : "";
    return `<span class="path-kicker">your path · ${nodes.length} deep</span><span class="path-crumbs">${desktopMore}${mobileMore}${steps}</span>`;
  }

  const NAME_MIN_PULLS = 6;
  const NAME_MIN_PATH_ANSWERS = 5;
  const NAME_REUSE_PULL_GAP = 10;

  function needsName(thread = active) {
    const answers = completedNodes(thread).length;
    return !nameProfile.name && !nameProfile.declined && ledger.pulls >= NAME_MIN_PULLS && answers >= NAME_MIN_PATH_ANSWERS;
  }

  function canUseName(thread = active) {
    if (!nameProfile.name || session.nameCadenceClaimed) return false;
    if (nameProfile.nameUses === 0) return completedNodes(thread).length >= 1;
    return completedNodes(thread).length >= 2 &&
      ledger.pulls - nameProfile.lastNameUsePull >= NAME_REUSE_PULL_GAP;
  }

  function nameRitualMarkup() {
    if (!needsName()) return "";
    return `<section class="name-ritual" id="nameRitual"><span>we've covered some ground. <strong>what should i call you?</strong><small class="name-note">just on this device.</small></span><form class="name-form" id="nameForm"><input class="name-input" maxlength="40" autocomplete="given-name" placeholder="First name" aria-label="Your name"><button class="name-save" type="submit">Use it</button><button class="name-skip" type="button" data-action="skip-name">Stay unknown</button></form></section>`;
  }

  // The score chip is retired. The ledger still accrues for ranking and analytics,
  // it is simply no longer painted next to the wordmark.
  function scoreMarkup() {
    return "";
  }

  function doorBrandMarkup(note = "", showScore = true) {
    return `<div class="door-brand"><div class="door-brand-lockup"><strong>WHY<em>.</em></strong>${showScore ? scoreMarkup() : ""}</div>${note ? `<span>${escapeHtml(note)}</span>` : ""}</div>`;
  }

  function renderScore() {
    const box = $("#pathScore");
    const total = $("#scoreTotal");
    if (!box || !total) return;
    box.hidden = ledger.pulls === 0;
    total.textContent = Math.round(ledger.total);
  }

  function scoreSelection({ selectionId, heat, depth }, options = {}) {
    if (ledger.awardedSelectionIds.includes(selectionId)) return { duplicate: true, exploration: 0, insight: 0, gained: 0, heat };
    const before = { ...ledger, awardedSelectionIds: [...ledger.awardedSelectionIds] };
    const reward = previewSelectionScore(heat, depth);
    const { exploration, insight, gained, heat: cleanHeat } = reward;
    ledger.awardedSelectionIds = [...ledger.awardedSelectionIds, selectionId].slice(-5000);
    ledger.explorationPoints += exploration;
    ledger.insightPoints += insight;
    ledger.total += gained;
    ledger.pulls += 1;
    ledger.currentDepthStreak += 1;
    ledger.longestDepthStreak = Math.max(ledger.longestDepthStreak, ledger.currentDepthStreak);
    ledger.best = Math.max(ledger.best, cleanHeat);
    ledger.lastHeat = cleanHeat;
    ledger.coldRun = cleanHeat <= 2 ? ledger.coldRun + 1 : 0;
    if (cleanHeat >= 8) ledger.highInsightPulls += 1;
    const persisted = options.persist === false ? false : persistLedger();
    if (options.persist !== false && !persisted) ledger = before;
    return { duplicate: false, ...reward, persisted };
  }

  function previewSelectionScore(heat, depth) {
    const cleanHeat = clampHeat(heat) || 1;
    const exploration = depth >= 10 ? 5 : depth >= 5 ? 4 : 3;
    const insight = 0;
    const gained = exploration;
    return { duplicate: false, exploration, insight, gained, heat: cleanHeat, jackpot: depth > 0 && depth % 5 === 0 };
  }

  function reconcileSelectionAwards() {
    const before = { ...ledger, awardedSelectionIds: [...ledger.awardedSelectionIds] };
    const known = new Set(ledger.awardedSelectionIds);
    const changedMessages = [];
    let ledgerChanged = false;
    for (const thread of state.threads) {
      let parentSafety = false;
      let completedDepth = 0;
      const messages = thread.messages || [];
      for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
        const message = messages[messageIndex];
        if (message.role === "assistant") { parentSafety = message.safetyMode === "crisis"; completedDepth += 1; continue; }
        if (message.role !== "user") continue;
        const selectionId = cleanText(message.selectionId, 140);
        const trailingPreJournalDoor = messageIndex === messages.length - 1 && message.source === "door" && selectionId && !message.awardState;
        const legacyBaselineAward = selectionId && !message.awardState && (message.migratedAward === true || trailingPreJournalDoor);
        if (legacyBaselineAward) {
          // Aggregate ledgers cannot reveal whether a missing legacy ID was
          // once written and later evicted. Preserve the last durable total as
          // the migration baseline, seed the ID, and guarantee exactly-once
          // scoring from this journal cutover forward.
          message.migratedAward = true;
          message.awardState = "baseline";
          changedMessages.push(message);
        }
        if (message.migratedAward === true && selectionId && !known.has(selectionId)) {
          known.add(selectionId);
          ledgerChanged = true;
        }
        if (message.awardState !== "pending" || !selectionId) continue;
        changedMessages.push(message);
        if (parentSafety) { message.awardState = "none"; continue; }
        if (!known.has(selectionId)) {
          const reward = previewSelectionScore(message.via?.heat, completedDepth + 1);
          known.add(selectionId);
          ledger.explorationPoints += reward.exploration;
          ledger.insightPoints += reward.insight;
          ledger.total += reward.gained;
          ledger.pulls += 1;
          ledger.best = Math.max(ledger.best, reward.heat);
          ledger.lastHeat = reward.heat;
          ledger.coldRun = reward.heat <= 2 ? ledger.coldRun + 1 : 0;
          if (reward.heat >= 8) ledger.highInsightPulls += 1;
          ledgerChanged = true;
        }
        message.awardState = "committed";
      }
    }
    if (ledgerChanged) {
      ledger.awardedSelectionIds = [...known].slice(-5000);
      if (!persistLedger()) {
        ledger = before;
        for (const message of changedMessages) if (message.awardState === "committed") message.awardState = "pending";
        return;
      }
    }
    if (changedMessages.length) persistThreads();
  }

  function countUp(element, to, duration = 520) {
    if (REDUCED_MOTION.matches) { element.textContent = Math.round(to); return; }
    const from = Number(element.textContent) || 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      element.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Retired with the score chip. Kept as a no-op so the door-commit path and its
  // callers keep their shape; the daily path proof still animates.
  function showPointReward() {}

  function showDailyPathProof(rect, proof) {
    if (!rect || !proof?.available || proof.count < 1) return false;
    const reward = document.createElement("span");
    reward.className = "daily-path-proof";
    reward.setAttribute("role", "status");
    reward.setAttribute("aria-live", "polite");
    reward.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
    reward.style.top = `${Math.max(86, Math.min(innerHeight - 24, Math.round(rect.top - 8)))}px`;
    reward.innerHTML = `<i>${proof.count.toLocaleString()}</i><b>${proof.count === 1 ? "person chose this path" : "people chose this path"}</b>`;
    document.body.appendChild(reward);
    setTimeout(() => reward.remove(), 1650);
    return true;
  }

  function revealReward(button, result, { showPoints = true } = {}) {
    const board = button.closest(".door-board");
    const rect = button.getBoundingClientRect();
    board?.querySelectorAll("button").forEach((door) => {
      door.disabled = true;
      door.classList.toggle("is-selected", door === button);
      if (door !== button) door.classList.add("is-folding");
    });
    button.classList.add("is-popping");
    if (showPoints) showPointReward(rect, result);
    const score = $("#pathScore");
    const total = $("#scoreTotal");
    if (score && total) {
      score.hidden = false;
      countUp(total, ledger.total);
      const brand = score.closest(".door-brand");
      brand?.classList.add("scoring");
      setTimeout(() => brand?.classList.remove("scoring"), 720);
    }
    return rect;
  }

  let webkitHapticSwitch = null;

  function triggerWebKitSwitchHaptic() {
    const iosLike = /iP(?:hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!iosLike) return false;
    try {
      if (!webkitHapticSwitch?.isConnected) {
        webkitHapticSwitch = document.createElement("input");
        webkitHapticSwitch.type = "checkbox";
        webkitHapticSwitch.setAttribute("switch", "");
        webkitHapticSwitch.setAttribute("aria-hidden", "true");
        webkitHapticSwitch.tabIndex = -1;
        webkitHapticSwitch.className = "haptic-switch";
        document.body.appendChild(webkitHapticSwitch);
      }
      // Safari 18+ gives its native switch control a system haptic. Because this
      // click remains inside the user's door-tap call stack, it retains activation.
      webkitHapticSwitch.click();
      return true;
    } catch {
      return false;
    }
  }

  function triggerDoorHaptic(result) {
    // Android hardware commonly drops ultra-short pulses. These beats stay compact
    // but clear the practical perception floor on far more devices. Do not gate on
    // maxTouchPoints: some Android WebViews report zero even when vibration works.
    const pattern = result.jackpot ? [36, 45, 48, 55, 70] : [32, 55, 48];
    if (typeof navigator.vibrate === "function") {
      try {
        if (navigator.vibrate(pattern) === true) return true;
      } catch { /* fall through to WebKit's native switch haptic */ }
    }
    return triggerWebKitSwitchHaptic();
  }

  // The curiosity profile stays invisible until there is enough behavior to justify
  // a cautious pattern read. The reset is a correction signal with no points attached.
  const DOMAIN_WORDS = {
    public: "money, power and who actually decides",
    science: "how things actually work",
    problem: "getting to a correct answer",
    personal: "why people do what they do",
    decision: "how to choose well",
    technology: "how systems are built and where they break",
  };
  const ROLE_WORDS = {
    deepen: "the mechanism underneath",
    contradiction: "the claim that does not quite hold",
    consequence: "what happens after the headline",
    origin: "where the story actually began",
    surprise: "the detail that changes the picture",
    pattern: "connections between different subjects",
    reveal: "the detail most people skip",
    jump: "connections between different subjects",
  };

  const SELF_MODEL_MIN_PULLS = 8;
  const SELF_MODEL_MIN_PATHS = 2;

  function selfModelMarkup() {
    const completedPathDepths = state.threads
      .map((thread) => completedNodes(thread).length)
      .filter((depth) => depth >= 2);
    if (curiosity.totalPulls < SELF_MODEL_MIN_PULLS || completedPathDepths.length < SELF_MODEL_MIN_PATHS) return "";
    const ranked = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key]) => key);
    const domain = ranked(curiosity.domainCounts)[0] || "";
    const role = ranked(curiosity.roleCounts)[0] || "";
    const averageCompletedDepth = completedPathDepths.reduce((total, depth) => total + depth, 0) / completedPathDepths.length;
    const lines = [
      `Across your completed paths, you average <strong>${averageCompletedDepth.toFixed(1)} questions deep</strong>.`,
      domain && role ? `So far, your choices lean toward <strong>${escapeHtml(DOMAIN_WORDS[domain] || domain)}</strong>, especially <strong>${escapeHtml(ROLE_WORDS[role] || role)}</strong>.` : "",
    ].filter(Boolean);
    return `<section class="self-model">
      <h3>What WHY has learned about you</h3>
      ${lines.map((line) => `<p>${line}</p>`).join("")}
      <p class="self-model-note">A rough pattern, not a personality test. Saved paths stay on this device. To answer a follow-up, WHY sends recent messages from the active path to its answer service; after meaningful use, one compact non-sensitive path cue may shape the third question.</p>
      <button type="button" class="self-model-reset" data-action="reset-model">reset this read</button>
    </section>`;
  }

  function resetSelfModel() {
    curiosity = defaultCuriosity();
    persistCuriosity();
    renderHistory();
    renderSeeds();
    toast("Pattern reset. Nothing personal was sent anywhere.");
  }

  function renderHistory() {
    if (!$("#historyModal")?.classList.contains("open")) return;
    const list = $("#historyList");
    $("#historyStats").innerHTML = [
      [ledger.pulls, "pulls"],
      [ledger.deepestPath, "deepest"],
      [ledger.highInsightPulls, "high insight"],
    ].map(([value, label]) => `<span class="history-stat"><strong>${Math.round(value)}</strong>${label}</span>`).join("");
    const selfModel = $("#selfModel");
    if (selfModel) selfModel.innerHTML = selfModelMarkup();
    const playableThreads = state.threads.filter((thread) => completedNodes(thread).length > 0 || Boolean(trailingUser(thread)));
    if (!playableThreads.length) {
      list.innerHTML = '<p class="history-empty">Your curiosity paths stay on this device.</p>';
      return;
    }
    list.innerHTML = playableThreads.map((thread) => {
      const nodes = completedNodes(thread);
      const path = nodes.slice(-4).map((node, index) => index ? cleanText(node.user.via?.label || recentLabel(node.question), 40) : recentLabel(node.question)).join(" → ");
      const status = nodes.length ? `${nodes.length} deep` : "answer interrupted";
      return `<button class="history-item" type="button" data-history="${escapeHtml(thread.id)}"><span class="history-title">${escapeHtml(thread.title || "Untitled path")}</span>${path ? `<span class="history-path">${escapeHtml(path)}</span>` : ""}<span class="history-depth">${status}</span></button>`;
    }).join("");
  }

  function saveThread(thread) {
    thread.updatedAt = Date.now();
    state.threads = [thread, ...state.threads.filter((candidate) => candidate.id !== thread.id)];
    const persisted = persistThreads();
    if (persisted) {
      volatileThreadIds.delete(thread.id);
      refreshCuriosityGraph();
    }
    else volatileThreadIds.add(thread.id);
    renderHistory();
    return persisted;
  }

  function warnVolatileThread(threadId, area = "thread") {
    warnStorageHealth(area, "This path is staying in this tab; device storage is full.");
  }

  function warnStorageHealth(area, message = "Some local memory could not be saved.") {
    if (warnedStorageAreas.has(area)) return;
    warnedStorageAreas.add(area);
    track("storage_warning", { area });
    toast(message);
  }

  function unavailableDoorBoardMarkup() {
    return `<div class="node-progress">the next three did not land<button class="node-retry" type="button" data-action="retry-doors">try them again</button></div>`;
  }

  function renderActiveNode(thread, options = {}) {
    active = thread;
    const nodes = completedNodes(thread);
    const node = nodes[nodes.length - 1];
    if (!node) {
      if (pendingRequest?.initial) show("loading");
      return;
    }
    const previousDomain = nodes[nodes.length - 2]?.answer?.domain || node.answer.domain;
    const voice = normalizeVoiceNote(node.answer.voiceNote, node.question, previousDomain);
    const safetyMode = node.answer.safetyMode === "crisis";
    const doorsReady = voice.pulls.length === 3;
    const pending = pendingRequest?.threadId === thread.id ? pendingRequest : null;
    const selectedDoorId = pending?.via?.doorId || "";
    // A one-step trail would only restate the first question. Reveal the path and
    // its history shortcut once a real connection exists.
    $("#pathStatus").hidden = safetyMode || node.depth < 2;
    $("#pathTrail").innerHTML = pathMarkup(nodes, thread.id);
    $("#followForm")?.setAttribute("aria-busy", String(Boolean(pending)));
    if ($("#followInput")) $("#followInput").disabled = Boolean(pending);
    if ($("#followSend")) $("#followSend").disabled = Boolean(pending);
    const trust = sourceMarkup(node.answer.sources, {
      available: node.answer.receiptsAvailable,
      query: node.question,
      answerId: node.answer.id,
      threadId: thread.id,
      groundingStatus: node.answer.groundingStatus,
    });
    const waitingMarkup = pending
      ? `<div class="node-progress">${pending.status === "error" ? escapeHtml(pending.error || "that path stalled") : "opening that door"}${pending.status === "error" ? '<button class="node-retry" type="button" data-action="retry">try again</button>' : ""}</div>`
      : "";
    const boardMarkup = doorsReady
      ? `<div class="door-board${voice.copyStyle === "concept_v1" ? " is-concept" : ""}${pending ? "" : " is-introducing"}">${voice.pulls.map((door, index) => `<button class="curiosity-door${door.memoryConnected ? " is-memory" : ""}${selectedDoorId === door.id ? " is-selected" : ""}" type="button" data-door-id="${escapeHtml(door.id)}" data-query="${escapeHtml(door.query)}" data-label="${escapeHtml(door.label)}" data-copy-style="${escapeHtml(voice.copyStyle)}" data-role="${escapeHtml(door.role)}" data-promise="${escapeHtml(door.promise || PROMISE_FOR_ROLE[door.role] || "microscope")}" data-lens="${escapeHtml(door.lens)}" data-domain="${escapeHtml(voice.domain)}" data-heat="${door.heat}" data-position="${index + 1}" data-grounding="${escapeHtml(door.grounding)}" data-memory-connected="${door.memoryConnected ? "true" : "false"}" aria-label="${escapeHtml(voice.copyStyle === "concept_v1" ? `${door.label} — ${door.query}` : door.label)}${door.memoryConnected ? ", connected to an earlier path" : ""}"${pending ? " disabled" : ""}>${door.memoryConnected ? '<small class="door-memory">earlier path</small>' : ""}<span>${escapeHtml(door.label)}</span><small class="door-opening" aria-hidden="true">opening</small></button>`).join("")}</div>`
      : unavailableDoorBoardMarkup();
    $("#conversation").innerHTML = `<article class="curiosity-node${pending && pending.status !== "error" ? " is-waiting" : ""}${safetyMode ? " is-safety" : ""}" data-node-id="${escapeHtml(node.id)}" aria-label="WHY answer" aria-busy="${pending && pending.status !== "error" ? "true" : "false"}">
      <section class="node-answer" tabindex="-1"><article class="prose">${markdown(node.answer.content)}</article><div class="node-trust">${trust}</div></section>
      <section class="door-zone" aria-label="${safetyMode ? "Choose support now" : "Choose the next question"}">
        ${doorBrandMarkup(safetyMode ? "choose what helps now" : "", !safetyMode)}
        ${boardMarkup}
        ${waitingMarkup}
      </section>
      ${safetyMode ? "" : nameRitualMarkup()}
    </article>`;
    const lead = $(".node-answer .prose p");
    if (lead) lead.classList.add("lead");
    if (ADS_DEMO && typeof ADS_ADAPTER.decorate === "function") {
      try { ADS_ADAPTER.decorate({ root: $("#conversation"), query: node.question, depth: node.depth }); }
      catch (error) { if (DEBUG) console.warn("WHY ads demo decoration failed", error); }
    }
    show("answer");
    interaction = {
      status: pending ? pending.status : "displayed",
      nodeId: node.id,
      answerVisibleAt: performance.now(),
    };
    if (!options.suppressTrack && lastVisibleNodeId !== node.id) {
      lastVisibleNodeId = node.id;
      const choiceLatency = options.selectedAt ? Math.max(0, Math.round(performance.now() - options.selectedAt)) : null;
      track("answer_visible", { threadId: thread.id, nodeId: node.id, depth: node.depth, choiceToContentMs: choiceLatency, source: node.user.source, doorCopyStyle: voice.copyStyle });
      track("path_depth", { threadId: thread.id, nodeId: node.id, depth: node.depth });
      let rankingImpressionsChanged = false;
      for (const [index, door] of voice.pulls.entries()) {
        const impressionKey = `${node.id}:${door.id}`;
        if (shownImpressions.has(impressionKey)) continue;
        shownImpressions.add(impressionKey);
        rankingImpressionsChanged = noteRankingImpression(door) || rankingImpressionsChanged;
        track("door_impression", {
          threadId: thread.id,
          nodeId: node.id,
          boardId: `board_${hashString(`${node.id}:${voice.pulls.map((pull) => pull.id).join(":")}`)}`,
          doorId: door.id,
          position: index + 1,
          role: door.role,
          domain: voice.domain,
          depth: node.depth,
          generationStatus: node.answer.doorGeneration?.status || "legacy",
          copyStyle: voice.copyStyle,
          memoryConnected: door.memoryConnected === true,
        });
      }
      if (rankingImpressionsChanged) persistCuriosity();
    }
    renderScore();
    if (options.focus !== false) requestAnimationFrame(() => {
      if ($("#historyModal")?.classList.contains("open")) return;
      const target = pending?.status === "error" ? $(".node-retry") : (doorsReady ? $(".node-answer") : $("[data-action='retry-doors']"));
      target?.focus({ preventScroll: true });
    });
  }

  function queryHistory(thread) {
    const messages = [...(thread?.messages || [])];
    if (messages[messages.length - 1]?.role === "user") messages.pop();
    return messages.slice(-12).map((message) => ({ role: message.role, content: String(message.content || "").slice(0, 1600) }));
  }

  function buildRequestContext(thread, query, via = null) {
    const nodes = completedNodes(thread);
    const current = nodes[nodes.length - 1];
    const domain = via?.domain || current?.answer?.domain || "";
    const allowName = canUseName(thread);
    const requestsNameMemory = /\b(?:do you know|remember|what(?:'s| is))\s+(?:my\s+)?name\b/i.test(query);
    const acknowledgeReturn = session.returnAcknowledgementAvailable;
    return {
      key: `${API_VERSION}:${thread.id}:${current?.id || "root"}:${via?.doorId || hashString(query)}`,
      query,
      payload: {
        query,
        runtime: { timeZone: BROWSER_TIME_ZONE },
        history: queryHistory(thread),
        path: {
          depth: nodes.length,
          priorQuestions: nodes.slice(-20).map((node) => node.question),
          ...(current?.answer?.safetyMode === "crisis" ? { safetyMode: "crisis" } : {}),
          ...(via ? {
            doorId: via.doorId,
            role: via.role,
            lens: via.lens,
            domain: via.domain,
            label: via.label,
            grounding: via.grounding,
          } : domain ? { domain } : {}),
        },
        profile: allowName || requestsNameMemory
          ? { name: nameProfile.name, allowName }
          : { allowName: false },
        player: {
          score: ledger.total,
          streak: ledger.currentDepthStreak,
          pulls: ledger.pulls,
          coldRun: ledger.coldRun,
          lastHeat: ledger.lastHeat,
          threads: state.threads.length,
          acknowledgeReturn,
        },
        curiosity: curiositySummary(thread.id),
        mode: "contrarian",
        depth: "quick",
      },
    };
  }

  function composeSignal(signal, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("WHY took too long.", "TimeoutError")), timeoutMs);
    const relay = () => controller.abort(signal?.reason || new DOMException("Cancelled", "AbortError"));
    if (signal) {
      if (signal.aborted) relay();
      else signal.addEventListener("abort", relay, { once: true });
    }
    return {
      signal: controller.signal,
      clear: () => {
        clearTimeout(timeout);
        signal?.removeEventListener?.("abort", relay);
      },
    };
  }

  function normalizeResponse(data, query, priorDomain) {
    const answer = String(data?.answer || "").trim();
    if (!answer) throw new Error("WHY returned an empty answer.");
    const voiceNote = normalizeVoiceNote(data?.voiceNote, query, data?.domain || priorDomain);
    const doorState = voiceNote.pulls.length === 3 ? "ready" : "unavailable";
    return {
      answer,
      voiceNote,
      doorState,
      doorGeneration: data?.doorGeneration || { status: doorState === "ready" ? "model" : "withheld", attempts: 0, candidateCount: 0 },
      domain: voiceNote.domain,
      sources: validSources(data?.sources),
      receiptsAvailable: Boolean(data?.receiptsAvailable),
      preview: Boolean(data?.preview),
      grounding: data?.grounding || "optional",
      groundingStatus: cleanText(data?.groundingStatus, 60),
      safetyMode: data?.safetyMode === "crisis" ? "crisis" : "",
      elapsedMs: $number(data?.elapsedMs),
    };
  }

  // PHASE B starts only once the accepted answer exists. Its latency still overlaps
  // reading, but the board can now respond to what WHY actually said.
  // A doors failure is retried here, not on the server. Each call is a separate
  // function invocation with its own platform time budget, so a second try actually
  // gets a full budget - a server-side retry had to share one, which is what pushed
  // the invocation past Netlify's ceiling and produced 504s.
  // Reads one string field out of a JSON object that is still arriving. Structured
  // output emits keys in schema order and `answer` is first, so the prose can be
  // painted long before the doors finish generating. Handles escapes, and tolerates a
  // chunk boundary landing mid-escape by simply waiting for the next chunk.
  const JSON_ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };

  function readStreamingString(raw, key) {
    const marker = `"${key}"`;
    const start = raw.indexOf(marker);
    if (start === -1) return null;
    let index = raw.indexOf(":", start + marker.length);
    if (index === -1) return null;
    index += 1;
    while (index < raw.length && /\s/.test(raw[index])) index += 1;
    if (index >= raw.length) return null;
    if (raw[index] !== '"') return null;
    index += 1;
    let out = "";
    while (index < raw.length) {
      const character = raw[index];
      if (character === "\\") {
        const escape = raw[index + 1];
        if (escape === undefined) return { text: out, complete: false };
        if (escape === "u") {
          if (raw.length < index + 6) return { text: out, complete: false };
          out += String.fromCharCode(Number.parseInt(raw.slice(index + 2, index + 6), 16) || 0);
          index += 6;
          continue;
        }
        out += JSON_ESCAPES[escape] ?? escape;
        index += 2;
        continue;
      }
      if (character === '"') return { text: out, complete: true };
      out += character;
      index += 1;
    }
    return { text: out, complete: false };
  }

  // Match the server's tolerant structured-output parser. Some providers wrap an
  // otherwise valid JSON-schema response in a code fence or a small text envelope;
  // the server could validate those boards while the client rejected the same bytes
  // and paid for a second door request.
  function parseTurnPayload(raw) {
    const original = String(raw || "").trim();
    if (!original) return { payload: null, mode: "empty", reason: "empty_turn_payload" };
    const attempts = [
      { mode: "exact", value: original },
      {
        mode: "code_fence",
        value: original.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
      },
    ];
    const start = original.indexOf("{");
    const end = original.lastIndexOf("}");
    if (start >= 0 && end > start) attempts.push({ mode: "object_envelope", value: original.slice(start, end + 1) });
    const seen = new Set();
    for (const attempt of attempts) {
      if (!attempt.value || seen.has(attempt.value)) continue;
      seen.add(attempt.value);
      try {
        const payload = JSON.parse(attempt.value);
        if (payload && typeof payload === "object") return { payload, mode: attempt.mode, reason: "" };
      } catch {}
    }
    return { payload: null, mode: "invalid", reason: "invalid_turn_json" };
  }

  function requireStructuredTurnPayload(raw, parsedTurn) {
    if (!String(raw || "").trim()) {
      const emptyStream = new Error("WHY returned an empty answer. Try that again.");
      emptyStream.code = "EMPTY_STREAM";
      throw emptyStream;
    }
    const payload = parsedTurn?.payload;
    if (!payload || typeof payload.answer !== "string") {
      const malformedStream = new Error("WHY returned a malformed answer. Try that again.");
      malformedStream.code = "MALFORMED_STREAM";
      throw malformedStream;
    }
    return payload;
  }

  // Some providers satisfy the structured schema while still stuffing a second,
  // JSON-shaped door board inside the answer string. Strip that boundary as soon as
  // it starts streaming so metadata can never flash as prose or be persisted.
  function cleanSpokenAnswer(value) {
    const text = String(value || "");
    const streamedArrayStart = /(?:\n\s*|```(?:json)?\s*)\[\s*(?:\{|$)/i.exec(text);
    const arrayLeak = /(?:```(?:json)?\s*)?\[\s*\{\s*"(?:label|query|heat|prompt|role|lens)"\s*:/i.exec(text);
    const envelopeLeak = /(?:```(?:json)?\s*)?\{\s*"(?:voiceNote|pulls|candidates|board|doors)"\s*:/i.exec(text);
    const boundaries = [streamedArrayStart?.index, arrayLeak?.index, envelopeLeak?.index].filter(Number.isInteger);
    if (!boundaries.length) return text;
    return text.slice(0, Math.min(...boundaries)).trimEnd();
  }

  function requestedLongAnswer(query) {
    return /\b(?:long|longer|detailed|in[- ]depth|deep[- ]dive|full)\s+(?:response|answer|reply|explanation|breakdown)\b/i.test(query) ||
      /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+paragraphs?\b/i.test(query);
  }

  function capSpokenAnswer(value, query = "") {
    const text = cleanSpokenAnswer(value).trim();
    if (!text || requestedLongAnswer(query)) return text;
    const matches = [...text.matchAll(/\S+/g)];
    if (matches.length <= NORMAL_ANSWER_WORD_LIMIT) return text;
    const boundary = matches[NORMAL_ANSWER_WORD_LIMIT - 1].index + matches[NORMAL_ANSWER_WORD_LIMIT - 1][0].length;
    const prefix = text.slice(0, boundary);
    const sentenceEnds = [...prefix.matchAll(/[.!?](?=\s|$)/g)];
    const complete = sentenceEnds.filter((match) => prefix.slice(0, match.index + 1).trim().split(/\s+/).length >= 8).at(-1);
    return complete
      ? prefix.slice(0, complete.index + 1).trim()
      : `${prefix.replace(/[,:;\-–—\s]+$/g, "").trim()}.`;
  }

  async function fetchDoors(context, signal, answerText, priorDomain) {
    if (ADS_DEMO) {
      await wait(60);
      if (signal?.aborted) throw signal.reason;
      const preview = ADS_ADAPTER.answer({
        query: context.query,
        domain: priorDomain || context.payload.path?.domain || guessDomain(context.query),
      });
      const normalized = normalizeResponse(preview, context.query, priorDomain || context.payload.path?.domain || "");
      return {
        doorState: normalized.doorState,
        voiceNote: normalized.voiceNote,
        domain: normalized.domain,
        doorGeneration: { status: "offline_ads_demo", attempts: 1, candidateCount: normalized.voiceNote.pulls.length },
      };
    }
    const response = await fetch("/api/ultimate-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...context.payload,
        action: "doors",
        answer: String(answerText || "").slice(0, 1200),
        domain: priorDomain || context.payload.path?.domain || "",
        embeddedFallbackReason: "manual_recovery",
      }),
      signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const failure = new Error(data?.error || "WHY lost the next questions.");
      failure.status = response.status;
      failure.code = response.status === 429 || response.status >= 500
        ? "DOORS_TRANSIENT"
        : "DOORS_HTTP_ERROR";
      throw failure;
    }
    if (data?.doorState !== "ready") {
      const unavailable = new Error(data?.error || "WHY lost the next questions.");
      unavailable.code = "DOORS_UNAVAILABLE";
      throw unavailable;
    }
    return data;
  }

  // One structured request. `answer` is the first schema field, so it streams while
  // the same response finishes the three conversational questions.
  async function fetchAnswer(context, signal, timeoutMs = 42000, onChunk = null) {
    if (SELF_HARM_CRISIS.test(context.query) || context.payload.path?.safetyMode === "crisis") {
      return demoCrisisAnswer(context.query);
    }
    if (ADS_DEMO) {
      await wait(120);
      if (signal?.aborted) throw signal.reason;
      const preview = ADS_ADAPTER.answer({
        query: context.query,
        domain: context.payload.path?.domain || guessDomain(context.query),
      });
      onChunk?.(preview.answer);
      return normalizeResponse(preview, context.query, context.payload.path?.domain || "");
    }
    if (SWARM_DEMO) {
      await wait(120);
      if (signal?.aborted) throw signal.reason;
      const preview = SWARM_ADAPTER.answer({
        query: context.query,
        domain: context.payload.path?.domain || guessDomain(context.query),
      });
      onChunk?.(preview.answer);
      return normalizeResponse(preview, context.query, context.payload.path?.domain || "");
    }
    if (REVIEW) {
      await wait(140);
      if (signal?.aborted) throw signal.reason;
      const preview = demoAnswer(context.query, context.payload.path?.domain);
      onChunk?.(preview.answer);
      return preview;
    }
    const composed = composeSignal(signal, timeoutMs);
    const priorDomain = context.payload.path?.domain || "";
    try {
      const answerResponse = await fetch("/api/ultimate-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...context.payload, action: "answer" }),
        signal: composed.signal,
      });
      if (!answerResponse.ok) {
        const failure = await answerResponse.json().catch(() => ({}));
        throw new Error(failure?.error || "The connection failed.");
      }
      // Crisis, identity and name-memory turns return complete JSON instead of a stream.
      const answerType = answerResponse.headers.get("content-type") || "";
      if (answerType.includes("application/json")) {
        const control = await answerResponse.json().catch(() => ({}));
        // The server short-circuits some turns with a complete JSON answer and never
        // opens a stream: the name-memory reply, the self-identity reply, and the
        // crisis path. Those must render normally, not surface as an error.
        if (control?.answer) {
          const controlAnswer = capSpokenAnswer(control.answer, context.query);
          if (!controlAnswer) throw new Error("WHY returned an empty answer.");
          onChunk?.(controlAnswer);
          return normalizeResponse({ ...control, answer: controlAnswer }, context.query, priorDomain);
        }
        throw new Error(control?.error || "The connection failed.");
      }
      const grounding = answerResponse.headers.get("x-why-grounding") || "optional";

      // The storyteller streams one structured turn. No second request is started.
      let raw = "";
      let answerText = "";
      if (answerResponse.body?.getReader) {
        const reader = answerResponse.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          raw += chunk;
          const streamed = readStreamingString(raw, "answer");
          const spoken = streamed ? cleanSpokenAnswer(streamed.text) : "";
          if (streamed && spoken !== answerText) {
            answerText = spoken;
            onChunk?.(answerText);
          }
        }
        raw += decoder.decode();
      } else {
        raw = await answerResponse.text();
      }
      const parsedTurn = parseTurnPayload(raw);
      const turnPayload = requireStructuredTurnPayload(raw, parsedTurn);
      answerText = turnPayload.answer;
      answerText = capSpokenAnswer(answerText, context.query);
      if (!answerText) throw new Error("WHY returned an empty answer.");
      // Belt and braces: a control payload must never be rendered as an answer.
      if (answerText.startsWith("{") && /"(?:error|responseDepth|pathDepth)"\s*:/.test(answerText)) {
        let control = {};
        try { control = JSON.parse(answerText); } catch { control = {}; }
        throw new Error(control?.error || "WHY returned an empty answer.");
      }
      onChunk?.(answerText);

      const resolvedDomain = answerResponse.headers.get("x-why-domain") || priorDomain || guessDomain(context.query);
      const voiceNote = normalizeVoiceNote({ doors: turnPayload.doors, copyStyle: "question_v2" }, context.query, resolvedDomain);
      const doorState = voiceNote.pulls.length === 3 ? "ready" : "unavailable";
      if (doorState === "ready") {
        track("door_board_ready", {
          threadId: context.key.split(":")[1] || "",
          status: "single_turn",
          attempts: 1,
          candidateCount: 3,
        });
      } else {
        track("door_generation_failed", {
          threadId: context.key.split(":")[1] || "",
          reason: Array.isArray(turnPayload.doors) ? "door_validation" : "missing_doors",
        });
      }

      return {
        answer: answerText,
        voiceNote,
        doorState,
        doorGeneration: { status: doorState === "ready" ? "single_turn" : "withheld", attempts: 1, candidateCount: voiceNote.pulls.length },
        domain: voiceNote.domain,
        sources: [],
        receiptsAvailable: grounding !== "off",
        preview: false,
        grounding,
        groundingStatus: grounding === "required" ? "web_requested_no_receipts" : grounding,
        safetyMode: "",
        elapsedMs: 0,
      };
    } finally {
      composed.clear();
    }
  }

  function demoCrisisAnswer(query) {
    const current = cleanText(query, 160).toLowerCase();
    const groups = [
      [
        { role: "deepen", lens: "habit", label: "how do i tell someone?", query: "how do i tell someone i need help right now?" },
        { role: "deepen", lens: "habit", label: "how do i ask them to stay?", query: "how do i ask someone to stay with me?" },
      ],
      [
        { role: "consequence", lens: "fear", label: "how can i get safer?", query: "how do i move away from anything dangerous?" },
        { role: "consequence", lens: "fear", label: "what words can i send?", query: "what exact words can i send right now?" },
      ],
      [
        { role: "origin", lens: "reward", label: "where is crisis support?", query: "where can i find immediate crisis support?" },
        { role: "origin", lens: "reward", label: "when should i call emergency help?", query: "when should i call emergency services?" },
      ],
    ];
    const pulls = groups.map((group, index) => {
      const door = group.find((candidate) => candidate.query.toLowerCase() !== current) || group[0];
      return { ...door, id: `crisis_${hashString(`${query}:${index}:${door.query}`)}`, heat: 1, grounding: "required" };
    });
    return {
      answer: "stay with me and get a real person beside you now. if you might act, call emergency services; in the u.s. or canada, call or text 988. elsewhere, use [find a helpline](https://findahelpline.com/). move away from anything you could use to hurt yourself.",
      voiceNote: { domain: "personal", prompt: "get a person beside you now", copyStyle: "question_v2", pulls },
      domain: "personal",
      sources: [],
      receiptsAvailable: false,
      preview: REVIEW,
      grounding: "off",
      groundingStatus: "crisis_support",
      safetyMode: "crisis",
      elapsedMs: 0,
    };
  }

  function demoAnswer(query, priorDomain) {
    const domain = safeDomain(priorDomain || guessDomain(query));
    const lower = query.toLowerCase();
    let answer = "this is the local rehearsal, not the live engine. the loop works; the sharp answer clocks in after deployment.";
    if (/rome/.test(lower)) answer = "rome could still raise armies. the rich dodged the bill while the empire kept ordering the group dinner. eventually, caesar's card declined.";
    else if (/ice/.test(lower)) answer = "water molecules spread out when they freeze, making ice less dense. even molecules need personal space.";
    else if (/nvidia/.test(lower)) answer = "nvidia paired fast ai chips with cuda, software developers already knew. rivals were selling silicon; nvidia had quietly furnished the whole workshop.";
    else if (/concert|ticket/.test(lower)) answer = "the ticket is the cover charge. venue deals, resale and fees let the same seat charge rent three times.";
    else if (/procrast/.test(lower)) answer = "you're not avoiding the task. you're avoiding the opening scene. relief pays instantly; your to-do list is running a tiny protection racket.";
    else if (/google|yahoo/.test(lower)) answer = "google made search the product. yahoo built a department store and brought a mall to a speed test.";
    let pulls = [];
    if (/rome/.test(lower)) pulls = [
      { role: "deepen", lens: "power", heat: 9, label: "power", query: "how did civil wars weaken rome more than invasions?" },
      { role: "consequence", lens: "money", heat: 8, label: "money", query: "why could late rome no longer fund its armies?" },
      { role: "surprise", lens: "cost", heat: 8, label: "the east", query: "why did constantinople last another thousand years?" },
    ];
    else if (/ice/.test(lower)) pulls = [
      { role: "deepen", lens: "mechanism", heat: 8, label: "lattice", query: "why does water spread out when it freezes?" },
      { role: "contradiction", lens: "evidence", heat: 7, label: "density", query: "what measurement proves ice is less dense?" },
      { role: "consequence", lens: "exception", heat: 8, label: "lakes", query: "why do lakes freeze from the surface down?" },
    ];
    else if (/concert|ticket/.test(lower)) pulls = [
      { role: "deepen", lens: "money", heat: 9, label: "fees", query: "why can one ticket collect three separate fees?" },
      { role: "contradiction", lens: "power", heat: 8, label: "venues", query: "why did venues surrender control of ticketing?" },
      { role: "consequence", lens: "cost", heat: 7, label: "independents", query: "why are independent music venues disappearing?" },
    ];
    else if (/nvidia/.test(lower)) pulls = [
      { role: "deepen", lens: "design", heat: 9, label: "cuda", query: "why did cuda make developers stay with nvidia?" },
      { role: "contradiction", lens: "failure", heat: 8, label: "chips", query: "why were nvidia's chips suited to ai?" },
      { role: "consequence", lens: "tradeoff", heat: 9, label: "developers", query: "how did developers turn cuda into a moat?" },
    ];
    else if (/procrast/.test(lower)) pulls = [
      { role: "deepen", lens: "habit", heat: 9, label: "relief", query: "why does avoidance feel rewarding immediately?" },
      { role: "contradiction", lens: "fear", heat: 8, label: "fear", query: "how does fear make starting feel dangerous?" },
      { role: "consequence", lens: "reward", heat: 8, label: "habit", query: "how does repeated delay become automatic?" },
    ];
    const voiceNote = {
      domain,
      prompt: "where this story goes next",
      copyStyle: "question_v2",
      pulls: pulls.map((door, index) => ({
        ...door,
        id: `demo_${hashString(`${query}:${index}`)}`,
        grounding: "optional",
      })),
    };
    return {
      answer,
      voiceNote,
      doorState: pulls.length === 3 ? "ready" : "unavailable",
      doorGeneration: { status: pulls.length === 3 ? "preview" : "withheld", attempts: 0, candidateCount: pulls.length },
      domain,
      sources: [],
      receiptsAvailable: true,
      preview: true,
      grounding: "optional",
      elapsedMs: 140,
    };
  }

  function invalidateNavigation() {
    navigationEpoch += 1;
    clearTimeout(transitionTimer);
    foregroundController?.abort(new DOMException("Navigation changed", "AbortError"));
    foregroundController = null;
    for (const controller of receiptControllers.values()) {
      controller.abort(new DOMException("Path changed", "AbortError"));
    }
    receiptControllers.clear();
    pendingRequest = null;
    interaction = { status: "idle", nodeId: "", answerVisibleAt: 0 };
  }

  function newThread(query) {
    return {
      id: uid("thread"),
      title: cleanText(query, 180),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
  }

  function appendUser(thread, query, source, via = null, selectionId = "") {
    const existing = selectionId && thread.messages.find((message) => message.selectionId === selectionId);
    if (existing) return existing;
    const message = {
      id: uid("user"),
      role: "user",
      content: cleanText(query, 4000),
      source,
      ...(selectionId ? { selectionId } : {}),
      ...(via ? { via } : {}),
    };
    thread.messages.push(message);
    return message;
  }

  async function commitResponse(pending, result) {
    if (pending.epoch !== navigationEpoch || active?.id !== pending.threadId || pendingRequest !== pending) return false;
    const thread = state.threads.find((candidate) => candidate.id === pending.threadId);
    if (!thread) return false;
    const alreadyAnswered = thread.messages.some((message) => message.role === "assistant" && message.replyTo === pending.userId);
    if (!alreadyAnswered) {
      thread.messages.push({
        id: uid("answer"),
        nodeId: uid("node"),
        replyTo: pending.userId,
        role: "assistant",
        content: result.answer,
        domain: result.domain,
        voiceNote: result.voiceNote,
        sources: result.sources,
        receiptsAvailable: result.receiptsAvailable,
        groundingStatus: result.groundingStatus,
        doorState: result.doorState,
        doorGeneration: result.doorGeneration,
        safetyMode: result.safetyMode,
        preview: result.preview,
      });
    }
    clearTimeout(pending.visualHoldTimer);
    pendingRequest = null;
    const threadPersisted = saveThread(thread);
    if (threadPersisted && pending.deferredAward) {
      const settledAward = scoreSelection(pending.deferredAward);
      if (settledAward.persisted) {
        const awardedUser = thread.messages.find((message) => message.id === pending.userId);
        if (awardedUser) awardedUser.awardState = "committed";
        saveThread(thread);
        pending.deferredAward = null;
      }
    }
    const depth = completedNodes(thread).length;
    if (threadPersisted) {
      ledger.deepestPath = Math.max(ledger.deepestPath, depth);
      persistLedger();
    } else {
      warnVolatileThread(thread.id, "answer");
    }
    noteAcceptedAnswer(pending.query, result.domain, depth);
    if (pending.source === "door" && pending.selectionId) {
      updateRankingOutcome(pending.selectionId, { answerVisible: true, failed: false, maxDepth: depth });
    }
    if (pending.source === "daily" && depth === 1) {
      const visit = readJSON(VISIT_KEY) || {};
      writeJSON(VISIT_KEY, { ...visit, dailyCompletedDay: currentPacificDay, lastVisitAt: Date.now() });
      track("daily_why_completed", { source: "daily", depth });
    }
    if (depth >= 3) void requestPersistentStorage();
    track("door_board_result", {
      threadId: thread.id,
      depth,
      status: result.doorGeneration?.status || (result.doorState === "ready" ? "model" : "withheld"),
      attempts: $number(result.doorGeneration?.attempts, 2),
      candidateCount: $number(result.doorGeneration?.candidateCount, 9),
      fallbackUsed: false,
      doorsShown: result.voiceNote?.pulls?.length === 3 ? 3 : 0,
    });
    if (depth >= 3) {
      track("rabbit_hole_depth_reached", {
        threadId: thread.id,
        nodeId: currentNode(thread)?.id || "",
        depth,
        source: pending.source,
        sessionPulls: session.pulls,
      });
    }
    const usedAllowedName = pending.allowName && nameProfile.name &&
      new RegExp(`\\b${nameProfile.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(result.answer);
    if (usedAllowedName) {
      nameProfile.nameUses += 1;
      nameProfile.lastNameUsePull = ledger.pulls;
      persistNameProfile();
    }
    const card = $(".curiosity-node");
    if (card && !REDUCED_MOTION.matches) {
      card.classList.add("is-exiting");
      await wait(130);
    }
    if (pending.epoch !== navigationEpoch || active?.id !== pending.threadId) return false;
    renderActiveNode(thread, { selectedAt: pending.selectedAt });
    if (result.preview) toast("Local preview only. Deploy to test live answers.");
    return true;
  }

  // Paints PHASE A as it arrives. The old flow showed a spinner (cold start) or a
  // frozen previous answer (door pull) for the whole ~12s generation; the prose now
  // appears word by word from roughly the first second.
  function renderStreamingAnswer(pending, partialText) {
    if (pending.epoch !== navigationEpoch || pendingRequest !== pending) return;
    if (pending.source === "door" && !REDUCED_MOTION.matches) {
      const remaining = DOOR_FEEDBACK_HOLD_MS - (performance.now() - pending.selectedAt);
      if (remaining > 0) {
        pending.bufferedAnswerText = partialText;
        clearTimeout(pending.visualHoldTimer);
        pending.visualHoldTimer = setTimeout(() => {
          pending.visualHoldTimer = null;
          renderStreamingAnswer(pending, pending.bufferedAnswerText);
        }, remaining);
        return;
      }
    }
    const conversation = $("#conversation");
    if (!conversation) return;
    let card = $(".curiosity-node.is-streaming");
    if (!card) {
      show("answer");
      conversation.innerHTML = `<article class="curiosity-node is-streaming" aria-label="WHY answer" aria-busy="true">
        <section class="node-answer" tabindex="-1"><article class="prose"><p class="lead typing-copy"></p></article></section>
        <section class="door-zone" aria-label="Finding the next questions">
          ${doorBrandMarkup("truth landed. trouble next.")}
          <div class="node-progress">digging</div>
        </section>
      </article>`;
      card = $(".curiosity-node.is-streaming");
      $("#followForm")?.setAttribute("aria-busy", "true");
      interaction.status = "streaming";
    }
    const target = $(".prose .lead", card);
    if (target) {
      target.textContent = capSpokenAnswer(String(partialText || ""), pending.query)
        .replace(/^##\s*Short answer\s*/i, "")
        .replace(/^#+\s*/gm, "")
        .trim();
    }
    return card;
  }

  function markCurrentNodeWaiting(pending) {
    const card = $(".curiosity-node");
    if (!card || card.dataset.nodeId !== pending.parentNodeId) return false;
    card.classList.add("is-waiting");
    card.setAttribute("aria-busy", "true");
    const zone = $(".door-zone", card);
    let progress = $(".node-progress", zone);
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "node-progress";
      zone?.appendChild(progress);
    }
    progress.textContent = "opening that door";
    interaction.status = "waiting";
    return true;
  }

  async function runPending(pending, context) {
    pendingRequest = pending;
    pending.allowName = context.payload.profile?.allowName === true;
    if (pending.allowName) session.nameCadenceClaimed = true;
    if (context.payload.player?.acknowledgeReturn === true) {
      session.returnAcknowledgementAvailable = false;
    }
    const thread = state.threads.find((candidate) => candidate.id === pending.threadId);
    if (!thread) return;
    if (completedNodes(thread).length) {
      // A door selection has already locked and painted the current board. Keep
      // that exact DOM alive so the reward/fold animation gets a real frame,
      // while the network request begins immediately in this same call.
      if (pending.source !== "door" || !markCurrentNodeWaiting(pending)) {
        renderActiveNode(thread, { suppressTrack: true });
      }
    }
    else show("loading");
    const requestController = new AbortController();
    foregroundController = requestController;
    try {
      let firstContentAt = 0;
      const paintAnswer = (text) => {
        if (!firstContentAt && text) {
          firstContentAt = performance.now();
          track("answer_latency", {
            source: pending.source,
            elapsedMs: Math.max(0, Math.round(firstContentAt - pending.selectedAt)),
            depth: completedNodes(thread).length + 1,
          });
        }
        renderStreamingAnswer(pending, text);
      };
      const result = await fetchAnswer(context, requestController.signal, 42000, paintAnswer);
      if (!firstContentAt && result.answer) {
        firstContentAt = performance.now();
        track("answer_latency", {
          source: pending.source,
          elapsedMs: Math.max(0, Math.round(firstContentAt - pending.selectedAt)),
          depth: completedNodes(thread).length + 1,
        });
      }
      track("board_ready_latency", {
        source: pending.source,
        status: result.doorState,
        elapsedMs: Math.max(0, Math.round(performance.now() - pending.selectedAt)),
        depth: completedNodes(thread).length + 1,
      });
      if (pending.source === "door" && !REDUCED_MOTION.matches) {
        const elapsed = performance.now() - pending.selectedAt;
        if (elapsed < DOOR_FEEDBACK_HOLD_MS) await wait(DOOR_FEEDBACK_HOLD_MS - elapsed);
      }
      await commitResponse(pending, result);
    } catch (error) {
      clearTimeout(pending.visualHoldTimer);
      if (pending.epoch !== navigationEpoch || error?.name === "AbortError") return;
      pending.status = "error";
      pending.error = error?.name === "TimeoutError" ? "that path took too long" : cleanText(error?.message || "that path stalled", 100);
      pendingRequest = pending;
      if (pending.initial) {
        $("#errorMessage").textContent = pending.error;
        show("error");
        requestAnimationFrame(() => {
          if (!$("#historyModal")?.classList.contains("open")) $("#errorView [data-action='retry']")?.focus();
        });
      } else {
        renderActiveNode(thread, { suppressTrack: true });
      }
      track("path_error", { threadId: pending.threadId, source: pending.source, depth: completedNodes(thread).length });
      track("hard_failure", {
        source: pending.source,
        reason: error?.name === "TimeoutError" ? "timeout" : "request_failed",
        elapsedMs: Math.max(0, Math.round(performance.now() - pending.selectedAt)),
        depth: completedNodes(thread).length + 1,
      });
      if (pending.source === "door" && pending.selectionId) updateRankingOutcome(pending.selectionId, { failed: true });
    } finally {
      if (foregroundController === requestController) foregroundController = null;
    }
  }

  function startPath(rawQuery, source = "typed", seedDomain = "") {
    const query = cleanText(rawQuery, 4000);
    if (query.length < 3) { toast("Ask a fuller question."); return; }
    invalidateNavigation();
    resetPathSession();
    ledger.currentDepthStreak = 0;
    persistLedger();
    const thread = newThread(query);
    active = thread;
    state.threads.unshift(thread);
    if (location.protocol !== "file:" && location.pathname !== "/") {
      try { history.pushState({}, "", "/"); } catch {}
    }
    const context = buildRequestContext(thread, query, seedDomain ? { domain: safeDomain(seedDomain) } : null);
    const user = appendUser(thread, query, source);
    if (!saveThread(thread)) warnVolatileThread(thread.id, "path_start");
    const pending = {
      id: uid("request"),
      epoch: navigationEpoch,
      threadId: thread.id,
      userId: user.id,
      query,
      source,
      initial: true,
      status: "waiting",
      selectedAt: performance.now(),
      via: null,
      parentNodeId: "",
    };
    track("path_started", { threadId: thread.id, source, zeroTyping: source === "seed" || source === "rabbit" });
    runPending(pending, context);
  }

  function submitTypedFollowup(rawQuery) {
    const query = cleanText(rawQuery, 4000);
    if (!active) { startPath(query, "typed"); return; }
    if (query.length < 3) { toast("Ask a fuller question."); return; }
    if (interaction.status !== "displayed") return;
    interaction.status = "selecting";
    session.typedFollowups += 1;
    const thread = active;
    const context = buildRequestContext(thread, query);
    const user = appendUser(thread, query, "typed");
    if (!saveThread(thread)) warnVolatileThread(thread.id, "typed_followup");
    const pending = {
      id: uid("request"),
      epoch: navigationEpoch,
      threadId: thread.id,
      userId: user.id,
      query,
      source: "typed",
      initial: false,
      status: "waiting",
      selectedAt: performance.now(),
      via: null,
      parentNodeId: currentNode(thread)?.id || "",
    };
    closeComposer();
    runPending(pending, context);
  }

  function doorFromButton(button) {
    return {
      id: cleanText(button.dataset.doorId, 100),
      query: cleanText(button.dataset.query, 160),
      label: cleanText(button.dataset.label, 70),
      copyStyle: ["concept_v1", "question_v1", "question_v2"].includes(button.dataset.copyStyle) ? button.dataset.copyStyle : "question_v2",
      role: VALID_ROLES.has(button.dataset.role) ? button.dataset.role : "deepen",
      promise: VALID_PROMISES.has(button.dataset.promise) ? button.dataset.promise : PROMISE_FOR_ROLE[button.dataset.role] || "microscope",
      lens: VALID_LENSES.has(button.dataset.lens) ? button.dataset.lens : "",
      domain: safeDomain(button.dataset.domain),
      position: Math.max(1, Math.min(3, Number(button.dataset.position) || 1)),
      heat: clampHeat(button.dataset.heat) || 1,
      grounding: ["off", "optional", "required"].includes(button.dataset.grounding) ? button.dataset.grounding : "optional",
      memoryConnected: button.dataset.memoryConnected === "true",
    };
  }

  function selectDoor(button) {
    const node = currentNode();
    if (!node || interaction.status !== "displayed" || interaction.nodeId !== node.id) return;
    interaction.status = "selecting";
    const door = doorFromButton(button);
    if (!door.id || !door.query || !door.lens) { interaction.status = "displayed"; return; }
    const thread = active;
    const dailyParentNode = thread.dailyEpisodeId === dailyEpisode?.id ? dailyNode(node.id) : null;
    const dailySelectedDoor = dailyParentNode
      ? dailyDoor(dailyParentNode.id, door.id) || dailyParentNode.doors.find((candidate) => candidate.query === door.query) || null
      : null;
    const useDailyPathProof = Boolean(dailyParentNode && dailySelectedDoor);
    const dailyTargetNode = dailySelectedDoor?.targetNodeId ? dailyNode(dailySelectedDoor.targetNodeId) : null;
    const selectionId = stableSelectionId(thread.id, node.id, door.id, door.query);
    const answerToChoiceMs = Math.max(0, Math.round(performance.now() - interaction.answerVisibleAt));
    const nextDepth = node.depth + 1;
    const interruptedUser = trailingUser(thread);
    const alreadyAwarded = ledger.awardedSelectionIds.includes(selectionId);
    const recoveringInterruptedPull = Boolean(alreadyAwarded && interruptedUser?.selectionId === selectionId);
    if (alreadyAwarded && !recoveringInterruptedPull) {
      interaction.status = pendingRequest ? "waiting" : "displayed";
      return;
    }
    const via = { ...door, doorId: door.id, ...(dailyParentNode ? { dailyParentNodeId: dailyParentNode.id } : {}) };
    const context = buildRequestContext(thread, door.query, via);
    const user = recoveringInterruptedPull
      ? interruptedUser
      : appendUser(thread, door.query, "door", via, selectionId);
    const safetyMode = node.answer.safetyMode === "crisis";
    if (!recoveringInterruptedPull) user.awardState = safetyMode ? "none" : "pending";
    const selectionPersisted = recoveringInterruptedPull ? true : saveThread(thread);
    const result = recoveringInterruptedPull
      ? { duplicate: true, exploration: 0, insight: 0, gained: 0, heat: door.heat, jackpot: false }
      : safetyMode
        ? { duplicate: false, exploration: 0, insight: 0, gained: 0, heat: 0, jackpot: false, safety: true }
        : selectionPersisted
          ? scoreSelection({ selectionId, heat: door.heat, depth: nextDepth })
          : previewSelectionScore(door.heat, nextDepth);
    // Keep haptics in the original click call stack and fire before storage/UI work.
    if (!result.duplicate && !safetyMode) triggerDoorHaptic(result);
    if (!recoveringInterruptedPull && result.persisted) {
      user.awardState = "committed";
      if (!saveThread(thread)) warnVolatileThread(thread.id, "award_journal");
    }
    if (!selectionPersisted) {
      warnVolatileThread(thread.id, "selection");
    }
    if (!result.duplicate && !safetyMode) session.pulls += 1;
    const rewardRect = !result.duplicate && !safetyMode
      ? revealReward(button, result, { showPoints: !useDailyPathProof })
      : null;
    if (safetyMode) button.closest(".door-board")?.querySelectorAll("button").forEach((doorButton) => { doorButton.disabled = true; });
    else button.closest(".door-board")?.querySelectorAll("button").forEach((doorButton) => { doorButton.disabled = true; });
    if (!result.duplicate && !safetyMode) {
      noteCuriosity({ role: door.role, heat: door.heat, pull: true });
      noteRankingSelection(selectionId, door, node.depth, node.user?.selectionId || "", node.answer.voiceNote?.pulls || []);
      const selectionProperties = {
        threadId: thread.id,
        nodeId: node.id,
        boardId: `board_${hashString(`${node.id}:${node.answer.voiceNote?.pulls?.map((pull) => pull.id).join(":") || ""}`)}`,
        doorId: door.id,
        position: door.position,
        role: door.role,
        promise: door.promise,
        domain: door.domain,
        depth: node.depth,
        nextDepth,
        sessionPullNumber: session.pulls,
        answerToChoiceMs,
        copyStyle: door.copyStyle,
        memoryConnected: door.memoryConnected === true,
      };
      track("door_selected", selectionProperties);
      if (session.pulls === 1) track("first_door_selected", selectionProperties);
      if (session.pulls === 2) track("second_door_selected", selectionProperties);
    } else if (safetyMode) {
      track("safety_action_selected", { threadId: thread.id, nodeId: node.id, doorId: door.id });
    } else {
      track("path_retry", { threadId: thread.id, nodeId: node.id, doorId: door.id, reason: "reload_interrupted" });
    }
    if (dailyParentNode && dailySelectedDoor && !result.duplicate && !safetyMode) {
      void recordDailyChoice(dailyParentNode.id, dailySelectedDoor.id).then((proof) => {
        const matchesSelection = proof?.selectedDoorId === dailySelectedDoor.id;
        if (!matchesSelection || !showDailyPathProof(rewardRect, proof)) showPointReward(rewardRect, result);
      });
    }
    if (dailyTargetNode && !safetyMode) {
      button.classList.add("is-selected");
      button.closest(".curiosity-node")?.classList.add("is-waiting");
      const selectedAt = performance.now();
      const selectedEpoch = navigationEpoch;
      setTimeout(() => {
        const alreadyAnswered = thread.messages.some((message) => message.role === "assistant" && message.replyTo === user.id);
        if (!alreadyAnswered) appendDailyAnswer(thread, user, dailyTargetNode);
        const persisted = saveThread(thread);
        if (!persisted) warnVolatileThread(thread.id, "daily_answer");
        const depth = completedNodes(thread).length;
        if (persisted) {
          ledger.deepestPath = Math.max(ledger.deepestPath, depth);
          persistLedger();
        }
        noteAcceptedAnswer(door.query, dailyTargetNode.domain, depth);
        updateRankingOutcome(selectionId, { answerVisible: true, failed: false, maxDepth: depth });
        track("door_board_result", { threadId: thread.id, depth, status: "editorial", attempts: 0, candidateCount: 3, fallbackUsed: false, doorsShown: 3 });
        if (selectedEpoch === navigationEpoch && active?.id === thread.id) renderActiveNode(thread, { selectedAt });
      }, REDUCED_MOTION.matches ? 0 : DOOR_FEEDBACK_HOLD_MS);
      return;
    }
    const pending = {
      id: uid("request"),
      epoch: navigationEpoch,
      threadId: thread.id,
      userId: user.id,
      query: door.query,
      source: "door",
      selectionId,
      initial: false,
      status: "waiting",
      selectedAt: performance.now(),
      via,
      parentNodeId: node.id,
      dailyChoiceParentNodeId: dailyParentNode?.id || "",
      deferredAward: !safetyMode && !recoveringInterruptedPull && (!selectionPersisted || result.persisted === false)
        ? { selectionId, heat: door.heat, depth: nextDepth }
        : null,
    };
    closeComposer();
    runPending(pending, context);
  }

  function retryPending() {
    if (!pendingRequest || pendingRequest.status !== "error") return;
    const pending = pendingRequest;
    const thread = state.threads.find((candidate) => candidate.id === pending.threadId);
    if (!thread || active?.id !== thread.id) return;
    pending.status = "waiting";
    pending.error = "";
    pending.epoch = navigationEpoch;
    pending.selectedAt = performance.now();
    const context = buildRequestContext(thread, pending.query, pending.via);
    runPending(pending, context);
  }

  async function retryDoorBoard() {
    const thread = active;
    const node = currentNode(thread);
    if (!thread || !node || pendingRequest || node.answer.safetyMode === "crisis") return;
    interaction.status = "waiting";
    const button = $("[data-action='retry-doors']");
    if (button) {
      button.disabled = true;
      button.textContent = "finding them";
    }
    const controller = new AbortController();
    foregroundController = controller;
    track("door_board_retry_started", { threadId: thread.id, nodeId: node.id, depth: node.depth });
    try {
      const context = buildRequestContext(thread, node.question);
      const data = await fetchDoors(context, controller.signal, node.answer.content, node.answer.domain);
      const voiceNote = normalizeVoiceNote(data?.voiceNote, node.question, data?.domain || node.answer.domain);
      if (voiceNote.pulls.length !== 3) throw new Error("The next three still did not land.");
      node.answer.voiceNote = voiceNote;
      node.answer.domain = voiceNote.domain;
      node.answer.doorState = "ready";
      node.answer.doorGeneration = data?.doorGeneration || { status: "retried", attempts: 1, candidateCount: 3 };
      saveThread(thread);
      lastVisibleNodeId = "";
      renderActiveNode(thread, { focus: false });
      track("door_board_retry_succeeded", {
        threadId: thread.id,
        nodeId: node.id,
        depth: node.depth,
        status: node.answer.doorGeneration.status,
      });
    } catch (error) {
      interaction.status = "displayed";
      renderActiveNode(thread, { suppressTrack: true, focus: false });
      toast(cleanText(error?.message || "The next three still stalled.", 90));
      track("door_board_retry_failed", { threadId: thread.id, nodeId: node.id, depth: node.depth });
    } finally {
      if (foregroundController === controller) foregroundController = null;
    }
  }

  async function requestReceipts(button) {
    const query = cleanText(button.dataset.receipts, 4000);
    const answerId = cleanText(button.dataset.answerId, 100);
    const threadId = cleanText(button.dataset.threadId, 100);
    if (!query || !answerId || !threadId || button.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "checking…";
    const receiptKey = `${threadId}:${answerId}`;
    receiptControllers.get(receiptKey)?.abort(new DOMException("Replaced", "AbortError"));
    const receiptController = new AbortController();
    receiptControllers.set(receiptKey, receiptController);
    const composed = composeSignal(receiptController.signal, 12000);
    try {
      const response = await fetch("/api/ultimate-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receipts", query }),
        signal: composed.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Receipts did not arrive.");
      const sources = validSources(data?.sources);
      if (!sources.length) {
        button.textContent = "nothing solid found";
        setTimeout(() => { button.disabled = false; button.textContent = original; }, 1700);
        return;
      }
      const thread = state.threads.find((candidate) => candidate.id === threadId);
      const message = thread?.messages.find((candidate) => candidate.id === answerId && candidate.role === "assistant");
      if (!message) return;
      message.sources = sources;
      message.receiptsAvailable = false;
      const receiptsPersisted = saveThread(thread);
      if (!receiptsPersisted) warnVolatileThread(thread.id, "receipts");
      if (active?.id === threadId && currentNode(active)?.answer.id === answerId) {
        $(".node-trust").innerHTML = sourceMarkup(sources);
      }
      if (receiptsPersisted) toast("Receipts added.");
    } catch (error) {
      if (error?.name === "AbortError") return;
      button.disabled = false;
      button.textContent = original;
      toast(error?.message || "Receipts did not arrive.");
    } finally {
      composed.clear();
      if (receiptControllers.get(receiptKey) === receiptController) receiptControllers.delete(receiptKey);
    }
  }

  function openComposer() {
    if (interaction.status !== "displayed") return;
    requestAnimationFrame(() => $("#followInput").focus());
  }

  function closeComposer() {
    $("#followInput")?.blur();
    if ($("#followInput")) $("#followInput").value = "";
  }

  function goHome(focus = false) {
    if (active) {
      const depth = completedNodes(active).length;
      if (depth) {
        track("path_abandoned", { threadId: active.id, depth, pulls: session.pulls, zeroTypingAfterStart: session.typedFollowups === 0 });
      } else {
        state.threads = state.threads.filter((thread) => thread.id !== active.id);
        persistThreads();
        renderHistory();
      }
    }
    invalidateNavigation();
    active = null;
    lastVisibleNodeId = "";
    resetPathSession();
    closeComposer();
    renderSeeds();
    show("home");
    if (location.protocol !== "file:" && location.pathname !== "/") {
      try { history.pushState({}, "", "/"); } catch {}
    }
    if (focus) setTimeout(() => $("#startQuestionInput")?.focus(), 30);
  }

  function openHistory(open) {
    const modal = $("#historyModal");
    const shouldOpen = open ?? !modal.classList.contains("open");
    if (shouldOpen) {
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      historyReturnFocus = $("#navDropdown")?.contains(opener) ? $(".nav-menu-btn") : opener;
      setMenuOpen(false);
    }
    modal.classList.toggle("open", shouldOpen);
    modal.inert = !shouldOpen;
    modal.toggleAttribute("inert", !shouldOpen);
    modal.setAttribute("aria-hidden", String(!shouldOpen));
    if (shouldOpen) {
      renderHistory();
      requestAnimationFrame(() => $("[data-action='close-history']", modal)?.focus());
    } else if (historyReturnFocus?.isConnected) {
      historyReturnFocus.focus({ preventScroll: true });
      historyReturnFocus = null;
    }
  }

  function restorePathNode(threadId, nodeId) {
    const source = state.threads.find((candidate) => candidate.id === threadId);
    const nodes = completedNodes(source);
    const targetIndex = nodes.findIndex((node) => node.id === nodeId);
    if (!source || targetIndex < 0) return;
    if (targetIndex === nodes.length - 1) {
      $(".node-answer")?.focus({ preventScroll: true });
      return;
    }
    const target = nodes[targetIndex];
    let messages;
    try { messages = structuredClone(source.messages.slice(0, target.answerIndex + 1)); }
    catch { messages = JSON.parse(JSON.stringify(source.messages.slice(0, target.answerIndex + 1))); }
    const branch = {
      id: uid("thread"),
      title: source.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(source.dailyEpisodeId ? { dailyEpisodeId: source.dailyEpisodeId } : {}),
      messages,
    };
    invalidateNavigation();
    resetPathSession();
    active = branch;
    lastVisibleNodeId = "";
    ledger.currentDepthStreak = Math.max(0, target.depth - 1);
    persistLedger();
    closeComposer();
    if (!saveThread(branch)) warnVolatileThread(branch.id, "path_branch");
    renderActiveNode(branch, { suppressTrack: true, suppressPrefetch: true });
    track("path_connection_opened", {
      source: "path_crumb",
      depth: target.depth,
      nextDepth: nodes.length,
    });
  }

  function restoreThread(threadId) {
    const thread = state.threads.find((candidate) => candidate.id === threadId);
    if (!thread || (!completedNodes(thread).length && !trailingUser(thread))) return;
    if (active && active.id !== thread.id && completedNodes(active).length) {
      track("path_abandoned", { threadId: active.id, depth: completedNodes(active).length, pulls: session.pulls, zeroTypingAfterStart: session.typedFollowups === 0 });
    }
    invalidateNavigation();
    resetPathSession();
    active = thread;
    if (thread.dailyEpisodeId === dailyEpisode?.id) setDailyPathUrl();
    const interrupted = trailingUser(thread);
    const interruptedWasAwarded = Boolean(interrupted?.selectionId && ledger.awardedSelectionIds.includes(interrupted.selectionId));
    ledger.currentDepthStreak = Math.max(0, completedNodes(thread).length - 1 + (interruptedWasAwarded ? 1 : 0));
    persistLedger();
    lastVisibleNodeId = "";
    openHistory(false);
    closeComposer();
    const parent = currentNode(thread);
    if (interrupted) {
      pendingRequest = {
        id: uid("request"),
        epoch: navigationEpoch,
        threadId: thread.id,
        userId: interrupted.id,
        query: interrupted.content,
        source: interrupted.source || "typed",
        selectionId: interrupted.selectionId || "",
        initial: !parent,
        status: "error",
        error: "that path was interrupted",
        selectedAt: performance.now(),
        via: interrupted.via || null,
        parentNodeId: parent?.id || "",
        dailyChoiceParentNodeId: interrupted.via?.dailyParentNodeId || "",
      };
    }
    if (parent) {
      renderActiveNode(thread);
    } else {
      $("#errorMessage").textContent = "that first answer was interrupted — your question is still here.";
      show("error");
      requestAnimationFrame(() => $("#errorView [data-action='retry']")?.focus());
    }
    track("path_resumed", { threadId: thread.id, depth: completedNodes(thread).length });
  }

  function pathExportPayload() {
    return {
      product: "WHY",
      version: PATH_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      threads: state.threads,
    };
  }

  function exportPaths() {
    const raw = serializedJSON(pathExportPayload());
    if (!raw) {
      toast("Paths could not be exported.");
      return;
    }
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `why-paths-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    track("paths_exported", { candidateCount: state.threads.length });
    toast(state.threads.length ? "Paths exported." : "Empty path file exported.");
  }

  function importedThreadsFromEnvelope(payload) {
    if (payload?.product !== "WHY" || payload?.version !== PATH_EXPORT_VERSION || !Array.isArray(payload?.threads)) {
      throw new Error("That is not a valid WHY path file.");
    }
    if (payload.threads.length > 500) throw new Error("That path file is too large.");
    const usedIds = new Set();
    const threads = payload.threads.map((thread, index) => sanitizeThread(thread, index, usedIds)).filter(Boolean);
    if (threads.length !== payload.threads.length) throw new Error("That path file contains damaged entries.");
    return threads;
  }

  async function importPathsFile(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) throw new Error("That path file is too large.");
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { throw new Error("That path file could not be read."); }
    const importedThreads = importedThreadsFromEnvelope(payload);
    const previousThreads = state.threads;
    state.threads = mergeThreadLists(previousThreads, importedThreads);
    if (!persistThreads()) {
      state.threads = previousThreads;
      throw new Error("Those paths could not be saved on this device.");
    }
    refreshCuriosityGraph();
    const importedIds = new Set(importedThreads.map((thread) => thread.id));
    const retained = state.threads.filter((thread) => importedIds.has(thread.id)).length;
    renderHistory();
    renderSeeds();
    track("paths_imported", { candidateCount: retained });
    toast(`${retained} ${retained === 1 ? "path" : "paths"} imported.`);
  }

  function clearHistory() {
    const previousThreads = state.threads;
    state.threads = [];
    if (!persistThreads({ mergeStored: false })) {
      state.threads = previousThreads;
      renderHistory();
      toast("History could not be cleared on this device.");
      return;
    }
    refreshCuriosityGraph();
    invalidateNavigation();
    resetPathSession();
    active = null;
    volatileThreadIds.clear();
    renderHistory();
    renderSeeds();
    openHistory(false);
    show("home");
    toast("Local paths cleared.");
  }

  $("#followForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#followInput").value;
    submitTypedFollowup(query);
  });

  $("#pathImportInput")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    try {
      await importPathsFile(input.files?.[0]);
    } catch (error) {
      toast(cleanText(error?.message || "Those paths could not be imported.", 100));
      track("paths_import_failed", { reason: "invalid_or_unavailable" });
    } finally {
      input.value = "";
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "startQuestionForm") {
      event.preventDefault();
      const input = $("#startQuestionInput");
      const typedQuery = cleanText(input?.value || "", 4000);
      startPath(typedQuery, "typed");
      return;
    }
    if (event.target.id !== "nameForm") return;
    event.preventDefault();
    const input = $(".name-input", event.target);
    const name = cleanName(input?.value);
    if (!name) { input?.focus(); return; }
    nameProfile = { name, declined: false, nameUses: 0, lastNameUsePull: 0 };
    persistNameProfile();
    renderActiveNode(active, { suppressTrack: true, focus: false });
  });

  document.addEventListener("pointerover", (event) => {
    const button = event.target.closest("[data-home-category]");
    if (!button) return;
    homeHeroPaused = true;
    showHomeHeroCategory(cleanText(button.dataset.homeCategory, 32).toLowerCase());
  });

  document.addEventListener("pointerout", (event) => {
    const row = event.target.closest(".home-category-row");
    if (!row || row.contains(event.relatedTarget)) return;
    homeHeroPaused = false;
    scheduleHomeHeroRotation();
  });

  document.addEventListener("focusin", (event) => {
    const button = event.target.closest("[data-home-category]");
    if (!button) return;
    homeHeroPaused = true;
    showHomeHeroCategory(cleanText(button.dataset.homeCategory, 32).toLowerCase(), { animate: false });
  });

  document.addEventListener("focusout", (event) => {
    const row = event.target.closest(".home-category-row");
    if (!row || row.contains(event.relatedTarget)) return;
    homeHeroPaused = false;
    scheduleHomeHeroRotation();
  });

  document.addEventListener("click", (event) => {
    const receipt = event.target.closest("[data-receipts]");
    if (receipt) { requestReceipts(receipt); return; }
    const pathNode = event.target.closest("[data-path-node]");
    if (pathNode) {
      event.preventDefault();
      restorePathNode(pathNode.dataset.pathThread, pathNode.dataset.pathNode);
      return;
    }
    const dailyRootDoor = event.target.closest(".daily-root-door");
    if (dailyRootDoor) { void selectDailyRootDoor(dailyRootDoor); return; }
    const door = event.target.closest(".curiosity-door");
    if (door) { selectDoor(door); return; }
    const adsSeed = event.target.closest("[data-ads-seed]");
    if (adsSeed) {
      const query = cleanText(adsSeed.dataset.query, 160);
      if (!query) { toast("That path missed its cue."); return; }
      triggerDoorHaptic({ jackpot: false, gained: 3 });
      startPath(query, "seed", safeDomain(adsSeed.dataset.domain || "public"));
      return;
    }
    const homeCategory = event.target.closest("[data-home-category]");
    if (homeCategory) {
      const category = cleanText(homeCategory.dataset.homeCategory, 32).toLowerCase();
      const seed = homeHeroSeed(category);
      if (!seed) { toast("That rabbit hole missed its cue."); return; }
      triggerDoorHaptic({ jackpot: false, gained: 3 });
      track("rabbit_hole_category_selected", { source: "rabbit", area: category, zeroTyping: true });
      startPath(seed.query, "rabbit", seed.domain);
      return;
    }
    const rabbitCategory = event.target.closest("[data-rabbit-category]");
    if (rabbitCategory) {
      const category = cleanText(rabbitCategory.dataset.rabbitCategory, 32).toLowerCase();
      const seed = chooseRabbitSeed(category);
      if (!seed) { toast("That rabbit hole missed its cue."); return; }
      triggerDoorHaptic({ jackpot: false, gained: 3 });
      track("rabbit_hole_category_selected", { source: "rabbit", area: category, zeroTyping: true });
      startPath(seed.query, "rabbit", seed.domain);
      return;
    }
    const seed = event.target.closest("[data-seed]");
    if (seed) { startPath(seed.dataset.seed, seed.dataset.seedDaily === "true" ? "daily" : "seed", seed.dataset.seedDomain); return; }
    const historyItem = event.target.closest("[data-history]");
    if (historyItem) { restoreThread(historyItem.dataset.history); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "menu") {
      const menu = $("#navMenu");
      setMenuOpen(!menu.classList.contains("open"));
    }
    if (action === "home" || action === "new") goHome(false);
    if (action === "history") openHistory(true);
    if (action === "close-history") openHistory(false);
    if (action === "export-paths") exportPaths();
    if (action === "import-paths") $("#pathImportInput")?.click();
    if (action === "clear") clearHistory();
    if (action === "reset-model") resetSelfModel();
    if (action === "cancel") goHome(false);
    if (action === "retry") retryPending();
    if (action === "retry-doors") retryDoorBoard();
    if (action === "open-composer") openComposer();
    if (action === "close-composer") closeComposer();
    if (action === "open-daily-search") {
      const form = $("#startQuestionForm");
      if (form) {
        const homeHero = event.target.closest(".home-hero");
        if (homeHero) {
          homeHeroPaused = true;
          stopHomeHeroMotion();
          homeHero.querySelector(".home-category-row")?.setAttribute("hidden", "");
          homeHero.querySelector('[data-action="close-daily-search"]')?.removeAttribute("hidden");
        }
        form.hidden = false;
        event.target.closest(".daily-own-toggle")?.setAttribute("hidden", "");
        requestAnimationFrame(() => $("#startQuestionInput")?.focus());
      }
    }
    if (action === "close-daily-search") {
      const homeHero = event.target.closest(".home-hero");
      const form = homeHero?.querySelector("#startQuestionForm");
      if (homeHero && form) {
        form.hidden = true;
        homeHero.querySelector(".home-category-row")?.removeAttribute("hidden");
        homeHero.querySelector('[data-action="open-daily-search"]')?.removeAttribute("hidden");
        event.target.closest(".daily-own-toggle")?.setAttribute("hidden", "");
        homeHeroPaused = false;
        scheduleHomeHeroRotation();
        requestAnimationFrame(() => homeHero.querySelector("[data-home-category].is-active")?.focus());
      }
    }
    if (action === "skip-name") {
      nameProfile = { name: "", declined: true, nameUses: 0, lastNameUsePull: 0 };
      persistNameProfile();
      renderActiveNode(active, { suppressTrack: true, focus: false });
    }
    if (event.target === $("#historyModal")) openHistory(false);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if ($("#historyModal").classList.contains("open")) openHistory(false);
      goHome(true);
    }
    if (event.key === "Escape") {
      if ($("#historyModal").classList.contains("open")) openHistory(false);
      else if ($("#navMenu").classList.contains("open")) setMenuOpen(false);
      else if (document.activeElement === $("#startQuestionInput")) $("#startQuestionInput").blur();
      else if (document.activeElement === $("#followInput")) closeComposer();
    }
    if (event.key === "Tab" && $("#historyModal").classList.contains("open")) {
      const focusable = [...$("#historyModal").querySelectorAll("button:not([disabled]),a[href],input:not([disabled])")]
        .filter((element) => element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!$("#historyModal").contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  addEventListener("pagehide", () => {
    if (session.abandonedTracked || !active) return;
    session.abandonedTracked = true;
    track("path_abandoned", { threadId: active.id, depth: completedNodes(active).length, pulls: session.pulls, zeroTypingAfterStart: session.typedFollowups === 0 });
  });

  const canvas = $("#canvas-bg");
  const context = canvas.getContext("2d");
  function drawGrid() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, innerWidth, innerHeight);
    context.strokeStyle = "rgba(160,140,90,.13)";
    context.lineWidth = 0.5;
    for (let x = 0; x < innerWidth; x += 72) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, innerHeight); context.stroke(); }
    for (let y = 0; y < innerHeight; y += 72) { context.beginPath(); context.moveTo(0, y); context.lineTo(innerWidth, y); context.stroke(); }
  }
  drawGrid();
  addEventListener("resize", drawGrid, { passive: true });

  addEventListener("storage", (event) => {
    if (event.key !== THREADS_KEY || !event.newValue || pendingRequest || active) return;
    try {
      const payload = JSON.parse(event.newValue);
      if (!Array.isArray(payload?.threads)) return;
      const usedIds = new Set();
      state.threads = payload.threads.map((thread, index) => sanitizeThread(thread, index, usedIds)).filter(Boolean);
      refreshCuriosityGraph();
      renderHistory();
      renderSeeds();
    } catch {}
  });

  persistThreads();
  refreshCuriosityGraph();
  reconcileSelectionAwards();
  persistLedger();
  if (RETURNING) markRankingReturn();
  persistCuriosity({ warn: false });
  if (RETURNING) {
    track("meaningful_return", {
      source: previousVisit?.dailyCompletedDay ? "daily" : "organic",
      depth: Math.max(0, ...state.threads.map((thread) => completedNodes(thread).length)),
    });
  }
  renderHistory();
  renderSeeds();
  renderScore();
  show("home");
  void loadDailyWhy();
})();

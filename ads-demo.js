(() => {
  "use strict";

  const SPONSORED_QUERY = "Which car actually fits your life?";

  const CAMPAIGN = Object.freeze({
    id: "cars-qualified-lead-demo-v1",
    advertiser: "Cars.com",
    disclosure: "Sample advertiser · no affiliation",
    bidDollars: 100,
    sponsoredQuery: SPONSORED_QUERY,
    headline: "Find a car that fits your life—not just your feed.",
    copy: "Two quick choices. Then we can find matches built around your actual week.",
    consent: "I agree that a participating dealer may contact me about this request.",
    qualifiers: Object.freeze([
      { name: "vehicle", label: "What fits your week?", options: ["SUV", "Sedan", "Truck", "EV"] },
      { name: "timeline", label: "When are you moving?", options: ["Now", "30 days", "Just looking"] },
    ]),
    fields: Object.freeze([
      { name: "zip", label: "ZIP code", type: "text", inputMode: "numeric", pattern: "[0-9]{5}", placeholder: "90210", required: true },
      { name: "email", label: "Email", type: "email", autocomplete: "email", placeholder: "you@example.com", required: true },
    ]),
  });

  const HOME_CHOICES = Object.freeze([
    { label: "status", query: "Why do people buy more car than they need?", domain: "public" },
    { label: "payment", query: "Why does the monthly payment hide the real price?", domain: "public" },
    { label: "regret", query: "What makes a car feel right before it is?", domain: "personal" },
  ]);

  const DEPTH_TWO = Object.freeze([
    "Why does status beat practicality?",
    "How do dealers anchor the monthly payment?",
    "What predicts buyer's remorse?",
  ]);

  const DEPTH_THREE = Object.freeze([
    "What does depreciation punish first?",
    "Why do safety claims feel personal?",
    "How much does the wrong car really cost?",
  ]);

  const DEPTH_FOUR = Object.freeze([
    "Why do people keep cars they dislike?",
    SPONSORED_QUERY,
    "When should you walk away from a deal?",
  ]);

  const CONTINUE_ONE = Object.freeze([
    "What should you test on a drive?",
    "Which fees deserve a hard no?",
    "When does financing become the trap?",
  ]);

  const CONTINUE_TWO = Object.freeze([
    "Why does road noise matter more than horsepower?",
    "Which dealer add-ons are mostly margin?",
    "When does a longer loan become more expensive?",
  ]);

  const CONTINUE_THREE = Object.freeze([
    "What does parking reveal about daily fit?",
    "Who profits when buyers fear walking away?",
    "How do warranties hide future costs?",
  ]);

  const ANSWERS = new Map([
    ["why do people buy more car than they need?", "a car is transportation wearing a social costume. people often buy for the person they want strangers to see, then spend years financing the performance."],
    ["why does the monthly payment hide the real price?", "the monthly number shrinks the pain by stretching time. a manageable payment can quietly conceal a longer loan, more interest and a car that costs far more."],
    ["what makes a car feel right before it is?", "the first drive is theatre: clean cabin, instant acceleration, zero groceries and no parking headache. real compatibility usually appears after the showroom spell wears off."],
    ["why does status beat practicality?", "status pays immediately; practicality pays slowly. the badge gets noticed tonight, while repair costs, cramped parking and depreciation wait until the applause is gone."],
    ["how do dealers anchor the monthly payment?", "once the conversation centers on one monthly number, price, rate and loan length become movable scenery. the payment stays familiar while the total cost walks away."],
    ["what predicts buyer's remorse?", "regret usually begins where fantasy met routine: the commute was longer, the payment tighter, the cargo smaller and the supposedly exciting car became another obligation."],
    ["what does depreciation punish first?", "depreciation punishes novelty. the moment a new car becomes yesterday's model, buyers stop paying for untouched possibility and start pricing mileage, demand and future repairs."],
    ["why do safety claims feel personal?", "safety marketing rarely sells crash data alone. it sells relief from imagining your family in danger, which makes a feature list feel like a moral decision."],
    ["how much does the wrong car really cost?", "the sticker is only admission. insurance, fuel, financing, depreciation and repairs keep charging after the excitement leaves—often turning a small mismatch into an expensive roommate."],
    ["why do people keep cars they dislike?", "selling forces the mistake into the open. keeping it lets the owner call the payment temporary, protect the original decision and postpone the awkward math."],
    ["which car actually fits your life?", "your best car is not the loudest option. it is the one that survives your actual week: commute, parking, passengers, payment and the day the warranty runs out."],
    ["when should you walk away from a deal?", "walk when the numbers only work after urgency, mystery fees or a longer loan. a good car does not need bad arithmetic and a ticking clock."],
    ["what should you test on a drive?", "test the boring parts: visibility, parking, seat comfort, phone pairing and road noise. ten quiet annoyances will outlive one dramatic acceleration pull."],
    ["which fees deserve a hard no?", "question every fee that does not change the car or satisfy the government. vague protection packages and dealer add-ons often exist because confusion has excellent margins."],
    ["when does financing become the trap?", "financing becomes the trap when affordability depends on extending the loan beyond the car's dependable years. the payment looks smaller while the risk compounds."],
    ["why does road noise matter more than horsepower?", "horsepower performs for ten seconds. road noise rides with you for ten years, turning every commute, phone call and quiet moment into a small daily tax."],
    ["which dealer add-ons are mostly margin?", "paint coatings, nitrogen tires and vague protection bundles often carry more dealer margin than customer value. the name sounds technical; the invoice does the real work."],
    ["when does a longer loan become more expensive?", "a longer loan lowers today's payment by renting money for more years. interest grows while the car depreciates, leaving the owner paying after the excitement—and sometimes the warranty—expires."],
    ["what does parking reveal about daily fit?", "parking exposes the life a test drive hides. width, visibility and turning radius matter more on a crowded Tuesday than they ever will under showroom lights."],
    ["who profits when buyers fear walking away?", "the seller does. urgency makes comparison feel dangerous, so mystery fees and weak financing survive because leaving now feels more costly than regretting later."],
    ["how do warranties hide future costs?", "a warranty can make risk feel solved while exclusions, deductibles and expiration dates push expensive repairs back onto the owner. protection is only real where the fine print agrees."],
  ]);

  const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[.!]+$/g, "");

  const stageFor = (query) => {
    const normalized = normalize(query);
    if (HOME_CHOICES.some((choice) => normalize(choice.query) === normalized)) return DEPTH_TWO;
    if (DEPTH_TWO.some((candidate) => normalize(candidate) === normalized)) return DEPTH_THREE;
    if (DEPTH_THREE.some((candidate) => normalize(candidate) === normalized)) return DEPTH_FOUR;
    if (DEPTH_FOUR.some((candidate) => normalize(candidate) === normalized)) return CONTINUE_ONE;
    if (CONTINUE_ONE.some((candidate) => normalize(candidate) === normalized)) return CONTINUE_TWO;
    if (CONTINUE_TWO.some((candidate) => normalize(candidate) === normalized)) return CONTINUE_THREE;
    return CONTINUE_ONE;
  };

  const answer = ({ query = "", domain = "public" } = {}) => {
    const normalized = normalize(query);
    const matchedAnswer = ANSWERS.get(normalized + "?") || ANSWERS.get(normalized) || ANSWERS.get(normalize(HOME_CHOICES[0].query));
    const next = stageFor(query);
    const roles = ["deepen", "contradiction", "consequence"];
    return {
      answer: matchedAnswer,
      voiceNote: {
        domain,
        prompt: "three automotive paths",
        copyStyle: "question_v2",
        pulls: next.map((question, index) => ({
          role: roles[index],
          heat: index === 1 ? 9 : 7,
          label: question,
          query: question,
          grounding: "off",
        })),
      },
      domain,
      sources: [],
      receiptsAvailable: false,
      preview: false,
      grounding: "off",
      groundingStatus: "offline_ads_demo",
      elapsedMs: 120,
    };
  };

  const appendText = (parent, tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  };

  const buildChoiceField = (field) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "ads-choice-field";
    const legend = appendText(fieldset, "legend", "", field.label);
    legend.id = "ads-demo-" + field.name + "-label";
    const options = document.createElement("div");
    options.className = "ads-choice-row";
    for (const value of field.options) {
      const choice = document.createElement("label");
      choice.className = "ads-choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = field.name;
      input.value = value;
      input.required = true;
      input.setAttribute("aria-label", value);
      const copy = appendText(choice, "span", "", value);
      copy.setAttribute("aria-hidden", "true");
      choice.append(input);
      choice.append(copy);
      options.append(choice);
    }
    fieldset.append(options);
    return fieldset;
  };

  const buildField = (field) => {
    const wrapper = document.createElement("div");
    wrapper.className = "ads-field";
    const id = "ads-demo-" + field.name;
    const label = appendText(wrapper, "label", "", field.label);
    label.htmlFor = id;
    const control = document.createElement("input");
    control.type = field.type;
    if (field.inputMode) control.inputMode = field.inputMode;
    if (field.pattern) control.pattern = field.pattern;
    if (field.placeholder) control.placeholder = field.placeholder;
    if (field.autocomplete) control.autocomplete = field.autocomplete;
    control.id = id;
    control.name = field.name;
    control.required = field.required;
    wrapper.append(control);
    return wrapper;
  };

  const renderLeadCard = (root) => {
    if (!root || root.querySelector("[data-ads-lead-card]")) return;
    const answerSection = root.querySelector(".node-answer");
    if (!answerSection) return;

    const card = document.createElement("section");
    card.className = "ads-lead-card";
    card.dataset.adsLeadCard = CAMPAIGN.id;
    card.setAttribute("aria-labelledby", "adsLeadTitle");

    const eyebrow = document.createElement("div");
    eyebrow.className = "ads-lead-eyebrow";
    appendText(eyebrow, "span", "", "Sponsored · " + CAMPAIGN.advertiser + " example");
    appendText(eyebrow, "span", "ads-lead-bid", "$" + CAMPAIGN.bidDollars + " qualified-lead bid");
    card.append(eyebrow);

    const title = appendText(card, "h2", "", CAMPAIGN.headline);
    title.id = "adsLeadTitle";
    appendText(card, "p", "ads-lead-copy", CAMPAIGN.copy);

    const form = document.createElement("form");
    form.className = "ads-lead-form";
    form.dataset.adsLeadForm = CAMPAIGN.id;
    form.autocomplete = "off";
    for (const field of CAMPAIGN.qualifiers) form.append(buildChoiceField(field));

    const contactStep = document.createElement("div");
    contactStep.className = "ads-contact-step";
    contactStep.hidden = true;
    appendText(contactStep, "p", "ads-contact-prompt", "Where should the matches land?");
    const contactFields = document.createElement("div");
    contactFields.className = "ads-contact-fields";
    for (const field of CAMPAIGN.fields) contactFields.append(buildField(field));
    contactStep.append(contactFields);

    const consent = document.createElement("label");
    consent.className = "ads-consent";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "contactConsent";
    checkbox.required = true;
    consent.append(checkbox, document.createTextNode(CAMPAIGN.consent));
    contactStep.append(consent);

    const submit = appendText(contactStep, "button", "ads-lead-submit", "Show my matches");
    submit.type = "submit";
    appendText(contactStep, "p", "ads-lead-fineprint", CAMPAIGN.disclosure + ". Investor demo only. Nothing entered here is transmitted or retained.");
    form.append(contactStep);

    const revealContactStep = () => {
      const ready = CAMPAIGN.qualifiers.every((field) => form.querySelector(`input[name="${field.name}"]:checked`));
      contactStep.hidden = !ready;
      contactStep.setAttribute("aria-hidden", String(!ready));
    };
    form.addEventListener("change", revealContactStep);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const success = document.createElement("div");
      success.className = "ads-lead-success";
      success.setAttribute("role", "status");
      const strong = document.createElement("strong");
      strong.textContent = "You're set.";
      success.append(strong, document.createTextNode(" In production, this opt-in would trigger the advertiser's $" + CAMPAIGN.bidDollars + " bid. Keep following the path."));
      form.replaceWith(success);
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("why:ads-lead-complete", {
          detail: { campaignId: CAMPAIGN.id },
        }));
      }, 320);
    });

    card.append(form);
    answerSection.append(card);
  };

  const decorate = ({ root, query } = {}) => {
    if (!root) return;
    const sponsoredQuery = normalize(CAMPAIGN.sponsoredQuery);
    for (const button of root.querySelectorAll(".curiosity-door")) {
      if (normalize(button.dataset.query) !== sponsoredQuery) continue;
      button.classList.add("is-sponsored");
      button.dataset.sponsored = "true";
      button.setAttribute("aria-label", "Sponsored by sample advertiser " + CAMPAIGN.advertiser + ": " + CAMPAIGN.sponsoredQuery);
      if (!button.querySelector(".ads-sponsor-tag")) {
        const tag = document.createElement("small");
        tag.className = "ads-sponsor-tag";
        tag.textContent = "Sponsored";
        const question = button.querySelector(":scope > span");
        if (question) question.after(tag);
        else button.append(tag);
      }
    }
    const sponsoredAnswer = normalize(query) === sponsoredQuery;
    const followForm = document.querySelector("#followForm");
    if (sponsoredAnswer) {
      root.querySelector(".node-answer > .prose")?.setAttribute("hidden", "");
      root.querySelector(".door-zone")?.setAttribute("hidden", "");
      root.querySelector(".name-ritual")?.remove();
      followForm?.setAttribute("hidden", "");
      renderLeadCard(root);
    } else {
      followForm?.removeAttribute("hidden");
    }
  };

  window.WHY_ADS_DEMO = Object.freeze({
    greeting: "Why do people buy the wrong car?",
    homeChoices: HOME_CHOICES,
    campaign: CAMPAIGN,
    answer,
    decorate,
  });
})();

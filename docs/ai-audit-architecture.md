# AI audit architecture - labeled triples + expert feedback (RLEF)

AdBrain is built as an **audit-first decision system**. Every recommendation the app makes is
logged as a **labeled training triple**: `(situation, expert judgment, outcome)`.

- **Situation (input):** a snapshot of the real inputs at decision time - the ad's day-wise
  metrics, objective score, fatigue read, and the exact rule/formula that produced the
  recommendation.
- **Expert judgment (label):** what the operator does with the recommendation - approve,
  dismiss, or modify. This is the human preference label (the RLEF signal - reinforcement
  learning from EXPERT feedback, expert operators rather than crowdsourced raters).
- **Outcome:** the downstream result measured later (did the metric actually move after the
  action was taken).

This makes the whole app auditable and is the moat: no number or recommendation is ever shown
that cannot be traced back to its inputs and formula (the biggest rule), and every operator
decision becomes expert-labeled training data - the RLEF baseline. Our data is
`(input, expert judgment, outcome)`, not the self-referential `(input, autonomous action,
outcome)` of fully-autonomous tools.

## What this means for the build
1. **A `decision_triples` store.** Every recommendation writes the situation snapshot + the
   recommendation (action + confidence + the rule/rubric id that produced it) + timestamp. The
   operator's approve / dismiss / modify writes the preference label. A later job writes the
   measured outcome once enough time has passed.
2. **Explainability is the situation half.** The "Why this score?" layer + the rubric registry
   (`lib/scoring/rubrics.ts`) already expose the situation + formula for every number, so each
   triple's input is fully reconstructable.
3. **Reward model / RLEF layer (post-collection).** Once triples accumulate, a reward model
   learns the operator's preferences from them and can score decisions at machine scale - an
   encoded version of expert judgment. This is a post-data-collection priority, not day one.

## Applied now
- Every score is rule/formula-derived and explainable (no assumed numbers).
- Recommendations carry the rule that produced them (rubric id + why-list).
- Next: the `decision_triples` table + capturing operator approve/dismiss/modify as labels.

---

## Reference vocabulary (sanitized source)
 AdBrain 
 AI vocabulary, concepts, and internal audit — for the team 
 
 The AI-native vocabulary 
 every founder and operator on this team must own. 
 This is not for the pitch alone. This is what the AdBrain team needs to internalize because we are building an AI-native company and investors, customers, and technical hires will test whether we understand what we&apos;re doing. 
 Structure: (1) fourteen vocabulary terms across four categories with plain-English definitions, why each matters, how to use them in a meeting, and what to avoid saying; (2) a self-audit — questions to ask ourselves internally about which of these concepts we&apos;re already deploying and which we should; (3) learning resources by time commitment. 
 Everyone with an investor-facing role should read this in full. The technical leadership should verify the technical claims. The founder and anyone else customer-facing should be able to defend every term without help. 
 
 Part 1 — The vocabulary 
 Fourteen terms across four categories. The first three categories are essential for turn-one investor conversations; the fourth is for deeper technical DD. Every one of these will come up in a Bessemer, Peak XV, or Point Nine partner meeting. Master all fourteen, at least conceptually. 
 Category A — The data foundation 
 These four terms describe how AI systems learn from data. If you understand these, you can defend the moat argument. 
 Labeled training triples 
 PLAIN ENGLISH 
 A data record with three components: (input, action, outcome). For AdBrain: (marketing situation observed, decision the operator made, downstream result). &quot;Labeled&quot; means each record has a human-verified correct answer, not just a raw observation. Labeled data is 10-100x more valuable than unlabeled data for training decision-making AI systems. 
 WHY IT MATTERS FOR AdBrain 
 Every human decision on every AdBrain recommendation becomes a labeled training triple. After 12 months × 25 clients, that&apos;s 50,000+ triples. This is the dataset autonomous competitors like Ploy cannot bootstrap because they threw away the human — they only have (input, autonomous action, outcome) which is self-referential and noisy. Ours is (input, expert judgment, outcome) which is what fine-tunes decision-making models. 
 USAGE IN A MEETING 
 &quot;We&apos;re doing supervised learning on labeled triples of expert judgment — the same data structure that makes Anthropic&apos;s Claude and OpenAI&apos;s GPT models work. Autonomous tools have noisy self-labeled data. We have expert-labeled data. It&apos;s the difference between learning from a rookie&apos;s guesses and learning from a master&apos;s decisions.&quot; 
 WATCH OUT 
 Don&apos;t confuse triples with tuples. Triples specifically refer to the (situation, action, outcome) record structure. Also don&apos;t over-claim scale: 50,000 triples is small compared to LLM training data but categorically different because of label quality. 
 RLHF (Reinforcement Learning from Human Feedback) 
 PLAIN ENGLISH 
 The training technique that turned raw language models (GPT-3, base Claude) into aligned, useful products (ChatGPT, Claude). It works in three stages: (1) show a model multiple candidate answers to the same prompt, (2) have humans pick which answer is better, (3) train a reward model on those preferences that teaches the main model to produce answers humans actually want. Every frontier LLM in 2026 uses RLHF or its variants. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain is doing RLHF for marketing operations. Skilled operators approve/dismiss/modify our recommendations. Each judgment is a preference label. This is architecturally identical to how Anthropic and OpenAI train their models — the only difference is our labels come from expert marketing operators, not crowdsourced workers. When a Bessemer partner hears &quot;we&apos;re doing RLHF for marketing,&quot; they map us to the pattern of the AI companies they respect most. 
 USAGE IN A MEETING 
 &quot;We&apos;re applying the RLHF pattern that made Claude and GPT-4 possible to marketing operations. Every skilled operator judgment on every AdBrain recommendation is a labeled preference — &apos;this is what a good decision looks like in this situation.&apos; It&apos;s the same architectural pattern the frontier labs use to align their models. Ours are expert labels, not crowdsourced.&quot; 
 WATCH OUT 
 Follow-up traps: if asked about proximal policy optimization (PPO), direct preference optimization (DPO), or constitutional AI, do not bluff. Say &quot;that&apos;s for our technical leadership, I&apos;ll bring them in.&quot; Founders who bluff on RLHF internals get exposed brutally. 
 Reward model 
 PLAIN ENGLISH 
 A separate, smaller AI model whose only job is to predict what score a human would give to a given output. In RLHF, the reward model is trained on human preference data, and then used to guide the main model&apos;s training. Think of it as an automated stand-in for a human rater, scaled to millions of outputs. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain&apos;s reward model would learn to predict what a skilled marketing operator would judge as a good recommendation vs. a bad one. Over time, this reward model becomes an encoded version of operator expertise — and it can score decisions at machine scale, which no human can do. The operator does not need to review every action forever; the reward model captures their judgment and applies it. 
 USAGE IN A MEETING 
 &quot;The reward model is the intellectual property that compounds. Every operator judgment we log improves it. Autonomous tools have no reward model of expertise — they have only outcome-based reward, which is thin and lagging. Ours is expertise-based reward, which is dense and immediate.&quot; 
 WATCH OUT 
 If asked whether we&apos;ve trained one yet, be honest. Most seed-stage AI companies are in the data-collection phase, not the reward-model training phase. &quot;We are capturing the preference data now; reward model training is our post-seed technical priority&quot; is a defensible answer. 
 Fine-tuning 
 PLAIN ENGLISH 
 Taking a large pre-trained model (Claude, GPT-4, Llama, etc.) and continuing to train it on a smaller, specific dataset to make it perform better in a particular domain. Fine-tuning is much cheaper and faster than pre-training a model from scratch — thousands of dollars vs. tens of millions. It&apos;s how most vertical AI companies actually build their models. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain does not need to pre-train a foundation model — that&apos;s Anthropic and OpenAI&apos;s job. What we do is fine-tune existing frontier models on our proprietary triples dataset. This is the standard vertical AI playbook: use general capability from the frontier labs, add domain-specific expertise via fine-tuning on data no one else has. Our fine-tuning dataset is what makes AdBrain outperform generic AI in D2C marketing decisions. 
 USAGE IN A MEETING 
 &quot;We&apos;re not training a model from scratch — that&apos;s a bad use of capital for a vertical AI company. We&apos;re fine-tuning frontier models on the D2C marketing decision dataset we&apos;re building. As frontier models improve every 6-9 months, our fine-tuned AdBrain models improve with them. The moat is the dataset, not the model architecture.&quot; 
 WATCH OUT 
 Don&apos;t confuse fine-tuning with pre-training. Pre-training is what OpenAI does. Fine-tuning is what we do on top. Investors who ask &quot;why don&apos;t you have your own foundation model?&quot; are asking the wrong question — the right answer is &quot;we shouldn&apos;t, and neither should any vertical AI company.&quot; 
 Category B — The system architecture 
 These three terms describe how AI systems are structured. If you understand these, you can defend the technical architecture. 
 Agentic AI / AI agents 
 PLAIN ENGLISH 
 AI systems that don&apos;t just answer questions — they take actions in the world. An agent can: read data from a source, decide what to do, execute the action, observe the result, and adjust. Agentic systems combine reasoning (LLM), tool use (calling APIs), memory (persistent context), and planning (multi-step workflows). Every serious AI product in 2026 is moving toward agentic patterns because pure Q&amp;A hit its ceiling. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain&apos;s KAM (Key Account Manager) agent is a real agentic system. It fetches data from Meta Ads API, Google Analytics, Shopify, etc. It reasons across signals. It surfaces recommendations. It queues actions. It observes outcomes. That&apos;s agentic behavior. The four-track architecture (attribution, analytics, action, audit) is unified under one agent, not four separate scripts. 
 USAGE IN A MEETING 
 &quot;AdBrain is not a chatbot that talks about marketing. It&apos;s an agentic system that operates a marketing account. It reads across 15 data sources, reasons across 257 parameters, surfaces recommendations with reasoning traces, and executes approved actions in the platforms directly. Voice is one interface. The agent is the product.&quot; 
 WATCH OUT 
 Agentic AI is a legitimate technical claim but it&apos;s also the most abused term in AI marketing in 2026 — everyone claims it, most just wrap GPT-4 in a UI. Be ready to defend specifics: what tools do you actually call, what memory system do you actually use, how do you handle multi-step planning. 
 Human-in-the-loop (HITL) / Expert-in-the-loop 
 PLAIN ENGLISH 
 System architecture where an AI produces recommendations or partial actions, but a human validates/approves them before final execution. &quot;Expert-in-the-loop&quot; is the more sophisticated variant — the human is specifically a domain expert whose judgment is captured as training signal (RLHF). Waymo&apos;s safety drivers, Cursor&apos;s tab-to-accept, and Anthropic&apos;s constitutional AI reviewers are all HITL patterns. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain is expert-in-the-loop by design, not by limitation. Every recommendation surfaces with confidence, evidence, and money at stake. A skilled operator approves, dismisses, or modifies. This is not a compromise — it&apos;s the mechanism that captures operator judgment as labeled training data. Ploy skipped this and cannot bootstrap the dataset. We didn&apos;t, so we can. 
 USAGE IN A MEETING 
 &quot;We&apos;re not human-in-loop because the AI can&apos;t decide. We&apos;re expert-in-loop because operator judgment is the training signal we need. This is Waymo&apos;s safety-driver playbook applied to marketing operations. Safety drivers weren&apos;t a Waymo limitation — they were the mechanism to collect the training data that made autonomy possible. Same for us.&quot; 
 WATCH OUT 
 Do not say &quot;human-in-loop for accountability&quot; or &quot;for compliance.&quot; These trigger regulated-industry framing that kills AI valuations. Say &quot;expert-in-loop for training signal&quot; or &quot;operator judgment as data.&quot; 
 Multi-agent systems 
 PLAIN ENGLISH 
 Architectures where multiple AI agents work together on a task — one might plan, another might execute, another might verify. Cognition (Devin) has argued single-agent is more reliable in most cases. Anthropic has shown multi-agent works for research tasks that parallelize well. The truth is domain-specific: multi-agent excels when tasks are parallel and independent, single-agent excels when decisions are coupled. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain&apos;s architecture has hierarchical agents but most of what looks like agents are actually deterministic workflows. The real LLM-reasoning agents are the KAM, a small number of platform orchestrators, and a small number of channel-level reasoners. The 600+ &quot;task workflows&quot; beneath are typed functions with contracts, not autonomous agents. This distinction matters because it explains how we avoid the error-cascade problem that kills naive multi-agent systems. 
 USAGE IN A MEETING 
 &quot;Our architecture is hierarchical with ~50 LLM-reasoning nodes at the top and deterministic typed workflows underneath. This avoids the multi-agent failure modes documented in the UC Berkeley MAST paper — error cascades from 700 unreliable agents in a chain. Our LLM agents make coupled decisions at the strategic level; our workflows execute those decisions deterministically at the tactical level.&quot; 
 WATCH OUT 
 Don&apos;t say &quot;700 agents&quot; without qualifying. The Berkeley MAST paper showed 41-86% failure rates on naive multi-agent systems. Sophisticated VCs know this. Say &quot;~50 reasoning agents plus deterministic workflows&quot; — it shows you know the literature. 
 Category C — The safety and evaluation vocabulary 
 These three terms describe how AI systems are made trustworthy. If you understand these, you can defend the epistemic honesty of the product. 
 Hallucination 
 PLAIN ENGLISH 
 When an AI system generates output that sounds plausible but is factually wrong or unsupported by its data. Every LLM hallucinates to some degree. In marketing AI, hallucinations look like: recommending an action that isn&apos;t backed by data, citing a metric that doesn&apos;t exist, or confidently making a claim the data doesn&apos;t support. Hallucination is the #1 reason enterprise AI deployments fail. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain&apos;s design is explicitly anti-hallucination. The canvas UI&apos;s &quot;why this score&quot; panel with fetch/formula/logic/example/next step is a hallucination-prevention pattern — every claim has to trace back to specific data. The product actively refuses to make claims it can&apos;t back (&quot;We did not claim audience saturation — audience_saturation withheld&quot; from the transcript). This epistemic honesty is a technical achievement, not a UX feature. 
 USAGE IN A MEETING 
 &quot;Every AI marketing tool hallucinates confidently. AdBrain refuses to. Every recommendation traces back to the specific data that supports it — fetch, formula, logic, example, next step. When the data doesn&apos;t support a claim, we withhold it rather than manufacture confidence. This is what &quot;regulatory-grade transparency at the UI layer&quot; actually means in practice.&quot; 
 WATCH OUT 
 If a partner asks for a live demo, they may try to prompt AdBrain into a hallucination. Have the engineering team test this internally first — what happens when a user asks about a client account that has no data, or asks a question the system doesn&apos;t have the tools to answer. The correct behavior is graceful refusal, not confident nonsense. 
 Alignment 
 PLAIN ENGLISH 
 Making sure an AI system does what the user actually wants, not just what its literal instructions say. &quot;Aligned&quot; AI produces outputs that match human values, preferences, and intent — even when those aren&apos;t fully specified. Alignment is what RLHF is designed to achieve. Frontier AI labs (Anthropic especially) treat alignment as a first-order technical problem, not a compliance afterthought. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain is being aligned to what skilled marketing operators actually want, not what a naive optimization would produce. A pure ROAS-maximizer might spend all budget on retargeting warm audiences — technically &quot;optimal&quot; but strategically stupid because it burns future demand. An aligned system captures the judgment that says &quot;here we optimize for ROAS, here we optimize for share of voice, here we optimize for cohort quality.&quot; That&apos;s what operator judgment triples encode. 
 USAGE IN A MEETING 
 &quot;Alignment is the technical problem we&apos;re solving that nobody else is. Ploy is aligned to &quot;maximize the metric.&quot; We&apos;re aligned to &quot;what a skilled operator would do given the whole picture.&quot; Different problem, harder problem, higher-value problem. It&apos;s the same technical challenge Anthropic solves at the language level, applied to decision-making at the marketing-operations level.&quot; 
 WATCH OUT 
 Alignment is a legitimate technical term but also a fashionable one. Don&apos;t overuse it — say it once with meaning, don&apos;t sprinkle it. If you say &quot;our alignment approach&quot; three times in a meeting, sophisticated VCs will smell buzzword-stacking. 
 Evals (evaluations) 
 PLAIN ENGLISH 
 Systematic tests that measure how well an AI system performs on specific tasks. &quot;Evals&quot; are the AI-native equivalent of unit tests + integration tests + regression tests. Every serious AI company runs continuous evals to catch performance regression when models are updated. Anthropic, OpenAI, and Google DeepMind all publish and maintain public eval benchmarks. In vertical AI, evals are often proprietary to the domain. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain needs a proprietary evals suite specifically for marketing decisions: given this situation, did the recommendation match what an expert operator would have chosen? Did the reasoning trace hold up? Did the action produce the predicted outcome? This is for the engineering leadership to build, but it&apos;s what separates a serious AI company from a demo — evals let us know if the model is getting better or worse over time. 
 USAGE IN A MEETING 
 &quot;We maintain a proprietary evals suite for marketing operations decisions. When we update the underlying model or the reasoning pipeline, we can measure whether recommendation quality improved or regressed. This is standard practice for serious AI teams and it&apos;s what lets us ship model updates with confidence rather than fear.&quot; 
 WATCH OUT 
 If asked about evals and we don&apos;t have them yet, don&apos;t bluff. &quot;Building our evals infrastructure is a Q1 post-seed priority — right now we validate manually with operators, which works at our current scale but won&apos;t at 100+ clients&quot; is a defensible answer for a seed-stage company. 
 Category D — Advanced training and deployment techniques 
 These four terms are the deeper technical vocabulary. The team already deploys RAG for memory. The others show up when a partner or DD analyst wants to test technical sophistication. Not for turn-one pitching — for turn-three depth conversations. 
 RAG (Retrieval-Augmented Generation) 
 PLAIN ENGLISH 
 An architecture where an AI system, before generating a response, first retrieves relevant information from an external source — a database, a document store, a vector index — and uses that information to inform its output. Instead of relying only on what the model learned during training, RAG lets the system stay current and grounded in facts specific to the domain or the user. Every serious enterprise AI product in 2026 uses some form of RAG. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain uses RAG for memory. When the KAM agent responds to a query about a specific brand, it retrieves that brand&apos;s history — past campaigns, decisions, outcomes, brand-specific patterns — from our memory store, then reasons over that retrieved context. This is what makes AdBrain feel like it &quot;knows&quot; the brand rather than answering generically. It&apos;s also why AdBrain&apos;s answers get better the longer a client has been on the platform: more retrievable context. 
 USAGE IN A MEETING 
 &quot;We use RAG for memory. The KAM agent retrieves brand-specific history, decision patterns, and past outcomes from our memory store before every response, so it reasons over what actually happened with this brand, not just what&apos;s plausible in the abstract. As clients stay with us, the retrievable context compounds and recommendations get sharper.&quot; 
 WATCH OUT 
 RAG is table stakes now — every AI product claims it. What matters is the specifics: what&apos;s in the retrieval index, how it&apos;s chunked and embedded, how retrieval quality is measured, whether the system uses hybrid retrieval (semantic + keyword). If a DD analyst asks these, the technical leadership should be fluent. 
 DPO (Direct Preference Optimization) 
 PLAIN ENGLISH 
 A newer alternative to RLHF that&apos;s simpler and often works just as well. Instead of training a separate reward model and then using reinforcement learning to optimize the main model (the classical RLHF pipeline), DPO trains the main model directly on preference pairs — &quot;answer A was preferred over answer B&quot; — using a mathematical trick that skips the reward model entirely. Introduced in 2023, DPO has become the default choice for many alignment workloads because it&apos;s faster to train, cheaper to run, and more stable than PPO-based RLHF. 
 WHY IT MATTERS FOR AdBrain 
 For AdBrain, DPO is likely a better fit than classical RLHF because our dataset is preference pairs by nature — operators approve one recommendation over another, or modify a recommendation into a different version. DPO trains directly on these preference pairs without needing to build a separate reward model. This lets us iterate faster on model quality with less infrastructure investment. 
 USAGE IN A MEETING 
 &quot;We&apos;re likely to use DPO rather than classical RLHF for our judgment layer. Our data is naturally preference-shaped — operators approve, dismiss, or modify recommendations — which is exactly what DPO trains on. It gives us better sample efficiency and skips the reward model overhead, which matters at our dataset scale.&quot; 
 WATCH OUT 
 Only claim DPO if the technical leadership has actually made the architectural choice. If we haven&apos;t committed to a training approach yet, the correct answer is &quot;we&apos;re evaluating DPO vs. classical RLHF for our judgment layer — the preference-pair structure of our data suggests DPO but we&apos;re testing empirically.&quot; 
 PPO (Proximal Policy Optimization) 
 PLAIN ENGLISH 
 The reinforcement learning algorithm that powers classical RLHF. When OpenAI trained InstructGPT (which became ChatGPT), PPO was the algorithm that used the reward model&apos;s signal to update the language model&apos;s weights. It&apos;s a policy-gradient method with a specific trick — the &quot;proximal&quot; part — that prevents each training update from moving the model too far in one step, which keeps training stable. PPO is the reason RLHF works in practice, not just in theory. 
 WHY IT MATTERS FOR AdBrain 
 AdBrain does not need to implement PPO ourselves — it&apos;s a foundational algorithm used inside RLHF pipelines that our infrastructure providers (or open-source libraries like TRL from Hugging Face) handle. What matters is knowing the term because DD analysts will use it as a shibboleth to check whether we understand the RLHF stack. 
 USAGE IN A MEETING 
 &quot;If we go the classical RLHF route rather than DPO, PPO is the underlying algorithm. In practice we&apos;d use standard implementations from Hugging Face TRL or similar rather than implementing it ourselves — the algorithm is well-understood, the infrastructure is the interesting part.&quot; 
 WATCH OUT 
 Don&apos;t over-claim PPO expertise unless the technical leadership genuinely has it. The correct posture is: &quot;we understand what PPO does architecturally; production implementation would use standard libraries; our differentiation is in the training data, not in the RL algorithm.&quot; 
 Model distillation 
 PLAIN ENGLISH 
 Training a smaller, cheaper, faster model to imitate the behavior of a larger, more expensive one. The small model (&quot;student&quot;) learns from the large model&apos;s outputs (&quot;teacher&quot;), producing a compressed version that captures most of the capability at a fraction of the cost. Distillation is how frontier labs turn their giant research models into deployable products, and how enterprises turn expensive API calls into cheap local inference. It&apos;s foundational to the AI production stack. 
 WHY IT MATTERS FOR AdBrain 
 For AdBrain specifically, distillation matters for two reasons. First, our unit economics depend on inference cost — if every recommendation costs $0.50 in API fees, gross margins collapse. Distilling frequent-path reasoning to smaller, cheaper models is how we get from 45% to 75% gross margin (the trajectory on our financial model slide). Second, distillation is how we protect proprietary judgment — we can distill from frontier models we access via API into smaller models that run on our infrastructure, preserving the capability without paying the API tax forever. 
 USAGE IN A MEETING 
 &quot;Model distillation is our margin path. As we scale, frequent-path reasoning gets distilled from frontier models into smaller, cheaper models we run on our own infrastructure. This is standard practice for vertical AI companies moving from prototype to production economics — and it&apos;s why our gross margin trajectory goes from 45% to 75%.&quot; 
 WATCH OUT 
 Distillation is a real technical claim with real infrastructure implications. If a DD analyst asks about our distillation approach and we haven&apos;t done any, don&apos;t bluff. &quot;We&apos;re using frontier models via API today for maximum quality; distillation is on our roadmap for the cost curve we&apos;ve committed to in the financial model&quot; is a defensible answer for a seed-stage company. 
 
 Part 2 — Self-audit for the team 
 Fifteen questions to answer internally. These are what a Bessemer partner or their DD analyst will actually ask. Answer them cleanly for ourselves first — if the answer is &quot;we don&apos;t know&quot; or &quot;we haven&apos;t done that yet,&quot; that&apos;s fine, but we need to know it internally before the meeting. 
 The technical leadership owns the technical answers. The founder owns the strategic ones. Whoever handles investor conversations needs to know all of them. 
 On our data and dataset 
 Q1. How many labeled training triples do we have today, and how many are we generating per day? 
 This is the first number a technical DD analyst will ask for. Have the count. If it&apos;s 500, say 500. If it&apos;s 5,000, say 5,000. If we&apos;re not systematically capturing them yet, that&apos;s a red flag we need to fix immediately — the entire moat argument depends on this being real. 
 Q2. Where and how are the triples stored? What&apos;s the schema? 
 A triple is technically a database row. What&apos;s in the row? Situation vector (what fields?), action taken (structured how?), outcome (measured how, at what lag?). If the engineering team can&apos;t produce a schema in 15 minutes, the data isn&apos;t as structured as we claim. 
 Q3. What percentage of operator judgments are actually captured vs. lost? 
 If operators sometimes just take actions in the platform directly without going through AdBrain&apos;s approve/dismiss flow, those judgments are lost as training data. We need to know the capture rate. If it&apos;s below 70%, we have a product problem to fix before pitching the dataset moat. 
 Q4. How do we handle operator judgments that turned out to be wrong? 
 A recommended action gets approved by the operator, but 14 days later the outcome shows it was the wrong call. Do we capture that? Do we weight the triple down? This is the difference between naive supervised learning and calibrated expert judgment. The engineering team should have an answer. 
 On our model architecture 
 Q5. Which foundation model(s) are we using, and why? 
 Claude, GPT-4, Llama, Gemini? Are we using different models for different tasks (Claude for reasoning, GPT-4 for structured output, etc.)? Are we fine-tuning any of them yet, or just prompting? If we&apos;re not fine-tuning yet, when will we start? This is a basic technical question and the answer signals sophistication. 
 Q6. Have we built a reward model, or are we in the data-collection phase? 
 Most seed-stage AI companies are in data collection, not reward model training. That&apos;s fine. But we need to know which phase we&apos;re in and have a roadmap for when we transition. If the answer is &quot;we haven&apos;t thought about this,&quot; that&apos;s a gap the technical leadership needs to close. 
 Q7. What&apos;s our evals suite? How do we know if the system is getting better or worse? 
 If we push a model update or change a prompt, how do we measure whether recommendation quality changed? If we don&apos;t have this today, we need to have a plan for it. Investors will not ask this on turn one, but they will ask on turn three or four when the technical DD begins. 
 Q8. What&apos;s in our RAG index, and how do we measure retrieval quality? 
 We already use RAG for memory — that&apos;s genuinely a strength. But retrieval quality is a real engineering discipline. What&apos;s chunked and how? What embedding model? Hybrid retrieval or pure semantic? How do we measure whether the right context was retrieved for a given query? If a DD analyst asks and we can only answer &quot;we use RAG,&quot; that&apos;s shallow. Have specifics. 
 Q9. Have we chosen between DPO and classical RLHF for our judgment layer, and why? 
 Our preference-pair data is naturally shaped for DPO. If we&apos;ve made this choice deliberately, be able to explain why. If we haven&apos;t chosen yet, the correct answer is &quot;we&apos;re evaluating empirically — DPO&apos;s sample efficiency and infrastructure simplicity are attractive at our scale, but we&apos;re validating on our specific dataset before committing.&quot; Either answer is defensible; &quot;we haven&apos;t thought about it&quot; is not. 
 Q10. What&apos;s our model distillation plan? At what customer scale does inference cost start to compress margins? 
 This connects directly to the gross margin trajectory on the financial slide (45% → 65% → 75%). Distillation is how that curve happens in practice. Do we have a target: at what customer count or ARR do we start distilling frequent-path reasoning off frontier APIs onto our own smaller models? The technical leadership should have a rough answer even if the specifics evolve. 
 On the agentic system specifically 
 Q11. How many actual LLM-reasoning agents are in the system, vs. deterministic workflows? 
 The pitch deck says we have a lot of agents. The truth is that most of them should be deterministic typed workflows, per the Berkeley MAST research. We should be able to say &quot;~50 LLM agents at the reasoning layer, 600+ deterministic workflows at the execution layer&quot; — and have that reflect what&apos;s actually in the codebase. 
 Q12. How do the agents share context with each other? Is there full trace-sharing or just message-passing? 
 Cognition&apos;s &quot;Don&apos;t Build Multi-Agents&quot; essay argued that full context sharing is essential to prevent conflicting decisions. If our agents only pass messages (compressed summaries), we&apos;re at risk of the error mode Cognition documented. The technical leadership should be able to answer this. 
 Q13. What&apos;s our approach to preventing hallucinations in customer-facing recommendations? 
 The transcript showed AdBrain behaving well here — refusing to make unsupported claims, saying &quot;I can&apos;t say for certain&quot; when appropriate. Is this consistent across all recommendation types, or only in specific modules? If a customer prompts AdBrain about a topic outside its data, what happens? 
 On the alignment and safety story 
 Q14. What&apos;s our stated alignment target? What are we optimizing the operator&apos;s judgment toward? 
 &quot;Maximize ROAS&quot; is a naive answer. &quot;Maximize brand-appropriate long-term customer LTV subject to burn rate and creative brand safety constraints&quot; is a more mature answer. Whatever we say, it needs to be consistent across all seven capability tracks. 
 Q15. If Anthropic or OpenAI released a marketing-specific model tomorrow, what would we still have that they wouldn&apos;t? 
 This is the killer question. The honest answer: proprietary D2C decision data, operator-labeled judgment dataset, and the domain-specific evaluation suite. We should have this answer memorized cold. 
 
 Part 3 — Learning resources 
 Organized by time commitment. Everyone customer-facing should complete the 30-minute tier before pitching. The technical leadership should be comfortable with the 2-hour tier. Anyone doing technical DD conversations should be at the weekend tier. 
 30-minute tier — the essentials 
 Read these before any investor conversation. Enough to defend the vocabulary without bluffing. 
 → Anthropic — Core Views on AI Safety (15 min) 
 The clearest explanation of why alignment matters and how it&apos;s actually done. Bessemer partners have read this. 
 https://www.anthropic.com/news/core-views-on-ai-safety 
 → OpenAI — Aligning language models to follow instructions (InstructGPT) (10 min) 
 The original RLHF paper explained in accessible language. Foundational reading. 
 https://openai.com/index/instruction-following/ 
 → Cognition — Don&apos;t Build Multi-Agents (10 min) 
 Why naive multi-agent systems fail. The essay that shaped how serious AI teams think about agent architecture in 2025-26. 
 https://cognition.ai/blog/dont-build-multi-agents 
 → Anthropic — How we built our multi-agent research system (15 min) 
 The counter-view. When multi-agent works, and how to structure it. Read alongside the Cognition post. 
 https://www.anthropic.com/engineering/built-multi-agent-research-system 
 2-hour tier — the working depth 
 Read these before any technical DD conversation. Enough to have opinions, not just definitions. 
 → Chip Huyen — RLHF: Reinforcement Learning from Human Feedback (45 min) 
 The cleanest practitioner explanation of RLHF. Covers reward modeling, PPO, the full pipeline. Written for people who need to actually build things. 
 https://huyenchip.com/2023/05/02/rlhf.html 
 → Anthropic — Constitutional AI (30 min) 
 How Claude was trained to be helpful and harmless without exhaustive human labeling. The next evolution of RLHF. 
 https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback 
 → UC Berkeley — Why Do Multi-Agent LLM Systems Fail? (MAST paper) (30 min) 
 The empirical study on multi-agent failure modes. 14 failure categories documented. Essential for anyone claiming multi-agent architecture. 
 https://arxiv.org/abs/2503.13657 
 → MemGPT / Letta paper (30 min) 
 How to give LLMs persistent memory. Directly relevant to AdBrain&apos;s memory architecture claims. 
 https://arxiv.org/abs/2310.08560 
 → Stanford — Direct Preference Optimization (DPO) paper (45 min) 
 The original DPO paper that changed how alignment is done. Read alongside the Chip Huyen RLHF post for the full picture of the RLHF-vs-DPO tradeoff. 
 https://arxiv.org/abs/2305.18290 
 → Chip Huyen — RAG in production: pitfalls and patterns (40 min) 
 Practitioner-level walkthrough of what actually works and fails in production RAG. Covers chunking, retrieval quality measurement, hybrid retrieval — the specifics DD analysts probe. 
 https://huyenchip.com/2023/10/10/multimodality.html 
 → Google — Distilling the Knowledge in a Neural Network (Hinton et al.) (40 min) 
 The foundational paper on model distillation from Geoffrey Hinton. Old but the mental model still holds; every modern distillation approach builds on this. 
 https://arxiv.org/abs/1503.02531 
 Weekend tier — the technical mastery 
 For the technical leadership. Enough to defend the technical architecture in a partner-level DD conversation. 
 → Sebastian Raschka — Build a Large Language Model (From Scratch) (8+ hours) 
 The clearest technical book on how LLMs actually work end-to-end. Chapters on fine-tuning and RLHF are particularly relevant. 
 https://www.manning.com/books/build-a-large-language-model-from-scratch 
 → Anthropic — Engineering with Claude (documentation) (3 hours) 
 How to build production-grade agentic systems using Claude. Read alongside your own architecture as a stress-test. 
 https://docs.claude.com/en/docs/agents-and-tools/overview 
 → Simon Willison — LLM blog archive (ongoing) 
 Practitioner-level writing on what&apos;s actually working in production LLM applications. Update monthly. 
 https://simonwillison.net/tags/llms/ 
 → AI Engineer Summit talks (YouTube) (ongoing) 
 The clearest single source of what production AI teams are actually doing in 2025-26. Two to three talks per week is a solid diet. 
 https://www.youtube.com/@aiDotEngineer 
 For staying current 
 Once the fundamentals are in place, staying current matters as much as the initial learning. AI moves quarter by quarter. 
 → Anthropic Research page (weekly) 
 New papers and posts weekly. Set a Friday morning ritual to scan. 
 https://www.anthropic.com/research 
 → OpenAI Research page (weekly) 
 Same discipline for OpenAI&apos;s publications. 
 https://openai.com/research/ 
 → Latent Space podcast (weekly) 
 Deep interviews with AI engineering leaders. Best single source for staying current on production AI patterns. 
 https://www.latent.space/ 
 → The AI Report by Nathan Benaich (monthly) 
 Annual State of AI report is essential; monthly newsletter is high-signal. 
 https://www.stateof.ai/ 
 
 Part 4 — How to use this document 
 FOR THE FOUNDER 
 Read Part 1 twice. Answer Part 2 with the technical leadership before every partner meeting. Do the 30-minute tier of Part 3 this week. The goal is not to become an ML engineer — it is to be able to use the vocabulary correctly, defend AdBrain&apos;s technical claims at the strategic level, and know when to hand a question to technical leadership without stumbling. 
 The specific language patterns in Part 1 (&quot;USAGE IN A MEETING&quot;) should become second nature. Practice them out loud. When you say &quot;we&apos;re doing RLHF for marketing operations,&quot; it should sound like something you know, not something you memorized. 
 FOR THE TECHNICAL LEADERSHIP 
 Part 2 is the technical leadership&apos;s responsibility to answer definitively. Every question in Part 2 should have a documented, current answer that reflects what is actually in the codebase and data pipeline. If any answer is &quot;we don&apos;t know&quot; or &quot;we haven&apos;t done that yet,&quot; that&apos;s a technical debt item — either build it or have a defensible plan for when it will be built. 
 Part 3&apos;s weekend tier is the technical bench. If a DD analyst starts asking about DPO vs PPO, reward model overfitting, model distillation, or evals architecture, the technical leadership should be able to speak fluently. Not because they&apos;ll be quizzed, but because AI-native investors judge technical depth partly by how casually the vocabulary is used. 
 Where responsibility is split across two co-equal technical leads working on different tracks, either can own the answer for their track. What matters is that between them, every question in Part 2 has a documented owner and a current answer. Coordinate on the answers before the investor conversation so the story is consistent regardless of who&apos;s in the room. 
 FOR ANYONE CUSTOMER-FACING 
 You don&apos;t need the weekend tier. You need to master Part 1 and know Part 2 answers well enough not to contradict the technical leadership. When customers ask technical questions you can&apos;t answer, the correct response is &quot;let me bring our technical leadership into that conversation&quot; — never bluff. 
 CADENCE 
 Review this document quarterly. AI vocabulary evolves fast — terms that mattered in 2023 (like &quot;prompt engineering&quot;) are commodity in 2026. Terms that matter in 2026 (RLHF, evals, alignment) will be replaced by new ones in 2028. Rebuild the vocabulary discipline every quarter. 
 
 Living document. Update as we learn what actually comes up in real investor and customer conversations. What we don&apos;t yet know is more important than what we know. 
 
// Creative Production — 42 BEST-PERFORMING AD FORMATS (the executional reference library). PURE, no I/O;
// unit-tested by scripts/check-cp-ad-format-library.ts. type-only import -> erased at runtime.
//
// WHY THIS EXISTS: concept-formats.ts holds ~70 STRATEGIC angles (before/after, problem/solution) with
// GENERIC visual patterns. That genericness is why the image model produced bland "background + text" ads.
// This file holds the 42 EXECUTIONAL formats real media buyers ship (Reddit post, iMessage thread, Google
// search page, Trustpilot card, receipt comparison, tier list...) with a CONCRETE renderRecipe per format,
// so the image model (Nano Banana / Gemini image) renders the actual FORMAT scene, not a generic backdrop.
// This is the user-supplied "Creative Format Library" the concept-formats.ts header anticipated: it is the
// SOURCE OF TRUTH the pipeline scores from. concept-formats.ts remains the fallback/extended palette.
// Source: 42_Ad_Formats.pdf (docs/42_Ad_Formats.pdf) — each format paired with a real example ad.
//
// Fidelity rule (matches the pipeline's separation of concerns):
//   productMode "composite" -> the REAL product image is dropped in as a cutout (never redrawn by the model).
//   productMode "in-scene"  -> the product is part of what the model renders (use only where exact-SKU
//                              fidelity is not load-bearing, e.g. a shadow/silhouette or a stylised render).
//   productMode "none"      -> a pure UI/typographic format with no physical product on frame.
//   sceneText "render"      -> the model MUST draw the format's native chrome text (search results, message
//                              bubbles, review card) — it IS the format. sceneText "space" -> the model
//                              leaves a clean copy zone and the deterministic compositor adds crisp text.
import type { ConceptFormat } from "@/lib/creative-production/types";

export type ProductMode = "composite" | "in-scene" | "none";
export type SceneText = "render" | "space";
export type FormatCategory =
  | "ui-mockup" // mimics a familiar interface (search, messages, notes, email, reddit, story)
  | "social-proof" // reviews, ratings, testimonials
  | "comparison" // us-vs-them, before/after, new-vs-old, versus
  | "urgency-offer" // discount, low-stock, bundle, limited
  | "editorial" // bold typographic / poster / native OOH
  | "humor" // meme, sarcasm, witty metaphor
  | "ugc" // hand-held / talking-head / greenscreen authenticity
  | "problem-education"; // symptoms, myth/fact, warnings, "signs"

// An executional ad-format template. Extends ConceptFormat so it drops straight into the existing pipeline
// (scoring, concept generation), and carries the extra fields the IMAGE prompt and compositor consume.
export type AdFormatTemplate = ConceptFormat & {
  category: FormatCategory;
  renderRecipe: string; // the explicit scene the image model builds — the whole format look
  productMode: ProductMode;
  sceneText: SceneText;
};

// The 42, numbered as in the reference PDF. renderRecipe is written product-agnostic: the pipeline injects the
// real product name / brand palette / hero image at render time. Keep recipes concrete but not brand-locked.
export const AD_FORMAT_LIBRARY: AdFormatTemplate[] = [
  { id: "breaking-news", name: "Breaking news", awarenessStage: "product", category: "editorial",
    structure: "A person holds up a folded newspaper whose front page IS the announcement.", textSlots: ["headline", "cta"],
    visualPattern: "Real lifestyle photo of a person holding a newspaper toward camera; the masthead is the brand, the headline is the news.",
    renderRecipe: "A candid lifestyle photograph of a person holding an open newspaper up toward the camera. The newspaper front page reads like breaking news with a bold masthead and a large headline announcing the product/collection. Natural daylight, authentic setting (beach, street, cafe). Newspaper texture realistic.",
    productMode: "in-scene", sceneText: "render", bestFor: "Launches, drops, and 'coming soon' announcements that benefit from a news-flash urgency." },

  { id: "trustpilot-reviews", name: "Trustpilot reviews", awarenessStage: "most_aware", category: "social-proof",
    structure: "Product flat-lay with a Trustpilot star badge and one verbatim review card.", textSlots: ["rating", "quote", "cta"],
    visualPattern: "Clean product shot with a green Trustpilot 4-5 star badge, review count, and a short customer quote card overlaid.",
    renderRecipe: "A clean overhead product flat-lay on a soft neutral surface. Overlaid: a Trustpilot-style green five-star rating with a review count, and a rounded review-quote card containing a short authentic customer testimonial signed with a first name. 'Swipe to see more' hint bottom-right.",
    productMode: "composite", sceneText: "render", bestFor: "Warm audiences who convert on concentrated third-party social proof." },

  { id: "offer-flash", name: "Offer", awarenessStage: "most_aware", category: "urgency-offer",
    structure: "A bold sticker-style discount flash slapped over a confident lifestyle portrait.", textSlots: ["offer", "headline", "cta"],
    visualPattern: "A big cut-out '% OFF' sticker overlaid on an attitude-filled model photo.",
    renderRecipe: "A bold streetwear-style lifestyle portrait of a model with attitude. Overlaid large sticker-style typographic flash announcing a big percentage discount and 'EVERYTHING / SALE' in a torn-sticker treatment. High-energy, high-contrast.",
    productMode: "in-scene", sceneText: "render", bestFor: "Sitewide sales and discount pushes to ready buyers." },

  { id: "white-billboard", name: "White billboard", awarenessStage: "unaware", category: "editorial",
    structure: "Product shown on a real-world OOH screen with a handwritten, emotional line.", textSlots: ["headline", "cta"],
    visualPattern: "A digital street billboard/newsstand screen showing the product with a raw handwritten caption.",
    renderRecipe: "A photograph of a digital street advertising screen (bus stop / newsstand) in an urban setting. The screen shows a minimal white ad with the product and a raw, handwritten emotional caption. Realistic reflections and city context around the screen.",
    productMode: "composite", sceneText: "render", bestFor: "Brand-building moments where an emotional, art-directed line matters more than an offer." },

  { id: "us-versus-them", name: "Us versus them", awarenessStage: "solution", category: "comparison",
    structure: "Two receipts side by side: same outcome, very different price.", textSlots: ["headline", "offer", "cta"],
    visualPattern: "Two till receipts hanging side by side, an expensive competitor vs the affordable brand, tagline above.",
    renderRecipe: "Two paper till-receipts printed from registers, hanging side by side against a clean pastel background. Left receipt shows a high price, right receipt shows a much lower price, each with a barcode. An elegant tagline above frames the contrast ('Same [benefit]. Different receipt.'). Soft studio light.",
    productMode: "composite", sceneText: "render", bestFor: "Value positioning against a pricier incumbent." },

  { id: "ai-podcast", name: "AI podcast", awarenessStage: "solution", category: "ugc",
    structure: "A talking-head podcast still with a burned-in caption word.", textSlots: ["headline", "cta"],
    visualPattern: "A person mid-sentence on a couch in a podcast setup, a single caption word centred like an auto-caption.",
    renderRecipe: "A relaxed podcast-style photo of a young person sitting on a couch mid-conversation, casual clothing, soft indoor lighting, slightly cinematic. A single large auto-caption word is burned in centre-frame as if from a talking clip.",
    productMode: "none", sceneText: "render", bestFor: "Native, conversational feeds where a UGC podcast clip out-performs polished ads." },

  { id: "doodle", name: "Doodle", awarenessStage: "unaware", category: "humor",
    structure: "A real product/brand photo with a hand-drawn cartoon doodle interacting with it.", textSlots: ["headline", "cta"],
    visualPattern: "Photo-real base with a playful marker-drawn cartoon character reacting to the product.",
    renderRecipe: "A minimal photographic scene of the product on a plain textured surface, with a playful hand-drawn marker-style cartoon character doodled on top, physically reacting to the product (comic action lines). Mixed media: real photo + childlike illustration.",
    productMode: "composite", sceneText: "space", bestFor: "Playful brands that win on charm and pattern-interrupt." },

  { id: "low-stock-alert", name: "Low-stock alert", awarenessStage: "most_aware", category: "urgency-offer",
    structure: "A loud 'LAST CHANCE' urgency poster with the product and a discount.", textSlots: ["headline", "offer", "cta"],
    visualPattern: "Bold condensed 'LAST CHANCE' type, urgency banner, product hero, discount flash.",
    renderRecipe: "A high-urgency promo poster: deep saturated background, giant condensed 'LAST CHANCE' headline, a top banner ('Now through Sunday'), the product hero centred, a bright starburst discount badge, and a bottom bar ('Over 280+ items leaving for good'). Loud, punchy retail energy.",
    productMode: "composite", sceneText: "render", bestFor: "Clearance and scarcity pushes that need urgency." },

  { id: "myth-vs-fact", name: "Myth vs fact", awarenessStage: "problem", category: "problem-education",
    structure: "Two labelled cards, a 'Myth:' card and a 'Fact:' card, resting on a surface.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A green 'Myth' card and a blue 'Fact' card pinned/placed on a wood or neutral surface.",
    renderRecipe: "Two rectangular note-cards resting on a natural wood surface, slightly overlapping. The upper card is one colour labelled 'Myth:' with a common misconception; the lower card is a contrasting colour labelled 'Fact:' with the correction. Small brand logo top-centre. Clean product-education look.",
    productMode: "none", sceneText: "render", bestFor: "Categories clouded by a widespread false belief." },

  { id: "iphone-notes", name: "iPhone notes", awarenessStage: "product", category: "ui-mockup",
    structure: "The product beside an iOS Notes / reminder card listing a simple routine with toggles.", textSlots: ["headline", "cta"],
    visualPattern: "Product on a soft gradient with an iOS-style card of timed steps and yellow toggle switches.",
    renderRecipe: "The product standing on a soft pastel gradient background. Beside/over it, an iOS-style rounded card listing a simple timed routine (e.g. '8:00am First apply', '12:00pm reapply') each row with a yellow toggle switch turned on. A small 'Visit site' pill bottom-left. Clean Apple-UI aesthetic.",
    productMode: "composite", sceneText: "render", bestFor: "Routine-led products where a simple how-to-use schedule sells the habit." },

  { id: "transformation-before-after", name: "Transformation", awarenessStage: "solution", category: "comparison",
    structure: "Two framed close-ups of the same subject: before and after, labelled 'real results'.", textSlots: ["headline", "cta"],
    visualPattern: "Split before/after portraits, same angle and light, dotted guide lines, 'real results' script.",
    renderRecipe: "Two side-by-side framed close-up portraits of the same person, identical angle, distance and lighting, showing a visible improvement from left ('before') to right ('after'). A soft script 'real results' headline above, small 'before'/'after' labels beneath each frame. Authentic, un-retouched feel.",
    productMode: "none", sceneText: "render", bestFor: "Products with a demonstrable, visual transformation over time." },

  { id: "zero-stars", name: "Zero stars", awarenessStage: "solution", category: "humor",
    structure: "A mock one-star review from a villain who WOULD hate the product (ironic proof).", textSlots: ["headline", "quote", "cta"],
    visualPattern: "A subway/transit ad panel: 'Zero stars. Would not recommend. - [villain]', ironic endorsement.",
    renderRecipe: "A photograph of an advertising panel inside a subway/train car. The ad shows a large ironic review: five empty stars, 'Zero stars.', 'Would not recommend.' and a signature from a fitting villain/antagonist for the category. Realistic transit setting with grab handles and doors.",
    productMode: "none", sceneText: "render", bestFor: "Witty brands where an ironic negative review from the 'enemy' is the endorsement." },

  { id: "google-search", name: "Google search", awarenessStage: "problem", category: "ui-mockup",
    structure: "A search bar with the user's query ('the search:') resolving into the product ('the solution:').", textSlots: ["headline", "cta"],
    visualPattern: "A minimal search-box mockup with a real pain-point query, then the product presented as the answer.",
    renderRecipe: "A clean minimal layout on a soft grey background. Top: label 'the search:' and a realistic search-bar UI containing a typed pain-point question. Bottom: label 'the solution:' and the product resting in a soft, aspirational setting (e.g. on clouds/linen). Calm, editorial.",
    productMode: "composite", sceneText: "render", bestFor: "Problem-aware audiences literally searching for the fix." },

  { id: "bundle-save", name: "Bundle", awarenessStage: "most_aware", category: "urgency-offer",
    structure: "A shopping cart of the multi-item bundle with a 'Bundle & Save + free shipping' badge.", textSlots: ["headline", "offer", "cta"],
    visualPattern: "Several product units tumbling into a shopping trolley, bold 'Bundle & Save' + % off starburst.",
    renderRecipe: "A bright brand-coloured scene with a shopping trolley holding several units of the product, a few extra units mid-air tumbling in. Bold 'Bundle & Save' headline, a '+ Free shipping' pill, and a starburst badge with the bundle discount. Fresh, energetic e-commerce look.",
    productMode: "composite", sceneText: "render", bestFor: "Raising average order value with a packaged multi-buy deal." },

  { id: "dont-be-an-idiot", name: "Don't be an idiot", awarenessStage: "problem", category: "problem-education",
    structure: "A bold visual metaphor + blunt educational one-liner on a saturated background.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A striking silhouette/metaphor (e.g. a shadow shaped like something) with a blunt teaching line.",
    renderRecipe: "A single saturated-colour poster with a clever visual metaphor rendered as a bold silhouette or shadow that reframes the problem. A short blunt educational line sits in clean space beside it; the product appears small in a corner as the answer. Award-show print-ad minimalism.",
    productMode: "composite", sceneText: "render", bestFor: "High-stakes categories where a blunt truth changes behaviour." },

  { id: "reddit-post", name: "Reddit style", awarenessStage: "product", category: "ui-mockup",
    structure: "A screenshotted Reddit post/card telling a short 'this actually worked' story.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A realistic Reddit post card with title, body text, and up-vote / comment / share row.",
    renderRecipe: "A realistic screenshot of a Reddit post card on the brand accent colour. A bold post title ('Wow, this actually worked.'), a few lines of authentic first-person body copy telling a relatable story, and the Reddit action row (up-vote arrows, a vote count, Comment, Share) with the Reddit wordmark bottom-right.",
    productMode: "none", sceneText: "render", bestFor: "Native, story-led social proof that reads as a real community post." },

  { id: "side-effect", name: "Side effect", awarenessStage: "problem", category: "problem-education",
    structure: "An extreme body close-up dramatising the problem with a blunt question.", textSlots: ["headline", "stat", "cta"],
    visualPattern: "A tight close-up (e.g. mouth/tongue) holding the product form, with a provocative question overlaid.",
    renderRecipe: "An extreme macro photograph of a body detail (e.g. a mouth with a tablet on the tongue) with dramatic lighting. A blunt provocative question is set boldly across it, plus a small supporting stat and brand mark at the base. Editorial, arresting.",
    productMode: "in-scene", sceneText: "render", bestFor: "Health/behaviour categories where a visceral problem shot stops the scroll." },

  { id: "were-sorry", name: "We're sorry", awarenessStage: "unaware", category: "humor",
    structure: "A mock brand 'apology' that is really a clever flex about the product/mission.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A warm gradient poster: 'We're Sorry' with a witty apology line and the product.",
    renderRecipe: "A warm gradient poster. Centre: a large 'We're Sorry' headline with a witty faux-apology sub-line that is actually a flex or mission statement. The product/silhouette sits above as the hero. Brand logo and a small print line at the base. Understated, premium.",
    productMode: "in-scene", sceneText: "render", bestFor: "Brands with a mission or personality that can turn an 'apology' into a hook." },

  { id: "tier-list", name: "Top tier / tier list", awarenessStage: "product", category: "comparison",
    structure: "The range ranked like a weather forecast / tier list across days or grades.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A weather-forecast-style column ranking product variants by day with icons.",
    renderRecipe: "A light sky/cloud background styled like a weather forecast. A vertical list of days (Mon-Fri), each row pairing a product variant with a weather icon, framed as a playful ranking of the range. Brand name and location line at the top. Soft, cheerful.",
    productMode: "composite", sceneText: "render", bestFor: "Ranges/flavours/variants that benefit from a fun, rankable framing." },

  { id: "instagram-story", name: "Instagram story", awarenessStage: "product", category: "ui-mockup",
    structure: "A vertical story with the product, a 'Shop Now' link sticker and reminder toggles.", textSlots: ["headline", "cta"],
    visualPattern: "A 9:16 story frame: hand holding product, an IG link sticker, timed reminder toggles, tagline.",
    renderRecipe: "A vertical 9:16 Instagram-story frame. A hand holds the product against a brand-colour background; an IG-style 'Shop Now' link sticker sits near the top, a small card of timed reminder toggles overlays the product, and a confident three-word tagline anchors the bottom. Native story aesthetic.",
    productMode: "composite", sceneText: "render", bestFor: "Story/Reels placements where a native, tappable look wins." },

  { id: "x-signs", name: "X signs", awarenessStage: "problem", category: "problem-education",
    structure: "'3 signs your [routine] isn't right' with symptom bubbles and the product.", textSlots: ["headline", "body", "cta"],
    visualPattern: "A titled card with rounded symptom 'pill' bubbles and the product being unboxed below.",
    renderRecipe: "A single-colour card. Bold title '3 SIGNS YOUR [ROUTINE] ISN'T RIGHT FOR YOU'. Three rounded outlined 'pill' bubbles each naming a symptom. Below, hands unbox the product from a mailer, with a small 'Shop now' pill. Friendly, checklist energy.",
    productMode: "composite", sceneText: "render", bestFor: "Helping viewers self-diagnose into the problem the product solves." },

  { id: "problem-vs-solution", name: "Problem vs solution", awarenessStage: "problem", category: "comparison",
    structure: "Two columns: 'your problems' listed vs 'our solution' (the product).", textSlots: ["headline", "body", "cta"],
    visualPattern: "Left column of problem bullets, a divider, right side the product as the single solution.",
    renderRecipe: "A clean split layout. Left column headed 'your problems' with a short stack of pain-point bullets in speech-bubble tags. A thin vertical divider. Right side headed 'our solution' with the product hero. Minimal, lots of white space.",
    productMode: "composite", sceneText: "render", bestFor: "Audiences who feel several pains but haven't found one fix." },

  { id: "warning-witty", name: "Warning", awarenessStage: "problem", category: "humor",
    structure: "A dramatic product photo with a witty double-meaning warning line.", textSlots: ["headline", "cta"],
    visualPattern: "Moody hero shot of the product with a clever line that reads as a warning and a flex.",
    renderRecipe: "A moody, dramatic hero photograph of the product with cinematic side lighting on a rich single-colour background. A large witty headline plays a double meaning (a mock 'warning' that is really confidence). Small brand sign-off at the base. Premium ad-agency polish.",
    productMode: "in-scene", sceneText: "render", bestFor: "Confident brands that can carry a clever, understated line." },

  { id: "claymation", name: "Claymation", awarenessStage: "unaware", category: "editorial",
    structure: "The product/subject rendered as a charming plasticine clay model.", textSlots: ["headline", "cta"],
    visualPattern: "A handmade claymation scene with fingerprint texture and playful characters.",
    renderRecipe: "A handmade claymation still: the subject/product sculpted from colourful plasticine with visible fingerprint texture, soft studio light, plain backdrop, playful character posing. Tactile stop-motion charm.",
    productMode: "in-scene", sceneText: "space", bestFor: "Distinctive, thumb-stopping brand creative with a crafted, playful tone." },

  { id: "you-can-avoid", name: "You can avoid", awarenessStage: "product", category: "editorial",
    structure: "'This [product] isn't for everyone, it's for the:' exclusivity casting.", textSlots: ["headline", "body", "cta"],
    visualPattern: "Bold 'ISN'T FOR EVERYONE' type, then a list of the exact ideal buyer, product in hand.",
    renderRecipe: "A bold typographic poster on a clean background. Giant headline 'THIS [PRODUCT] ISN'T FOR EVERYONE'. Below: 'IT'S FOR THE:' and a short list defining the exact ideal buyer. Hands hold the product at the base. Confident, exclusive tone.",
    productMode: "composite", sceneText: "render", bestFor: "Premium/niche products that win by defining who they're for." },

  { id: "reasons-why", name: "Reasons why", awarenessStage: "product", category: "problem-education",
    structure: "Benefit callouts arranged around the product with connector arrows.", textSlots: ["headline", "body", "cta"],
    visualPattern: "Product in centre with curved-arrow benefit callouts ('no sugary crashes', '21+ vitamins').",
    renderRecipe: "A calm single-colour scene. Hands hold the product in the centre. Curved arrows point outward to 3-4 short benefit callouts placed around it (e.g. 'no sugary crashes', 'whole-food ingredients'). Friendly, informative layout with generous space.",
    productMode: "composite", sceneText: "render", bestFor: "Summarising the core case in a scannable, benefit-led frame." },

  { id: "email-screenshot", name: "Email screenshot", awarenessStage: "most_aware", category: "ui-mockup",
    structure: "A screenshot of a cart-reminder / marketing email with the abandoned items.", textSlots: ["headline", "cta"],
    visualPattern: "A realistic email client screenshot: subject bar, line items with prices, a checkout button.",
    renderRecipe: "A realistic screenshot of a marketing email: a top 'your free shipping is about to expire' bar, the brand name header, a bold subject line, one or two product line-items with thumbnails, quantities and prices, and a black 'Checkout now' button. Clean email-client chrome.",
    productMode: "composite", sceneText: "render", bestFor: "Retargeting warm carts with a familiar cart-reminder framing." },

  { id: "text-message", name: "Text message", awarenessStage: "solution", category: "ui-mockup",
    structure: "An iMessage thread where the product appears inside the conversation.", textSlots: ["headline", "cta"],
    visualPattern: "iOS message bubbles (grey received, blue sent) with the product photo shared in the chat.",
    renderRecipe: "A realistic iOS Messages screenshot: alternating grey received and blue sent bubbles forming a short, witty exchange, with the product image shared as a photo inside the thread. Accurate iMessage UI (timestamps, tail bubbles). Relatable, conversational.",
    productMode: "composite", sceneText: "render", bestFor: "Conversational, relatable hooks that feel like a real chat." },

  { id: "crossed-out-problems", name: "Crossed out problems", awarenessStage: "solution", category: "comparison",
    structure: "'TO DO' (messy ingredients) vs 'TA DA' (the finished, effortless result).", textSlots: ["headline", "cta"],
    visualPattern: "Left: a messy spread of raw components labelled 'TO DO'. Right: the tidy end result labelled 'TA DA'.",
    renderRecipe: "A clean split. Left column labelled 'TO DO' in black: an overhead flat-lay of many raw components/ingredients scattered with small labels (the hard way). Right column labelled 'TA DA' in the brand colour: the effortless finished result (e.g. a neat delivery bag/product). Crisp, witty before/after of effort.",
    productMode: "composite", sceneText: "render", bestFor: "Convenience products that replace a tedious multi-step chore." },

  { id: "native-billboard", name: "Native", awarenessStage: "unaware", category: "editorial",
    structure: "A real photo of the product's blunt billboard standing in its real environment.", textSlots: ["headline", "cta"],
    visualPattern: "An in-situ outdoor billboard with a blunt, self-aware one-liner, shot in daylight.",
    renderRecipe: "A daytime photograph of a real outdoor billboard mounted above a street/gas station, palm trees and sky around it. The billboard carries a blunt, self-aware one-liner about the category (confident, low-ego). Authentic OOH photography, slight perspective.",
    productMode: "none", sceneText: "render", bestFor: "Category-level brand statements that feel bigger than a product ad." },

  { id: "hack-101", name: "Hack 101", awarenessStage: "solution", category: "comparison",
    structure: "A clever like-for-like price 'hack' comparison (same price, wildly better).", textSlots: ["headline", "cta"],
    visualPattern: "Two items at the SAME price side by side, one absurdly better value, 'VS' in the middle.",
    renderRecipe: "A bold brand-colour poster. Two objects at the SAME price shown side by side with a 'VS' between them, framed so the brand's offer is the obvious better value (a witty like-for-like price hack). Clean labels with matching prices above each. Playful, smart.",
    productMode: "composite", sceneText: "render", bestFor: "Value/price positioning delivered as a clever gag." },

  { id: "in-case-of-emergency", name: "In case of emergency", awarenessStage: "product", category: "editorial",
    structure: "The product mounted in a red 'break glass in case of emergency' box.", textSlots: ["headline", "cta"],
    visualPattern: "A wall-mounted red emergency case with the product inside and 'BREAK GLASS' below.",
    renderRecipe: "A photograph of a red 'in case of emergency' wall box (the fire-alarm kind) mounted on a panelled wall, with the product displayed inside behind glass. 'IN CASE OF EMERGENCY' above and 'BREAK GLASS' below in stencil type. Witty, high-contrast.",
    productMode: "composite", sceneText: "render", bestFor: "Impulse/treat products framed as the essential emergency indulgence." },

  { id: "customer-testimonial-cards", name: "Customer testimonial", awarenessStage: "most_aware", category: "social-proof",
    structure: "The product held in hand, surrounded by floating five-star review cards.", textSlots: ["quote", "rating", "cta"],
    visualPattern: "Hand holds product; several small review cards with stars and avatars float around it.",
    renderRecipe: "A hand holds the product upright against a brand-colour background. Several small review cards float around it, each with a tiny avatar, a five-star row and a one-line quote. A soft 'meet your [category] holy grail' script headline at the top. App-store-review energy.",
    productMode: "composite", sceneText: "render", bestFor: "Well-reviewed products that convert on a wall of real praise." },

  { id: "green-screen", name: "Green screen", awarenessStage: "solution", category: "ugc",
    structure: "A hand-held greenscreen selfie reaction with big burned-in text over a scene.", textSlots: ["headline", "cta"],
    visualPattern: "A creator filming a selfie video, phone-call/story UI overlay, bold caption over the background.",
    renderRecipe: "A hand-held selfie-style vertical shot of a creator reacting to camera, with a UGC greenscreen background behind them and bold burned-in caption text ('Summer is calling'). Story/call UI elements overlaid (Message / Voicemail / slide-to-answer). Raw, authentic phone-video look.",
    productMode: "none", sceneText: "render", bestFor: "UGC-led feeds where a raw creator reaction out-performs studio work." },

  { id: "dont-buy-this", name: "Don't buy this", awarenessStage: "most_aware", category: "editorial",
    structure: "Reverse-psychology 'DON'T BUY THIS [product], unless...' editorial serif poster.", textSlots: ["headline", "body", "cta"],
    visualPattern: "Large elegant serif 'DON'T BUY THIS ___', product floating, 'unless...' qualifier + proof chips.",
    renderRecipe: "An elegant editorial poster on a warm off-white background. Oversized serif headline 'DON'T BUY THIS [PRODUCT]' with the product floating through/beside the type. A smaller line beneath adds the reverse-psychology qualifier ('unless you want [result] in 28 days'), plus 2-3 small proof chips with check icons. Sophisticated, high-contrast.",
    productMode: "composite", sceneText: "render", bestFor: "Confident, proof-backed products using reverse psychology." },

  { id: "stat-headline", name: "Stat headline", awarenessStage: "solution", category: "problem-education",
    structure: "A row of hero percentages with the product and a 'the facts behind' line.", textSlots: ["stat", "headline", "cta"],
    visualPattern: "A person with the product on a bold background, three big % stats and a facts strapline.",
    renderRecipe: "A confident portrait (e.g. a child/person) holding the product on a rich single-colour background. Along the base, a row of three large percentage stats each with a tiny caption, and a bold 'The facts behind [product]' strapline. Clean, data-led, trustworthy.",
    productMode: "composite", sceneText: "render", bestFor: "Outcome-led products with real, quantifiable results." },

  { id: "meme", name: "Meme", awarenessStage: "unaware", category: "humor",
    structure: "A two-panel before/after meme (e.g. sad → happy) landing on the product.", textSlots: ["headline", "cta"],
    visualPattern: "Stacked meme panels: 'Before' unhappy subject, 'After' delighted subject with the product.",
    renderRecipe: "A two-panel stacked meme on a flat colour background. Top panel labelled 'Before' shows a comically unhappy subject (e.g. a sad-looking animal); bottom panel labelled 'After' shows the same subject delighted, now with the product beside it. Relatable internet-humour tone.",
    productMode: "composite", sceneText: "render", bestFor: "Top-of-funnel reach that trades on shareable humour." },

  { id: "new-vs-old", name: "New versus old", awarenessStage: "solution", category: "comparison",
    structure: "A split of the outdated way vs the modern way, dated on each side.", textSlots: ["headline", "cta"],
    visualPattern: "Left half the old era object + year, right half the new era object + year, one subject morphing.",
    renderRecipe: "A vertical split poster with two contrasting era-colours. Left half dated with an old year shows the outdated tool; right half dated with the current year shows the modern equivalent, the object visually morphing across the seam. A witty brand tagline at the base. Bold, editorial.",
    productMode: "in-scene", sceneText: "render", bestFor: "Positioning the brand as the modern replacement for an old way." },

  { id: "text-on-skin", name: "Text on skin", awarenessStage: "problem", category: "problem-education",
    structure: "A minimalist body-skin close-up with a quiet, reframing line of text.", textSlots: ["headline", "body", "cta"],
    visualPattern: "An intimate skin/body macro with small elegant text and a discreet brand mark.",
    renderRecipe: "An intimate macro photograph of human skin/body detail with soft natural light, filling the frame. Small elegant serif text sits in the negative space delivering a quiet, reframing health line, with a discreet brand wordmark beneath. Understated, tasteful, editorial.",
    productMode: "none", sceneText: "render", bestFor: "Sensitive health topics handled with quiet, tasteful gravity." },

  { id: "us-vs-us", name: "Us versus us", awarenessStage: "unaware", category: "humor",
    structure: "'The [thing] we were given' vs 'the [thing] we deserve', two self-deprecating versions.", textSlots: ["headline", "cta"],
    visualPattern: "Top: a modest version of the product. Bottom: the glorious 'deserved' version, both branded.",
    renderRecipe: "A warm gradient poster split top/bottom. Top labelled 'The [X] we were given:' shows a modest/plain version; bottom labelled 'The [X] we deserve:' shows the indulgent hero version of the product. Witty self-aware brand humour, punchy type.",
    productMode: "in-scene", sceneText: "render", bestFor: "Brands with personality that can gently mock their own category." },

  { id: "venn-diagram", name: "Venn diagram", awarenessStage: "unaware", category: "editorial",
    structure: "Two overlapping circles whose intersection is the brand/product.", textSlots: ["headline", "cta"],
    visualPattern: "Two big labelled circles overlapping; hand-drawn arrows; the overlap resolves to the brand.",
    renderRecipe: "A clean white poster with two large overlapping circles in brand colours, each labelled with a concept via a hand-drawn arrow. A third arrow points from the overlap down to the brand logo/product: the brand IS the intersection. Smart, minimal, witty.",
    productMode: "none", sceneText: "render", bestFor: "One-idea brand statements that resolve to a clever equivalence." },

  { id: "script", name: "Script", awarenessStage: "unaware", category: "humor",
    structure: "A witty visual metaphor + short line (e.g. a pinch gesture, 'you're this close').", textSlots: ["headline", "cta"],
    visualPattern: "A minimal set-up with a human gesture completing the joke, tiny supporting line.",
    renderRecipe: "A minimal light-grey poster. A human hand performs a gesture that completes a short witty headline (e.g. a thumb-and-finger pinch beside 'You're this close'). Tiny supporting line and small brand mark. Clean, clever, lots of space.",
    productMode: "none", sceneText: "render", bestFor: "Brand/agency-style wit where a gesture lands the whole idea." },
];

// Look up one ad-format template by id. Returns undefined for an unknown id (never throws, never invents).
export function getAdFormat(id: string): AdFormatTemplate | undefined {
  return AD_FORMAT_LIBRARY.find((f) => f.id === id);
}

// The primary format palette the concept engine scores from (source of truth). concept-formats.ts stays the
// extended/fallback library. Exported as a function so a future user-uploaded library can override it here.
export function primaryFormats(): AdFormatTemplate[] {
  return AD_FORMAT_LIBRARY;
}

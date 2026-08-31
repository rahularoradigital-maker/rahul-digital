// Best-effort creator attributes for FILTERING, derived from already-collected public text (name, bio).
// Honest + low-confidence: Instagram exposes neither gender nor a structured location, so these are INFERRED
// and must be labeled as such in the UI. Pure. Never fabricates a value it cannot support (returns null).

import type { Confidence } from "./types.ts";

const FEMALE_NAMES = new Set(["priya","pooja","neha","anjali","anjalii","aditi","sneha","kavya","ritika","meera","sana","riya","shreya","ananya","divya","niketa","yamini","madhulika","simran","aisha","fatima","zoya","tanya","isha","nisha","payal","swati","richa","komal","preeti","deepika","kiran","sonam","nidhi","bhavna","rashmi","kritika","muskan","ishita"]);
const MALE_NAMES = new Set(["rahul","amit","raj","vikram","arjun","rohit","karan","aditya","ankit","nikhil","sahil","varun","manish","deepak","suresh","ramesh","vishal","gaurav","rishab","rishabh","harsh","yash","dev","kunal","abhishek","saurabh","akash","siddharth","pranav"]);

/** Guess the creator's gender from their first name. Always LOW confidence at best; null when unsure. */
export function guessGender(name: string | null): { gender: "f" | "m" | null; confidence: "low" | "none" } {
  if (!name) return { gender: null, confidence: "none" };
  const first = name.trim().toLowerCase().split(/[\s._-]+/)[0].replace(/[^a-z]/g, "");
  if (!first) return { gender: null, confidence: "none" };
  if (FEMALE_NAMES.has(first)) return { gender: "f", confidence: "low" };
  if (MALE_NAMES.has(first)) return { gender: "m", confidence: "low" };
  if (/(esh|raj|kumar|deep|ansh|it)$/.test(first) && first.length > 3) return { gender: "m", confidence: "low" };
  if (/(a|i|ka|ta|ya|ni|ri)$/.test(first)) return { gender: "f", confidence: "low" };
  return { gender: null, confidence: "none" };
}

const INDIA_PLACES = ["new delhi","delhi","mumbai","bengaluru","bangalore","hyderabad","chennai","kolkata","pune","ahmedabad","jaipur","surat","lucknow","kanpur","nagpur","indore","bhopal","patna","chandigarh","kochi","cochin","coimbatore","gurugram","gurgaon","noida","goa","punjab","kerala","gujarat","rajasthan","karnataka","maharashtra","tamil nadu","telangana","west bengal","uttar pradesh","haryana"];

/** Pull the creator's OWN stated location out of their bio (e.g. "📍Hyderabad"). This is where the CREATOR
 * is, not where their audience is - label it as such. Returns a display-cased place, or null. */
export function extractRegion(bio: string | null): string | null {
  if (!bio) return null;
  const t = bio.toLowerCase();
  for (const p of INDIA_PLACES) {
    if (t.includes(p)) return p.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

export type EngBand = "any" | "1-5" | "5-10" | "10+";
/** Engagement-rate band filter (on the follower-based post rate). Unknown ER never matches a specific band. */
export function inEngBand(er: number | null, band: EngBand): boolean {
  if (band === "any") return true;
  if (er == null) return false;
  const pct = er * 100;
  if (band === "1-5") return pct >= 1 && pct < 5;
  if (band === "5-10") return pct >= 5 && pct < 10;
  return pct >= 10;
}

// Selling/commerce signals that mark a BRAND, SHOP, or RESELLER (i.e. a competitor) rather than an influencer.
const SELLING = /(shop now|order now|dm to order|dm for order|whatsapp to order|to order|\bcod\b|cash on delivery|shipping|ships? worldwide|worldwide shipping|wholesale|resellers?|manufacturer|\bstore\b|buy now|shop link|link to shop|shop the|designer label|clothing brand|fashion label|our label|new collection|new arrivals|sale live|shop online|order on whatsapp|™|®)/i;
// Signals that mark a real PERSON / creator - if present we keep the account even if it also sells a little.
const CREATOR_SELF = /(content creator|\bcreator\b|influencer|blogger|vlogger|\bugc\b|dm for collab|for collabs?|founder|artist|actor|actress|\bmodel\b|coach|makeup artist|\bmua\b|stylist|personal blog)/i;
// Brand-y words in the account NAME (a person is rarely called "X Clothing" / "X Label" / "X Boutique").
const BRAND_NAME = /(clothing|apparel|couture|boutique|\blabel\b|fashion house|\bstore\b|\bbrand\b|\bco\.?\b|\bpvt\b|\bllp\b|enterprises?|exports?|creations?|collections?)/i;

/** True when the account looks like a BRAND / shop / reseller (a competitor) rather than an influencer. Used
 * to drop competitors from the creator shortlist. Conservative: an explicit creator self-description wins. */
export function looksLikeBrand(name: string | null, bio: string | null): boolean {
  const text = `${name ?? ""} ${bio ?? ""}`.toLowerCase();
  if (CREATOR_SELF.test(text)) return false; // clearly a person/creator
  if (BRAND_NAME.test((name ?? "").toLowerCase())) return true; // "X Clothing" / "X Label" etc.
  return SELLING.test(text); // selling/shipping/ordering language => shop or brand
}

export const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };
export type MinConfidence = "any" | "low" | "medium" | "high";
/** Confidence gate: keep only creators whose overall score confidence meets the minimum. */
export function meetsConfidence(c: Confidence, min: MinConfidence): boolean {
  if (min === "any") return true;
  return CONF_RANK[c] >= CONF_RANK[min === "low" ? "low" : min];
}

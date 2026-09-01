// Honest demo-path gate (cleanup #3). Stub/demo implementations - Google Ads demo data, the Creative Studio
// image-generation placeholder - must NOT serve fake output in production. A demo path is OFF unless the real
// provider is configured OR ALLOW_DEMO_PATHS is explicitly set (opt-in for local/preview testing). Read at
// call time so toggling it needs no redeploy. This is the single truthful answer to "is a demo path allowed?"
export function demoPathsAllowed(): boolean {
  const v = process.env.ALLOW_DEMO_PATHS;
  return Boolean(v && v.trim() && v !== "0" && v.trim().toLowerCase() !== "false");
}

import "server-only";

// Influencer Hunt is OFF unless explicitly enabled. There is no flag system in this app, so it's a plain
// server env check (read at call time, never cached). Routes return 404/disabled when off; the nav item is
// hidden when off; the rest of AdBrain is byte-for-byte unchanged. Default OFF so shipping the code never
// exposes the module until Rahul enables it per environment/account.
export function influencerHuntEnabled(): boolean {
  return process.env.INFLUENCER_HUNT_ENABLED === "1";
}

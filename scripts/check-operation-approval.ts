// Runnable check for the approval state machine (Track A, Phase A5). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-operation-approval.ts
// Proves the human gate cannot be skipped: only ready_for_approval can be approved, a blocked op can never be
// approved, and rejected/handed_off are terminal.
import { strict as assert } from "node:assert";
import { canTransition, initialStatus, auditVerb } from "../lib/operations/approval.ts";
import type { ValidationResult } from "../lib/operations/validate.ts";

// Legal transitions.
assert.ok(canTransition("ready_for_approval", "approved"), "ready -> approved is allowed");
assert.ok(canTransition("ready_for_approval", "rejected"), "ready -> rejected is allowed");
assert.ok(canTransition("approved", "handed_off"), "approved -> handed_off is allowed");
assert.ok(canTransition("blocked", "rejected"), "blocked -> rejected (dismiss) is allowed");

// Illegal / skipped transitions must be refused.
assert.equal(canTransition("blocked", "approved"), false, "a blocked op can NEVER be approved");
assert.equal(canTransition("ready_for_approval", "handed_off"), false, "cannot skip approval");
assert.equal(canTransition("rejected", "approved"), false, "rejected is terminal");
assert.equal(canTransition("approved", "rejected"), false, "cannot reject after approving");
assert.equal(canTransition("handed_off", "approved"), false, "handed_off is terminal");

// Initial status from validation: validated -> queue for approval; blocked -> shown; read -> not queued.
const v = (status: ValidationResult["status"]): ValidationResult => ({ status, violations: [] });
assert.equal(initialStatus(v("validated")), "ready_for_approval");
assert.equal(initialStatus(v("blocked")), "blocked");
assert.equal(initialStatus(v("not_applicable")), null, "a read never enters the approval queue");

// Every transition has an audit verb (A5 rule: no silent state change).
assert.equal(auditVerb("approved"), "operation.approved");
assert.equal(auditVerb("rejected"), "operation.rejected");

console.log("OK check-operation-approval: gate cannot be skipped, blocked never approvable, terminals are terminal.");

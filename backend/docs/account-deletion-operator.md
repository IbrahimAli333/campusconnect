# Owner-operated account deletion

This command is for an operator who already has authorized database access. It
adds no public admin endpoint or new permission. Preparing this patch does not
authorize its use against a live account or deployment.

## Verify the request first

Use the confirmed support mailbox, `ibrahimaliworkacc@gmail.com`. Handle requests
within the confirmed seven-day period. Verify control by sending a fresh
confirmation to the email already stored for the account, independently of an
incoming From or Reply-To. Do not disclose account existence to an unverified
sender. Never request passwords, codes or identity documents. If ownership is
unclear, do not delete. Record a non-sensitive request reference and the
verification outcome; the command's flag is an operator attestation, not an
email-verification mechanism. The command sends no messages.

## Inspect, then explicitly confirm

Check the deployment revision and intended database through the operator's
existing secure configuration. Never put database credentials in shell history,
notes or command output. Work from `backend/` with the normal approved backend
environment. Resolve the exact immutable user ID and its matching email.

First run a preview (the following values are synthetic examples):

```sh
python -m app.scripts.delete_user_account --user-id 101 --email delete@example.invalid
```

It prints direct record counts without emails, content or tokens. These are not
counts of every dependent row: deletion includes existing account cascades.
Review the scope before proceeding. Permanently removing authored announcements
and legacy material listings affects other readers. Linked external resources
are not deleted; shared courses and unrelated users' content remain.

Only after ownership verification and account-specific permanent-deletion
approval, rerun with `--execute --ownership-confirmed --request-reference req-001`.
The command requires typing `DELETE USER 101` exactly for this example. It
refetches and locks the account row, rechecks ID/email, and uses one transaction
for authored-content cleanup and existing ORM account cascades. The shared
helper locks the user, teacher profile and selected authored rows before deletion;
this prevents concurrent inserts from leaving orphaned authored content and
protects selected rows from reassignment during cleanup. PostgreSQL provides
these row locks; SQLite test fixtures do not emulate its concurrency. Already
loaded author and teacher relationships are refreshed to honor earlier committed
reassignments. Normal database deadlock/timeout failures must be handled as errors,
not reported as successful deletion.

An ID/email mismatch stops deletion. An absent ID is an idempotent no-op unless
that email now belongs to a different account. Failure before commit rolls back.
Post-commit checks verify the account and captured authored-content IDs are gone.
If a database or verification error occurs, investigate that exact account's
state before retrying or telling the requester the action completed. Do not
blindly repeat with a different ID.

## Scope and remaining operational work

This removes the account, its existing dependent application records, authored
announcement rows and authored legacy material listing rows. Existing cascades
include sent/received conversations and applications relating to owned
opportunities, plus legacy teacher lessons/attendance. They can affect shared
conversations and schedules; communicate that scope before irreversible action.
A deleting teacher's shared course stays, with attribution cleared. Other users'
accounts and unrelated authored content remain.

The command is not a provider-erasure, support-mailbox or historical-copy tool.
Successful account deletion removes backend account-to-push-token mappings;
it does not itself prove every remaining installation identifier is linked to
an account or require a native reset. Assess relevant retained provider data
and request deletion/disassociation where required. No provider request is sent.

Review support correspondence, any identified independent work copies and
specific justified retention separately. Apply completed deletions before a
restored database returns to service. This document does not establish a new
90-day retention rule or guarantee physical erasure of provider copies within
seven days. Existing orphaned announcements/materials whose authors were
already cleared cannot be safely attributed by this patch; do not mass-delete
them or infer ownership by a name match.

A pre-deploy provisioning job can recreate configured admin/reviewer accounts.
If a request concerns one of those accounts, coordinate removal of the relevant
provisioning configuration under separate authorization before claiming the
account will stay deleted. This command does not modify deployment settings.

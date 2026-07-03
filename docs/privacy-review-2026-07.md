# Privacy Review — Children's Data — July 2026

Scope: who can read/write children's personal data (names, class, photos, notes) across Firestore rules, Storage rules, and client code.

## Access model (after fixes)

A child document (`children/{id}`) is readable ONLY by:
1. A **linked parent** (`parentUids`)
2. **Admins / super-admins**
3. **Same-class parents** (`classId ∈ user.classIds`) — for the class roster
4. **Class admins of that class** (`classId ∈ user.classAdminFor`)
5. **Imported families during onboarding** (unlinked children only, `imported == true`)

Child photos in Storage mirror the same list (1–4).

## Issues found & fixed (deployed 2026-07-02)

### CRITICAL — profile create rule allowed arbitrary role self-assignment
`users` create rule only checked `request.auth.uid == userId`. Anyone could sign up
and write `role: 'super_admin'` directly via the SDK — full access to every child,
family, and admin surface.
**Fix:** create rule now restricts `role`/`roles` to community/new_family/host_family,
and forbids seeding `classIds`/`classAdminFor`.

### HIGH — all unlinked children readable by any account
The onboarding rule let ANY authenticated user read every unlinked child (name +
class). Since self-registration is open, a stranger could enumerate the entire
roster of unclaimed kids.
**Fix:** new `imported` flag on the user profile, validated at create time against
the admin-written `pendingFamilies` record (rules `exists()` check — cannot be
forged). Only imported families can browse/claim unlinked children. Claim rule
gated the same way.

### HIGH — child photos readable by any authenticated user
`storage.rules` allowed any signed-in account to read `children/{childId}/*`.
**Fix:** Storage read now mirrors the Firestore child-read rule (parent, admin,
same-class, class admin) via `firestore.get()`.
Note: previously issued `getDownloadURL` links carry an access token and keep
working regardless of rules. If a child's photo URL leaked, re-upload the photo
to rotate the token.

### Regression fix — classIds freeze broke onboarding (introduced earlier today)
Morning's security fix froze `classIds` in the self-update rule, but
`linkChildToParent`/`syncUserClassIds` legitimately update it client-side —
child-linking was broken for a few hours.
**Fix (proof-based, no server needed):** `classIds` may shrink freely
(privacy-reducing), or grow by exactly ONE class proven by `classProofChildId` —
rules verify via `getAfter()` that the user is a linked parent of a child in that
class. Escalation stays closed; onboarding works again.

## Accepted / for awareness (not changed)

- **Host families see ALL new families** (name, phone, address) — matches the
  current product design of `FamiliesPage`. If hosts should only see assigned
  families, add a `hostFamilyId` filter + rule clause.
- **Same-class parents see each other's profiles** (contact info) — intended
  class-roster behavior.
- **Existing imported users lack the `imported` flag** (profiles created before
  today). They can no longer browse unlinked children mid-onboarding; admins can
  link children for them via the admin panel, or backfill
  `imported: true` on affected user docs from the console.
- **`adminNotes`** (sensitive observations about children) — admin-only, correct.
- **`childNotes`** — private to the authoring parent, correct.

## Data flow summary

| Data | Who can read |
|---|---|
| Child name/class/hobbies | Parents, admins, same-class parents, class admins |
| Child photo | Same as above (Storage mirrors Firestore) |
| Unlinked child (pre-onboarding) | Imported families + admins only |
| Admin notes on a child | Admins only |
| Parent notes on a child | Authoring parent only |

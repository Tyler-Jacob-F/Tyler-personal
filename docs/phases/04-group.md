# Phase 4 · Group

Cites `docs/DESIGN.md` and `docs/DESIGN-VALUES.md`. Read both, then `docs/phases/03-face.md`,
whose "Decided during implementation" and handoff sections say what exists: the tokens,
the primitives, the nav with Writing and Group as places that lead to a one-line page,
the `me` query the shell fetches once, and the six MCP tools. This directive was written
on Oct 31, 2026 from a conversation with Tyler about who the group is and how they should
get in; its "Decided" section is that conversation, recorded so no session relitigates it.

## Why this phase is here

The small group meets at Tyler's house every week; he always hosts. Today they share a
Google sign-up sheet and a weekly questions document that lives wherever it was last
sent. This phase gives them one place: open a link, see this week's questions, take a
slot for Thursday, check the calendar, find a phone number. Six people, once a week, on
their phones, with nothing to remember.

## Gate

From the group text thread: a member opens the group link on their phone, taps their name
from the member list, and takes a slot on a real Thursday's sign-up. A co-lead, signed in
with an emailed code, sees that claim with the name on it and adds the next meeting to the
calendar. Nothing in Tyler's `me` ring is reachable from the group's side. All of it live
at tylerfuqua.com through CI.

This replaces the brief's "the small group answers a real survey": there is no question
to ask the group yet, and a sign-up with names on it is the thing they do every week.
`docs/DESIGN.md`'s table carries the change.

## Decided (Oct 31, 2026)

- **The group link is the key.** One URL, `tylerfuqua.com/g/<token>`, with a token of the
  agent-token shape (32 random bytes, base64url, stored as its hash in a `group_link`
  table, one active at a time). Opening it puts the device into the group slice for a
  year. No shared password (guessable, and it says nothing about who did what), no
  trusted-network rule (fragile, and it trusts every phone on the wifi). Tyler rotates the
  link from Admin if it leaks; the new one goes in the text thread.
- **Reading needs only the link; acting needs a name.** A device that holds the link reads
  the questions, the sign-up and the calendar. To take a slot or edit anything, the device
  claims a member: "Who are you?", a list of first names, one tap. Honor-system
  attribution, exactly what the Google Sheet gives today, and right for a church group.
- **Members are entities.** A member row has a name and whatever the member chooses to
  add: phone, address, email. Everything a member adds is visible to the whole group;
  they chose to add it. A member edits only their own row; co-leads edit any.
- **A member may be claimed on more than one device.** Unclaimed names list first; claimed
  names sit under "already on another device, tap if it is you" with one confirmation.
  Each device is recorded; a co-lead clears a member's devices when a phone is lost.
- **Co-leads are verified.** Kelly and two friends get the `colead` role: add and edit
  members, clear claims, write and edit sign-ups, events and questions, see every claim.
  (Rotating the link was on this list; Tyler took it back on Oct 31 once the door was
  built: a co-lead would never do it, so the key is the admin's alone.) That power sits on
  a real sign-in (the emailed code, once a year, the
  session already lasts), never on a claim, because anyone holding the link could tap a
  name. Co-leads cannot touch tokens, rings beyond `group`, promotion to public, or
  anything in `me`.
- **Four kinds of caller, then.** Admin (Tyler, Cognito), co-lead (Cognito, role
  `colead`), member (a device that claimed a name), guest (a device holding the link,
  unclaimed: read and claim only). Agents are unchanged, with a scope per new type.
- **The group slice is small and separate.** Group devices see routes under `/group` and
  nothing else; the API's ring check already hides `me`. Tyler and co-leads see the same
  slice from the Group place in the nav, plus the controls. Widening what trusted members
  see is a ring promotion per document, later, if ever.
- **Three new types, all `group` ring by default.** `questions` (`weekOf` date, body
  markdown), the weekly document, shown as "this week's" the way the morning page shows
  today's brief, old ones kept. `signup` (title, `date`, `slots[]` of `{ label, capacity }`,
  `closesAt`), with claims as rows in a `signup_claim` table carrying the member and the
  device. `event` (title, `date`, `time`, `place`, notes), hand-kept; the calendar is the
  list of upcoming events. The `claude` token keeps the calendar and posts the questions
  through MCP with `write:events` and `write:questions`, so the brief's scope list grows
  by two; `write:signups` waits until an agent needs it.
- **Sessions are a year** for the group role and for devices; Tyler's stays thirty days.
- **The `member` table changes shape** (migration `0007_group`): `email` becomes nullable
  (unique when present), `role` gains `colead`, and the row gains `phone`, `address`,
  `notes` and `claimed_at`. New tables: `group_link`, `device` (hashed secret, member,
  last seen), `signup_claim`. Documents and versions are untouched. Not reversible without
  a migration; this is the schema conversation.
- **The group home needs a render** before its screens are built, the way the morning
  page had one: this week's questions, the open sign-up, the next meeting, the directory,
  in the idiom of `docs/DESIGN-VALUES.md`. The schema, door and API deliverables do not
  wait on it.

## In scope

- The member model: migration, shared schemas and DTOs for members, roles, devices, the
  link, claims; repositories.
- The group door: minting and rotating the link; the `/g/:token` landing that issues a
  device token; a Lambda authorizer on `/api/group/*` that looks the device up and hands
  the handler `{ kind: 'group', deviceId, memberId?, role }`; the permission middleware
  learning the four callers.
- Members: claim, confirm a second device, edit own row, the directory; co-lead
  management (add, edit, clear devices, make co-lead); co-lead sign-in through the
  existing code flow, with the Cognito user created from Admin.
- The three types, their guides, their scopes, the sign-up claim API, the MCP tools
  seeing them through the existing generic tools.
- The group shell and screens: the link landing, "Who are you?", the group home, the
  questions, the sign-up, the calendar, the directory; the Admin side for the link, the
  members and the claims.
- Two runbooks: bringing the group in (mint the link, enter the members, port the current
  sheet, create the co-leads, verify their addresses in SES) and keeping the calendar and
  questions through MCP.
- Tests travel with code; CDK snapshots for the authorizer and routes.

## Out of scope

- Surveys, responses and the `survey` type, until there is a question to ask the group.
- Per-document share tokens: the group link is the share token for now, since anyone
  holding it may respond.
- Google federation, passkeys, SMS. The emailed code is the only real sign-in; passkeys
  come when a co-lead asks.
- SES production access: the three co-lead addresses are verified by hand instead.
- Calendar sync with Google or anyone; recurring events; reminders.
- Any member seeing Recipes, the morning page, Writing or Admin. Any public page.
- Importing the Google Sheet's history; only the current sheet's slots are entered.
- Attachments and photos on any of the new types.
- Any agent path that claims a member, edits a member, rotates the link, or promotes a
  ring. Never.

## Decisions from the brief this phase touches

- Auth and access rings: the `group` ring and role; a caller is identity plus
  permission, resolved by separate middleware; promotion is a human click. The brief's
  "members with role `group` authenticate with Cognito" becomes "members hold the group
  link and claim a name; co-leads authenticate with Cognito", flagged in the brief.
- Domain model: `member` is its own table, as planned; surveys and sign-ups keep
  responses and claims as rows, not versions; the questions, sign-up and event types are
  schemas in `packages/shared`, then a migration, then a renderer.
- Agent scopes are verbs on types; two are added for the new types.
- Verbs over views: every group screen has one thing to do (claim, take a slot, read this
  week's questions, find a number).
- Budget: a Lambda authorizer and three tables; nothing always on.

## Deliverables

Each is one PR, in this order.

- [x] **Member model.** Migration `0007_group`; shared schemas for member, role,
      device, link and claim; repositories. Repository and migration tests.
- [x] **Group door.** `group_link` mint and rotate under `/api/admin/group-link`;
      `POST /api/group/enter` exchanging the link token for a device token; the authorizer
      on `/api/group/*`; identity and permission for the four callers; the permission
      table in `permission.test.ts` extended to every caller × action × ring. Snapshot.
- [x] **Members and claims.** Claim and confirm; own-row edit; co-lead management; the
      Cognito user created when a member is made co-lead (Admin only). Handler and MSW
      tests, including that a claimed member's device cannot edit another row and that a
      guest can only read and claim.
- [x] **Types.** `questions`, `signup`, `event` schemas and guides; the claim API
      (`POST`/`DELETE /api/group/documents/{id}/claims`); scopes; MCP tests that the
      `claude` token can post an event and this week's questions. Tests.
- [ ] **Group home render.** Tyler, in a Design session: `group-home-<mode>-<width>.png`
      in `docs/design/`, plus the sign-up and the claim screen if the session has room.
      Not a PR; the next two wait on it.
- [ ] **Group shell and screens.** `/g/:token`, `/group` (the home), `/group/questions`,
      `/group/signups/:id`, `/group/calendar`, `/group/members`, "Who are you?"; the nav's
      Group place for Tyler and co-leads; the admin controls. MSW tests for each caller.
- [ ] **Runbooks.** `docs/runbooks/bring-the-group-in.md` and
      `docs/runbooks/group-calendar.md`.
- [ ] **Gate check.** A real Thursday. Record the date here.

## Ask versus decide

**Ask Tyler** (cannot be undone or is reserved by the brief):

- Any change to the `member` shape or the three tables after `0007_group` ships.
- The link's path (`/g/`) once it has been sent to the group.
- A new scope beyond `write:events` and `write:questions`.
- Anything the group-home render and the contract disagree on.

**Decide and flag in the PR description:** device-token format and storage key, how
"this week" is chosen for the questions, slot ordering, what a full slot looks like,
copy, the directory's field order, the authorizer's refusal shapes, how a cleared device
learns it was cleared.

## Decided during implementation (Oct 31, 2026)

Routine calls made while building the first four deliverables, recorded so no later
session relitigates them. Each is reversible unless marked. Built on one branch as four
commits in the directive's order; the commit messages carry what each PR description
would have. The member shape and the three tables were stated to Tyler in one message
and approved before the migration was written.

- **The shape, as shipped** (not reversible without a migration). `member`: `email`
  nullable and unique when present, `role` in admin / colead / group, `display_name`,
  `phone`, `address`, `notes`, `claimed_at` (set the first time any device claims the row,
  never moved). `group_link`: hashed token, `created_by`, `rotated_at` null while active,
  a partial unique index holding the table to one active row. `device`: hashed token,
  nullable `member_id`, `last_seen_at`, `cleared_at`. `signup_claim`: document, `slot`
  (the label), member, nullable `device_id`, unique per member per slot. Every column is
  uuid, text or timestamptz; the declared-column test covers all eight tables.
- **A claim is keyed by the slot's label.** Renaming a slot after people have claimed it
  orphans those claims; the signup guide says to add a slot rather than rename one.
  Clearing a device is soft (`cleared_at`), releasing a claim deletes the row, one claim
  per member per slot (capacity counts rows).
- **Tokens.** The link token is 43 bare base64url characters (`/g/` is its prefix); the
  device token is `keepd_` plus the same; both kept as SHA-256 like agent tokens. The
  device token is a bearer on `/api/group/*`, to be stored under `localStorage`
  `keep.device`. A device is good for a year from entering, computed in code.
- **Three doors, one set of handlers.** `/api/group/*` normalizes onto `/api/*` the way
  `/api/agent/*` does. The caller gained a kind: `{ kind: 'group', deviceId, memberId,
role: member | guest }`. `groupIdentity` re-reads the member row on each request, so a
  renamed name shows as it is now and a claim on a vanished row falls back to guest.
  `Identity.owner` is null for a device; `writerOf` refuses one a document write.
- **The group authorizer** refuses an unknown, cleared or year-old device with the
  gateway's bodiless 403; the client is to read a 403 with no `error` field on this door
  as "forget the token, show the link landing". Bearer only; the agent door's
  connector-dialog leniencies are not repeated. `POST /api/group/enter` is the one route
  with no authorizer; an unknown and a rotated link get the same 404.
- **The link** is minted and rotated by the admin alone under `/api/admin/group-link`
  (first built for co-leads too, per the Decided list; Tyler narrowed it the same day);
  rotation leaves devices in place unless `clearDevices: true`. The token appears once, as the full URL, built from
  `SITE_ORIGIN` on the Lambda because CloudFront does not forward the host.
- **Sessions are a year for co-leads** through a second Cognito app client, `group`, with
  a 365-day refresh token; the JWT authorizer accepts both clients. A refresh token's life
  is a property of the client, so one pool, two clients. The shell's co-lead sign-in uses
  its id (stack output `GroupClientId`); the deploy workflow does not read it yet.
- **Permission.** Co-leads read `group` and `public` and write or delete the group's own
  types (default ring `group`) in the `group` ring, nothing of Tyler's. Devices never
  write a document. `canClaim`: admin and co-leads for anyone (porting the sheet), a
  device for the member it holds, never a guest or an agent, only on a `group`-ring
  signup. `canMember`: co-leads everything but promotion; a device edits its own row and
  may claim another name (a shared phone); a guest reads and claims; agents nothing.
  `permission.test.ts` pins every caller × action × ring as literal tables for eight
  callers, the three group types included.
- **Members.** The directory DTO is the same for every caller (name, role, email, phone,
  address, notes, claimedAt, deviceCount). The name is editable by its owner, so unknown
  surnames get filled in. Claiming a name already on another device is 409
  `already_claimed`; the same call with `confirm: true` takes it too. Making a co-lead is
  admin only: the row first (it checks the email conflicts), then `AdminCreateUser` with a
  verified email and no welcome mail; "user exists" counts as done. The admin's row cannot
  be made a co-lead; nothing demotes one until someone needs it.
- **Types.** `weekOf` is the Thursday the questions are for; "this week's" is the newest
  questions document whose `weekOf` is no more than six days ahead of today
  (`currentQuestions` in shared), so next week's can be posted early and last week's stays
  up until the next is posted. `event.time` is `HH:MM` in the group's own clock. The claim
  API: the slot must be a current label (the 400 names them); 409 `slot_full`, 409
  `conflict` for a member already on the slot, 409 `closed` after `closesAt` for members
  while co-leads still fix the sheet. Slot order is the sheet's own.
- **MCP** is at 0.4.0: the same six tools, the instructions and `create_document` naming
  the group's types and the type's default ring. `write:signups` does not exist.
- **Infra.** Twelve Lambdas in `TheKeepApi` (group authorizer, enter, admin group link,
  members, claims joined), 49 routes, a second REQUEST authorizer, the members function
  alone granted `cognito-idp:AdminCreateUser`. `cdk synth` bundles.

## What the group-home render needs to show (for the Design session)

The shell waits on `group-home-<mode>-<width>.png`. From the API as built, the home has
these to draw from, in the idiom of `docs/DESIGN-VALUES.md`:

1. **This week's questions:** title and markdown body of the `questions` document
   `currentQuestions` picks; the `weekOf` date; a line when none qualifies.
2. **The open sign-up:** the `signup` for the coming Thursday (its `date`); each slot in
   the sheet's order with its label, the names on it (`memberName` from the claims list,
   in claim order) and empty places up to capacity; a full slot; what "closes at" looks
   like; the one accented control for the viewer's own action (take a slot, or release
   the one they hold). A guest sees the sheet but the action says "tap your name first".
3. **The next meeting:** the nearest upcoming `event` (title, date, time, place, notes)
   and a link to the calendar.
4. **The directory:** names with phone, address, notes, in that order (decided); the
   viewer's own row marked and editable; co-leads marked.

Also, if the session has room: the claim screen ("Who are you?": unclaimed names first,
then "already on another device, tap if it is you" with its one confirmation) and the link
landing (`/g/<token>`: one line and one button, and the state for a dead link). The
render wins on layout, the contract on values; a real conflict is Tyler's.

Decided without the render, for the shell to carry unless the render says otherwise:
device token in `localStorage` under `keep.device`; the group shell has no nav of The
Keep's, only its own places (Home, Questions, Sign-up, Calendar, Members); Tyler and
co-leads see the same slice from the Group place with the controls added.

## Handoff (Oct 31, 2026)

What a fresh session should know that the files alone do not say.

- **State of the world.** The first four deliverables are built and tested on the branch
  `claude/youthful-bohr-idvmy2`; nothing is deployed until it merges. The suite is
  shared 44, infra 28, web 101, api 183; `cdk synth` bundles. The web app is untouched
  except that it typechecks against the wider caller and the five types: the nav's Group
  place still leads to the "not yet" page.
- **The shell and screens wait on the render.** When it lands, the shell deliverable
  builds `/g/:token`, `/group`, `/group/questions`, `/group/signups/:id`,
  `/group/calendar`, `/group/members` and "Who are you?" against the API above, plus the
  Admin side (the link, members, claims) and the co-lead sign-in using the `group`
  Cognito client. The deploy workflow then needs to pass `GroupClientId` to the web
  build. The Stack page's copy (six tools, twenty-six routes, seven Lambdas) is stale
  and should be updated in the same commit.
- **Only Tyler does,** once it is live: mint the link from Admin (and rotate it, ever); enter the seventeen
  names (the sheet's slots too) through the admin screens or the runbook; make Kelly,
  Cam and Meg co-leads (which creates their Cognito users) and verify their addresses in
  SES; paste the link into the group thread; the gate.
- **Loose ends worth knowing.** Member emails are stored lowercased and compared
  lowercased. `write:signups` does not exist, by the directive. No route demotes a
  co-lead or deletes a member; both are conversations first. The runbooks deliverable is
  not started.

## Handoff from the directive (Oct 31, 2026, before the work)

- Start from `main`; Phase 3's handoff describes the tokens, the nav and the six tools.
  The nav's Group place leads to the "not yet" page until the shell deliverable lands.
- Only Tyler does: the Design session for the group home; the member names and the
  current sheet's slots; verifying the three co-lead addresses in SES (sandbox mode sends
  only to verified recipients); pasting the link into the group thread; the gate.
- Phase 3 left no loose ends; its gate, Lighthouse included, is recorded in
  `03-face.md`.

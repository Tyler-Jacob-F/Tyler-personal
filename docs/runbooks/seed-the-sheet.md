# Runbook · seed the sign-ups from the Google Sheet

A one-time port of the group's Google sign-up sheet, history and all, into The Keep as
`signup` documents with names on their slots, done by Duet through MCP. Decided Oct 31,
2026 (the directive had put the Sheet's history out of scope; Tyler brought it back in once
the phase was live). It runs once; after it, the Sheet is retired and the group signs up
through the link.

Two scopes exist for this and nothing else: `write:signups` (make a sheet, put a name on a
slot) and `read:members` (the directory, so a name can be matched to a row). They go onto
the `claude` token for the evening and come off it after. No agent can take a name off a
slot, edit a member, or claim a name on a device; those stay people's.

## Before

1. The members are entered (`bring-the-group-in.md`, step 2), spelled the way the Sheet
   spells them where you can. Duet matches names to rows and stops on any it cannot.
2. **Tokens → `claude` → Edit scopes**: add `write:signups` and `read:members`.
3. Decide the horizon: how far back to port. Every ported week is a sheet in "Other
   sign-ups". Three months is plenty of history for a dessert rota; a year is noise.
4. Open the Sheet in Drive so Duet can read it through the Google Drive connector, or
   export it as CSV and attach it to the conversation.

## The session

In Duet or Cowork, with the "keep" connector:

```text
Port the small group's sign-up sheet into The Keep through the "keep" MCP server. Read the
list_members and claim_slot tool descriptions first; they are the rules.

1. Read the sheet <link or attachment>. Each week is a Thursday with slots (Main, Salad,
   Bread, Dessert, Drinks or whatever that week had) and the names on them. Port weeks from
   <horizon date> onward, oldest first, the current week last.
2. list_members. Match every name on the sheet to a member. Show me the mapping as a
   table before anything else, with any name that matches no row or two rows marked; I
   will tell you what to do with those. Do not guess.
3. After I say go, for each week: list_documents with type signup to make sure it is not
   already there; then create_document with type signup, title in the sheet's words
   ("Dinner at Tyler and Kelly's"), date the Thursday (YYYY-MM-DD), slots exactly as that
   week had them with their capacities (a slot with two names has capacity 2 at least),
   closesAt that Thursday at 17:00 Eastern as an ISO timestamp, summary "from the Google
   Sheet"; then claim_slot once per name on each slot, with the member id from step 2.
4. If a call is refused, the message says why (slot_full, conflict, no such slot); fix the
   call once and retry, then stop and show me.
5. Finish with a table: week, slots, names, and anything you could not place.
```

## After

1. **Tokens → `claude` → Edit scopes**: remove `write:signups` and `read:members`. The
   token keeps `read:documents`, `write:recipes`, `write:briefs`, `write:events`,
   `write:questions`.
2. Open https://tylerfuqua.com/group/signups: the coming Thursday's sheet on top, the
   ported weeks under "Other sign-ups". Admin → Activity shows each sheet Duet made as a
   version row; the claims themselves carry no author and show on the sheets.
3. Tell the group the Sheet is retired, with the link (`bring-the-group-in.md`, step 7).

## If it goes wrong

A wrong name on a slot: you or a co-lead take it off with the × beside it on the sheet and
put the right one on with "Add a name…". A whole week wrong: Edit → Delete on that sheet,
and run the session again for that week alone. Nothing here touches the members, the link
or the devices.

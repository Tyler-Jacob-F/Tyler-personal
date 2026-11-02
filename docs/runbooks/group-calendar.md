# Runbook · the calendar and the week's guide through MCP

The `claude` token keeps the group's calendar and posts the week's guide
(docs/phases/04-group.md "Three new types", "The refresh"). Day to day it cannot touch a sign-up, a
member, a claim or the link; the two scopes that reach sheets and the directory exist for
the one-time seed from the Google Sheet (`docs/runbooks/seed-the-sheet.md`) and come off
the token after. Weekly sheets are made by hand or by a co-lead
(`docs/runbooks/bring-the-group-in.md`, step 3).

## One-time setup (Tyler)

At https://tylerfuqua.com/admin/tokens, **Edit scopes** on `claude` and add
`write:events` and `write:guides` (`write:questions` until Nov 2; migration 0008 renamed
it on any token that had it). The change reaches every surface holding the token (Cowork,
Duet, Claude Code on the web) on its next request; nothing to reconnect.

## What the types are

Both start in the `group` ring, where every member reads them; neither can be promoted
by an agent.

- **`event`**: frontmatter `{ title, date, time?, place?, notes? }`. `date` is
  `YYYY-MM-DD`; `time` is `HH:MM` in Richmond's own clock, left out for an all-day note;
  `place` and `notes` are one line each. The body is optional longer markdown. One
  document per meeting; a moved meeting gets a new version, not a twin. The calendar is
  the list of upcoming events, soonest first.
- **`guide`**: frontmatter `{ title, weekOf, series?, week?, opening, readings,
reflection?, questions, closing, source? }`: what changes week to week in Redeemer's
  printed guide and nothing that repeats. `weekOf` is the Thursday; `opening` and
  `closing` are lists of `{ voice, text }` with `voice` "leader" or "people", in the order
  said, a collect being one leader line ending "Amen."; `readings` are references as the
  guide prints them ("Ephesians 1:15–23"), which the page resolves to text; `questions`
  are plain strings without numbers; `source` is the credit line. The body is unused.
  One document per week; the home shows the newest whose `weekOf` is within six days
  ahead, so next week's can be posted early without taking the screen until the week
  turns. The collect before the reading, the songbook line, the Lord's Prayer and the
  final collect live on the `liturgy` document, which only a person edits (Group → Guide).

The `create_document` and `create_version` tool descriptions carry the same guides.

## Prompts

In Cowork, Duet, or Claude Code with the `keep` server added
(`docs/runbooks/import-recipes.md`, section 2), as the week's work:

**Add the next meeting**

```text
Through the "keep" MCP server, add next Thursday's small group to the calendar:
list_documents with type event first; if that Thursday already has one, stop and show
it to me. Otherwise create_document with type event, title "Small group", the date,
time 18:30, place "Tyler and Kelly's", and notes from what I tell you (one line).
Show me what you created.
```

**Move or change a meeting**

```text
Through the "keep" MCP server, find the event for <date> with list_documents (type
event) and get_document. Save a new version with create_version carrying the complete
frontmatter and body, changed only as I say (<what changes>), and a one-line summary
such as "moved to 7:00". Show me the version you saved.
```

**Post this week's guide from the printed one**

```text
Through the "keep" MCP server, post the small group's guide for Thursday <date> from the
attached PDF. Read the create_document description for the guide type first; it is the
schema. list_documents with type guide; if a document with that weekOf exists, add a
version to it with create_version instead of creating another. Take from the PDF only
what changes week to week: the series and week number, the title, the opening prayer
as leader/people lines in order, the scripture references exactly as printed, the
reflection sentence, the questions as plain strings without numbers, the closing
prayer's leader/people lines and collect in order, and the credit line as source. Leave
out the collect before the reading, the songbook line, the Lord's Prayer and the final
collect: those are the fixed liturgy and the page adds them. Body empty. Show me the
frontmatter before you post it, then what you created.
```

## Checking

The group's home at https://tylerfuqua.com/group shows the next meeting and this week's
guide as the group sees them, each reading resolved to text; Admin → Activity lists what
the token wrote, with a version row each.

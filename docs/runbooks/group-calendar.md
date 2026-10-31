# Runbook · the calendar and the questions through MCP

The `claude` token keeps the group's calendar and posts the weekly questions
(docs/phases/04-group.md "Three new types"). It cannot touch a sign-up, a member, a claim
or the link: no scope exists for those, and none will until an agent needs one. Sheets are
made by hand (`docs/runbooks/bring-the-group-in.md`, step 3).

## One-time setup (Tyler)

At https://tylerfuqua.com/admin/tokens, **Edit scopes** on `claude` and add
`write:events` and `write:questions`. The change reaches every surface holding the token
(Cowork, Duet, Claude Code on the web) on its next request; nothing to reconnect.

## What the types are

Both start in the `group` ring, where every member reads them; neither can be promoted
by an agent.

- **`event`**: frontmatter `{ title, date, time?, place?, notes? }`. `date` is
  `YYYY-MM-DD`; `time` is `HH:MM` in Richmond's own clock, left out for an all-day note;
  `place` and `notes` are one line each. The body is optional longer markdown. One
  document per meeting; a moved meeting gets a new version, not a twin. The calendar is
  the list of upcoming events, soonest first.
- **`questions`**: frontmatter `{ weekOf, title? }` with `weekOf` the Thursday the
  questions are for; the body is the questions in markdown, a short lead and a numbered
  list. The title defaults to "Questions for <weekOf>". One document per week; the home
  shows the newest whose `weekOf` is within six days ahead, so next week's can be posted
  early without taking the screen until the week turns.

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

**Post this week's questions**

```text
Through the "keep" MCP server, post this week's questions for Thursday <date>:
list_documents with type questions first; if a document with that weekOf exists, add a
version to it with create_version instead of creating another. The body is markdown: a
two-sentence lead on the passage, then a numbered list of three or four questions, open
rather than yes-or-no. Use create_document with type questions and frontmatter
{ weekOf: "<date>" } (the title can be left out). Here are my notes on the passage:
<notes>. Show me the questions before and after you post them.
```

## Checking

The group's home at https://tylerfuqua.com/group shows the next meeting and this week's
questions as the group sees them; Admin → Activity lists what the token wrote, with a
version row each.

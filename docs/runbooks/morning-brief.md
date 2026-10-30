# Runbook · the morning brief

The "always on" producer for the `brief` type is a scheduled Claude Code task holding the
`brief-writer` token (`write:briefs`). Nothing in this runbook is code: the prompt below is
the whole program, and the schedule is a setting on claude.ai. Duet takes over the same
token the day it can present a bearer header to a custom connector
(`docs/phases/02-agents.md`, "Duet arrived Oct 30").

## What a brief is

A `brief` document: `date` (the day it is for, `YYYY-MM-DD`), `sections[]` of
`{ heading, body }` with markdown bodies, an optional `title` (defaults to
`Brief for <date>`), and an optional lead paragraph in the version body. Default ring `me`.
The logged-in home at https://tylerfuqua.com shows the brief dated today; if there is none,
the latest one, labelled as such. One brief per day: a second run the same day adds a
version to it rather than a second document.

## One-time setup (Tyler)

1. **Token.** At https://tylerfuqua.com/admin/tokens create `brief-writer` with the single
   scope `write:briefs` (and `read:documents` if the writer should check for an existing
   brief first; the prompt below handles both). Copy the secret; it is shown once.
2. **Environment.** In Claude Code on the web (claude.ai/code), create an environment named
   `the-keep-brief`. Add one environment secret, `KEEP_BRIEF_TOKEN`, with the secret. Enable
   the connectors the brief should draw on (Google Calendar and Gmail are the two that earn
   a section; add others only when they would). The environment needs no repository: the
   writer posts over HTTPS and never touches this code.
3. **Scheduled task.** Create a scheduled task in that environment: fresh session on each
   firing, daily, `CRON_TZ=America/New_York 10 6 * * *` (06:10 Eastern, before the
   06:00–09:00 Pacific window the platform warns is busy). Paste the prompt below verbatim.
   Push notification on completion if you want the phone to know.

Decided and flagged: the writer posts through the REST agent door with `curl`, not through
the MCP server. A scheduled task starts from nothing, so a one-line HTTPS call with the
token from the environment is the shortest path with the fewest moving parts; the MCP server
is the door for interactive sessions. Both run the same validation.

## The prompt

```text
You write Tyler's morning brief for The Keep. Today is the date in America/New_York.

1. Gather, briefly: today's calendar (times, titles, who with), unanswered email that is
   waiting on Tyler (sender, subject, one line on what it needs), and anything due or
   overdue you can see. Do not include newsletters, receipts or notifications.
2. Write the brief as JSON for the API below. Sections, in this order, each with a markdown
   body of a few lines; leave a section out when it would be empty:
   - "Today": the calendar as a list, "9:00 standup · 14:00 dentist".
   - "Waiting on you": one line per thread, newest first, at most eight.
   - "Due soon": tasks or dates in the next week.
   - "A line for the day": one sentence, plain, no quotation marks, no motivational tone.
   The version body is one lead sentence on the shape of the day.
3. Check whether today's brief exists:
   curl -sS --max-time 60 -H "Authorization: Bearer $KEEP_BRIEF_TOKEN" \
     "https://tylerfuqua.com/api/agent/documents?type=brief&limit=5"
   If an item's version.frontmatter.date equals today, POST a new version to it:
   curl -sS --max-time 60 -X POST -H "Authorization: Bearer $KEEP_BRIEF_TOKEN" \
     -H "content-type: application/json" \
     "https://tylerfuqua.com/api/agent/documents/<id>/versions" \
     -d '{"frontmatter": {...}, "body": "...", "summary": "updated brief"}'
   Otherwise create it:
   curl -sS --max-time 60 -X POST -H "Authorization: Bearer $KEEP_BRIEF_TOKEN" \
     -H "content-type: application/json" "https://tylerfuqua.com/api/agent/documents" \
     -d '{"type": "brief", "frontmatter": {"date": "YYYY-MM-DD", "sections": [...]},
          "body": "...", "summary": "morning brief"}'
   Write the JSON to a file and pass it with -d @file so quoting cannot bite.
4. The response is 201 with the document (or version). A 400 names the field that is
   wrong: fix it and post again. A 401 means the token is revoked: stop and say so. A 5xx
   or a timeout: wait thirty seconds and try once more (the database wakes from a pause on
   the first request).
5. Reply with one line: the date, the section headings, and the document id.
```

The first request after the database has paused can take up to a minute; `--max-time 60`
covers it, and the retry in step 4 covers the rare longer one.

## Checking it worked

- https://tylerfuqua.com shows "Today's brief" with the sections.
- https://tylerfuqua.com/admin/activity lists the version under `brief-writer`.
- The Tokens screen shows `brief-writer` as last used this morning.
- CloudWatch, log group `/aws/lambda/TheKeepApi-DocumentsFunction…`: a `document created`
  line with `door: agent`.

## When it misbehaves

- **Two briefs for one day.** The writer skipped step 3. Delete the extra from the home
  screen's recent list (it is a soft delete; the versions stay).
- **A section is wrong.** Edit nothing by hand: adjust the prompt and let tomorrow's run
  or a manual firing add a version. Versions are the point.
- **Revoke and reissue.** On the Tokens screen revoke `brief-writer`, create it again with
  the same scope, and replace `KEEP_BRIEF_TOKEN` in the environment. A revoked token stops
  working within a minute.

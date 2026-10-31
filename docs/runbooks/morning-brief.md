# Runbook · the morning brief

**Duet writes the brief** (checked Oct 30): it reaches the MCP server through the account's
custom connector, the same one Cowork uses, with the `claude` token, which carries
`write:briefs`. Ask Duet for the brief as part of its morning routine; the type guide in
the `create_document` tool description tells it the shape, and the server's instructions
tell it to add a version to today's brief rather than a second document. Nothing below is
needed while that works.

The rest of this runbook is the fallback: a scheduled Claude Code task holding a
`brief-writer` token (`write:briefs`), for the day Duet cannot run or the connector is
down. Nothing in it is code: the prompt below is the whole program, and the schedule is a
setting on claude.ai.

## What a brief is

A `brief` document: `date` (the day it is for, `YYYY-MM-DD`), `sections[]` of
`{ heading, body }` with markdown bodies, an optional `title` (defaults to
`Brief for <date>`), and an optional lead paragraph in the version body. Default ring `me`.
The logged-in home at https://tylerfuqua.com is the morning page: it renders the brief
dated today as its four parts (the day line, the Office, the brief, the day's shape); if
there is none, the latest one, with a line saying whose morning it was. One brief per day: a second run the same day adds a
version to it rather than a second document.

## One-time setup (Tyler)

1. **Token.** At https://tylerfuqua.com/admin/tokens create `brief-writer` with the single
   scope `write:briefs` (and `read:documents` if the writer should check for an existing
   brief first; the prompt below handles both). Copy the secret; it is shown once.
2. **Environment.** In Claude Code on the web (claude.ai/code), create an environment named
   `the-keep-brief` on this repository (so a session can read this runbook; nothing in the
   code is needed to post). Give it the token as a **network secret**, which is what the
   docs recommend for an API key: name `KEEP_BRIEF_TOKEN`, allowed website
   `tylerfuqua.com`, custom header `Authorization` with prefix `Bearer`. The agent proxy
   adds the header to requests for that host after they leave the session, so the secret
   never sits in the VM. Enable the connectors the brief should draw on (Google Calendar
   and Gmail are the two that earn a section; add others only when they would).
3. **Scheduled task.** Create a scheduled task in that environment: fresh session on each
   firing, daily, `CRON_TZ=America/New_York 10 6 * * *` (06:10 Eastern, before the
   06:00–09:00 Pacific window the platform warns is busy). Paste the prompt below verbatim.
   Push notification on completion if you want the phone to know.
4. **First run, by hand.** Fire the task once and watch it. If the POST comes back 401,
   the proxy did not add the header on that request: fall back to an environment variable
   named `KEEP_BRIEF_TOKEN` holding the secret, and the prompt's `curl` lines add the
   header themselves. (The docs describe network secrets for API hosts in general and say
   nothing about this site in particular, so the first run is the test.)

Decided and flagged: the writer posts through the REST agent door with `curl`, not through
the MCP server. A scheduled task starts from nothing, so a one-line HTTPS call with the
token supplied by the environment is the shortest path with the fewest moving parts; the
MCP server is the door for interactive sessions. Both run the same validation. Scheduled
tasks on claude.ai are a research preview; if they go away, the same prompt runs anywhere
`claude -p` runs on a cron.

## The prompt

```text
You write Tyler's morning brief for The Keep. Today is the date in America/New_York.

1. Gather, briefly: today's calendar (times, titles, who with), unanswered email that is
   waiting on Tyler (sender, subject, one line on what it needs), and anything due or
   overdue you can see. Do not include newsletters, receipts or notifications.
2. Write the brief as JSON for the API below. The morning page reads four sections by
   heading, in this order, each with a markdown body; leave one out when it would be empty:
   - "The day": one line, "All Hallows' Eve · Season after Pentecost · Sunrise 7:36 ·
     52° and clear" (liturgical day and season from the lectionary you carry, sunrise and
     weather for Richmond).
   - "Office": the office inline with the day's readings, in markdown. A run later in
     the day names the office in the heading, "Office · Evening Prayer", and the page's
     eyebrow follows; a bare "Office" reads as Morning Prayer. The opening
     sentence in italics with its reference, the versicle and response, then each part
     under a "#### Label" line ("#### Venite · Psalm 95", "#### First Lesson ·
     Ecclesiasticus 44:1–15", "#### The Collect"), the collect last. The page shows it
     whole, so include the text, not a link.
   - "The brief": at most three short paragraphs, the things that matter today, plain,
     no bullets, no counts, nothing from the inbox unless a reply is the day's work.
   - "Today": a list, one line each, "9:00 · Pancakes with the kids"; after the timed
     lines, "Thu · Small group at ours" and "Dinner · <recipe title> · weeknight · 40 min"
     (link the recipe as [title](/recipes/<id>) when one is planned; list_documents or the
     search endpoint finds the id).
   Anything under another heading folds into "The brief" and counts toward its three.
   The version body is one lead sentence on the shape of the day.
3. Authentication: the environment adds "Authorization: Bearer …" to requests for
   tylerfuqua.com itself. Only if the environment variable KEEP_BRIEF_TOKEN is set, add
   -H "Authorization: Bearer $KEEP_BRIEF_TOKEN" to each curl below; never print its value.
   Check whether today's brief exists:
   curl -sS --max-time 60 \
     "https://tylerfuqua.com/api/agent/documents?type=brief&limit=5"
   If an item's version.frontmatter.date equals today, POST a new version to it:
   curl -sS --max-time 60 -X POST -H "content-type: application/json" \
     "https://tylerfuqua.com/api/agent/documents/<id>/versions" \
     -d '{"frontmatter": {...}, "body": "...", "summary": "updated brief"}'
   Otherwise create it:
   curl -sS --max-time 60 -X POST -H "content-type: application/json" \
     "https://tylerfuqua.com/api/agent/documents" \
     -d '{"type": "brief", "frontmatter": {"date": "YYYY-MM-DD", "sections": [...]},
          "body": "...", "summary": "morning brief"}'
   Write the JSON to a file and pass it with -d @file so quoting cannot bite.
4. The response is 201 with the document (or version). A 400 names the field that is
   wrong: fix it and post again. A 401 means the token is revoked: stop and say so. A 500
   {"message":"Internal Server Error"} or a timeout on the first call means the database
   was paused and is waking: wait thirty seconds and repeat the call, up to three times.
5. Reply with one line: the date, the section headings, and the document id.
```

The first request after the database has paused can take up to a minute. At 06:10 it will
always have paused, so the first call of every run is the slow one: it may succeed slowly,
or fail with a 500 when the authorizer's 25 seconds run out, and the retry in step 4 is
what makes the run reliable.

## Asking Duet

Once, in Duet: "Each morning, post my brief to The Keep as a `brief` document with the
sections the create_document guide names: The day, Office (Morning Prayer with the
readings), The brief (at most three paragraphs) and Today (one line per entry,
`time · what`), with a one-sentence lead as the body. One brief per day: if today's exists,
add a version." Then check the home screen the next morning. The Activity screen lists it
under `claude`. The lectionary source is still the brief's open question: Duet carries the
readings as the Office section until a direct feed earns its place (Phase 6).

## Checking it worked

- https://tylerfuqua.com shows the morning page with the day line, Morning Prayer and the
  day's shape from the brief.
- https://tylerfuqua.com/admin/activity lists the version under `brief-writer`.
- The Tokens screen shows `brief-writer` as last used this morning.
- CloudWatch, log group `/aws/lambda/TheKeepApi-DocumentsFunction…`: a `document created`
  line with `door: agent`.

## When it misbehaves

- **Two briefs for one day.** The writer skipped step 3. Delete the extra from the home
  screen's recent list (it is a soft delete; the versions stay).
- **A section is wrong.** Edit nothing by hand: adjust the prompt and let tomorrow's run
  or a manual firing add a version. Versions are the point.
- **The token lacks `write:briefs`.** Edit scopes on its row on the Tokens screen; no
  reissue, no reconnect, effective on the next request.
- **Revoke and reissue** only when a secret has leaked: on the Tokens screen revoke the
  token, create it again, and replace the secret where it lives. A revoked token stops
  working at once.

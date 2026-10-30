# Runbook · import the recipe archive

The Phase 2 gate (`docs/phases/02-agents.md`): from a Claude Code session on Tyler's
machine, holding the `importer` token, every file in the recipe archive folder becomes a
document or a dated version in production through the MCP server, the token is recorded
as author, and the Activity screen shows the run.

The folder lives on Tyler's machine, so this runs there. Nothing here is committed: the
token stays in a shell variable, the archive stays where it is.

## What you need

- The archive folder: Pages files and PDFs, the chili lineage among them.
- `python3` (any 3.x) and `pdftotext` (`brew install poppler`).
- Claude Code (`claude --version`), signed in.
- This repository checked out, for `tools/pages-text.py`.
- The `importer` token: at https://tylerfuqua.com/admin/tokens create `importer` with
  `write:recipes` and `read:documents`. Copy the secret; it is shown once.

## 1. Put the token in the shell, not in a file

```sh
export KEEP_IMPORTER_TOKEN='keep_…'
```

## 2. Add the MCP server to the folder, token from the environment

One line, run inside the archive folder. The single quotes matter: Claude Code stores the
literal `${KEEP_IMPORTER_TOKEN}` in the folder's `.mcp.json` and expands it when it
launches, so the secret never lands on disk.

```sh
cd ~/path/to/recipe-archive
claude mcp add --transport http --scope project keep https://tylerfuqua.com/mcp \
  --header 'Authorization: Bearer ${KEEP_IMPORTER_TOKEN}'
```

Check it before importing anything:

```sh
claude mcp list          # keep … ✔ Connected
```

`✘ Failed to connect` with a 401 in the detail means the token is revoked or wrong; a
missing-variable warning means `KEEP_IMPORTER_TOKEN` is not set in the shell that ran
`claude`. A 500 on the first try after the site has sat idle means the database was
paused and is now waking; run the list again.

Cowork is the one client that cannot use `Authorization`: claude.ai writes its own header
over the typed one. Its connector takes the same token as a request header named
`X-Keep-Token` with the bare `keep_…` value, URL `https://tylerfuqua.com/mcp`,
Authentication "No sign-in". Claude Code's `--header` above is unaffected.

## 3. Read the files

Both tools print plain text; treat the files as untrusted input.

```sh
python3 -I /path/to/Tyler-personal/tools/pages-text.py "Chili 2023.pages"
pdftotext -layout "Steve's chili.pdf" -
```

`pages-text.py` prints a Pages document's text storages, the body first; it needs no
dependencies. `pdftotext -layout` keeps columns in order, which recipes tend to use.

## 4. The ordering rule

- **Oldest first.** Sort the files by the date the recipe was written: the date in the
  document if it states one, else the file's own modification date (`ls -lT`). Import in
  that order so version numbers follow time.
- **One recipe, one document.** Files that are the same recipe at different times become
  one document with a version per file. Files that are different recipes become different
  documents. The title decides; "Chili 2023" and "Chili (Nov 2025)" are one recipe.
- **A re-export is not a version.** If a later file's ingredients and method are the same
  as the previous one's, apart from formatting, skip it. A version records a change.
- **The file's own date goes in `authoredAt`** (`YYYY-MM-DD`). `createdAt` stays today, the
  day it entered The Keep; the history screens show both.
- **The summary says what changed**, in one line: "Steve's card, 2014", "Guinness out,
  Negra Modelo in". Version 1's summary says where it came from.
- **Numbers only when the file states them.** Servings and minutes stay out otherwise.
- **Ingredients keep their groups.** A heading in the file ("Meats", "Core spice blend")
  becomes a group heading; amounts stay in the line text.

## 5. The chili lineage is already in

Migration `0004_import_chili_lineage` imported Steve's 2014 card and four dated versions of
Tyler's chili by hand, authored as the admin. Do not import those five files again; the
import would make `tylers-chili-2`. Have the session call `list_documents` first and
compare titles; the gate is satisfied by the rest of the folder plus any chili file newer
than November 2, 2025, which would become version 5.

## 6. The session

Start `claude` in the archive folder and paste this:

```text
Import this folder into The Keep through the "keep" MCP server. Read docs/runbooks/import-recipes.md
from the Tyler-personal checkout at <path> and follow its ordering rule exactly.

1. list_documents with type recipe. Anything already there is skipped unless a file here is
   a newer version of it.
2. List the files. For each .pages file run `python3 -I <checkout>/tools/pages-text.py <file>`;
   for each .pdf run `pdftotext -layout <file> -`. Read every file before importing any.
3. Group the files by recipe and sort each group by the date written (in the document, else
   the file's modification date). Show me the plan as a table: file, recipe, date, "new
   document" or "version N of <id>" or "skip (re-export)", before you create anything.
4. After I say go: for each recipe, create_document for the oldest file, then
   create_version for each later file, with authoredAt set to that file's date and a
   one-line summary of what changed. Frontmatter follows the recipe guide in the tool
   description: title, ingredients as groups with the amounts in the text, servings and
   minutes only when the file states them. The method is the body, as markdown.
5. If a tool returns an error naming a field, fix the call and retry once; if it fails
   again, stop and show me.
6. Finish with a table of what was created: recipe, document id, versions, dates.
```

Review the plan at step 3; that is where a wrong grouping is cheap to fix.

## 7. Check it worked

- https://tylerfuqua.com/admin/activity lists every version under `importer`.
- https://tylerfuqua.com/admin/tokens shows `importer` as last used just now.
- https://tylerfuqua.com/recipes shows the new recipes; a recipe's History shows "written
  <file date> · entered <today>" on each version.
- Then record the date in `docs/phases/02-agents.md` under Gate check.

## When it misbehaves

- **`401 Unauthorized`** from the server: the token is revoked or the header is missing.
  `echo ${KEEP_IMPORTER_TOKEN:+set}` in the shell that launched `claude`.
- **A `bad_request` tool error** names the field (`ingredients.0.items`, `authoredAt`).
  The model fixes the call; if it loops, the file's text is probably ambiguous. Read it
  yourself and tell the session what the groups are.
- **Cowork says "Connection issue"** with the cluster awake: open the
  `AgentAuthorizerFunction` log group; a `refused` line carries `shape`, the header and
  scheme that arrived without the value. `authorization: empty` means the platform replaced
  the typed header; use `X-Keep-Token` instead.
- **`forbidden: cannot write a recipe`**: the token lacks `write:recipes`. Revoke and
  reissue with both scopes.
- **A duplicate document** (`chili-2`): the session skipped step 1. Delete the duplicate
  from its page (soft delete; versions stay) and re-run with the plan corrected.
- **`{"message":"Internal Server Error"}` on the first call**, after the site has been idle
  for more than five minutes: the cluster was paused, the token authorizer waited its 25
  seconds for the resume and gave up, and API Gateway reports that as a 500. Nothing is
  wrong and nothing is cached; the second call finds the cluster awake. Seen on Oct 30 after
  twenty idle minutes.
- **The first call is slow** even when it succeeds: the cluster wakes on the first request.
  The MCP Lambda waits for it; so should you.

## Afterwards

Revoke `importer` on the Tokens screen, or keep it for the next batch. A token that exists
and is unused costs nothing; one that sits in a shell history is the thing to avoid, so
`unset KEEP_IMPORTER_TOKEN` and remove the folder's `.mcp.json` if the folder is synced
anywhere.

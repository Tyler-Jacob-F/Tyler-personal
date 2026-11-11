# Runbook · the ESV and the NIV

The readings on the group's guide and the morning page come from `GET /api/passages`
(docs/phases/04-group.md "Translations"). Eight public-domain texts come from
bible-api.com with no key. Two licensed ones need a key each, which lives in SSM and
nowhere else: the ESV from Crossway, the NIV from API.Bible. Until a key is in place the
page says "The ESV is not set up yet" where the reading would be, and everything else
works. Nothing here is code: two sign-ups and two `put-parameter` calls.

## What each licence asks

Both are free for a personal, non-commercial site, which this is. Both can be revoked by
the publisher, so neither is the default anywhere: the King James is.

- **ESV** (https://api.esv.org/). One key per site. 60 requests a minute, 1,000 an hour,
  5,000 a day; at most 500 verses a request. The text must be shown with "ESV" and a link to
  esv.org, which the page puts under every reading. No more than 500 verses may be stored
  locally, which is why passages live only in the Lambda's memory for its life and never in
  the database or the browser past a day.
- **NIV** through API.Bible (https://docs.api.bible/). The Starter plan is free for
  non-commercial use, 5,000 calls a day, and lets you pick up to three licensed Bibles;
  the NIV is one. The text must carry Biblica's copyright line, which the answer includes
  and the page shows under the reading, and the page must load their small fair-use
  script and report each passage's token, which `lib/fums.ts` does the first time a
  passage of theirs is on a page. The script comes from `cdn.scripture.api.bible`; nothing
  else on the site loads a third-party script.

A Thursday night is a dozen phones reading two passages each; the Lambda keeps what it
has fetched, so the day's count is in the tens, not the hundreds.

## One-time setup (Tyler)

1. **Crossway.** Sign up at https://api.esv.org/, create an application (the site's name
   and `https://tylerfuqua.com`), copy the key.
2. **API.Bible.** Sign up at https://api.bible/, Starter plan, create an application,
   copy the key. In the dashboard choose the NIV as one of the three licensed Bibles.
   Then confirm its id: `GET https://api.scripture.api.bible/v1/bibles` with the
   `api-key` header lists what the key may read; find the New International Version
   and compare its `id` with `apiBibleIds.niv` in `infra/lib/config.ts`. If they differ,
   change the config (it reaches the Lambda as `API_BIBLE_NIV_ID` on the next deploy).
3. **The parameters.** With the deploy profile, in us-east-1:

   ```sh
   aws ssm put-parameter --name /the-keep/scripture/esv-key \
     --type SecureString --value '<the Crossway key>'
   aws ssm put-parameter --name /the-keep/scripture/api-bible-key \
     --type SecureString --value '<the API.Bible key>'
   ```

   Default SSM encryption; the passages Lambda may read `/the-keep/scripture/*` and
   nothing else may. Never paste a key into chat, a commit, a CDK output or a log.

4. **Pick it up.** The Lambda reads the parameters once per life. After the first
   `put-parameter`, wait for the next cold start or redeploy; a passage in the ESV then
   answers 200. Until then it answers 503 `translation_unavailable` and the page says so.

## Checking it worked

- https://tylerfuqua.com/group/guide: choose "English Standard Version" under "Read in";
  the readings change and "English Standard Version (ESV), © Crossway" sits under each,
  linked to esv.org. Choose "New International Version"; Biblica's line sits under each.
- CloudWatch, log group `/aws/lambda/TheKeepApi-PassagesFunction…`: `handled` lines with
  status 200; a `refused` with `translation_unavailable` means the key is missing or
  refused.

## When it misbehaves

- **503 after the key is in place.** The Lambda is still on a life that read SSM before
  the parameter existed; wait for a cold start or redeploy. If it persists, the key was
  refused: check it in the publisher's dashboard.
- **A reading says it could not be found.** The reference is one the source does not
  read (a book it lacks, or an odd spelling). Write it as a Bible gives it, book, chapter,
  verses. A reading from the Apocrypha is served from the Douay-Rheims whatever the
  reader chose, and the page says so under it; the brief carries the text for those too.
- **Rotate a key** by creating a new one in the publisher's dashboard, `put-parameter
--overwrite`, and deleting the old one there. Effective on the next cold start.

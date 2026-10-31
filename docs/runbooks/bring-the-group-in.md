# Runbook · bring the group in

Once the Group phase is live at https://tylerfuqua.com (docs/phases/04-group.md), this is
the order that gets seventeen people from the Google sheet to the group link, in one
evening. Only Tyler does the first five steps; the co-leads do the sixth; the group does
the last. Names and the current sheet's slots are data: they enter here, through the
screens, never through a migration.

## 1. Mint the link

Signed in as yourself, open **Group → Members**. The panel at the top, "The group link",
is yours alone. Click **Mint the link**. The URL (`https://tylerfuqua.com/g/<43
characters>`) appears once; copy it somewhere safe for step 7. The page keeps only its
hash from now on; if you lose the URL, rotate and send the new one.

## 2. Enter the members

**Group → Members → Add a member**, one at a time, a name each. Phone, address and notes
are theirs to add from their own phones; leave them blank unless you already know them
and want the directory useful on day one. The seventeen as of Oct 31, 2026, surnames
where known:

Tyler Fuqua · Kelly Candeto · Cam Bonsell · Meg Bonsell · Peter Thompson · Mikala
Thompson · Emmy Johnson · Camm Johnson · Taylor Thomas · Grace Condelo · Erik Berg ·
Caitlyn Berg · Cody Pate · Ricardo Diaz · Oscar · Medhin · Josie Sydnor

Your own row already exists (it is the admin's) and shows as "co-lead" in the directory;
edit it like any other to add your number. Oscar and Medhin can add their surnames
themselves: every member edits their own name.

## 3. Port the current sheet

**Group → Sign-up → New sign-up.** Title it the way the thread would ("Dinner at Tyler
and Kelly's"), set the Thursday, set when it closes (5:00 that afternoon is the render's
example), and make the slots the sheet has today, in its order, with the capacity each
has. Save. On the sheet, each open slot has an **Add a name…** select: put every name from
the Google sheet on its slot. Those claims carry no phone; they are yours on the member's
behalf, which is what the API records.

A slot's label is its identity. If a label needs fixing after names are on it, add a slot
with the new label and move the names, rather than renaming.

## 4. Add the next meeting and this week's questions

**Group → Calendar → Add a meeting**: the Thursday, 6:30, the place, one line of notes.
**Group → Questions → Write this week's**: the Thursday it is for and the questions in
markdown. Both can be kept through MCP from here on (`docs/runbooks/group-calendar.md`).

## 5. Make the co-leads

For Kelly, Cam and Meg: **Members → Edit** on their row, then under "Co-leads only", type
the email their sign-in code should go to and click **Make co-lead**. This gives the row
the role and creates their Cognito user; no mail is sent.

SES is still in the sandbox, so a code can only reach a verified address. In the AWS
console, **SES → Identities → Create identity → Email address**, one per co-lead; each gets
a verification mail from AWS and clicks its link. Until they do, their sign-in code
bounces silently.

## 6. The co-leads sign in

Each co-lead opens https://tylerfuqua.com/group/sign-in, types the email you used, and
enters the six-digit code from the mail. The session lasts a year. They see the group's
own pages with the controls (Edit, New sign-up, Add a member, Add a name…) and nothing of
yours. They should also open the group link on their phone like everyone else if they
want to take slots from the sheet as themselves.

## 7. Paste the link into the thread

Send the URL from step 1 to the group text thread with a line like: "Our sign-up and
questions live here now. Open it, tap your name, and it remembers your phone." A phone
that opens it sees "You're in the group", then Continue, then "Who are you?". Names
already on another phone sit under "Already on another device"; tapping one asks once.

## The gate

A real Thursday: a member opens the link, taps their name, takes a slot; a co-lead,
signed in, sees that claim with the name on it and adds the next meeting. Record the
date in `docs/phases/04-group.md`.

## When something goes wrong

- **A lost phone.** Members → Edit on the member, **Clear phones** (or the Phones list at
  the foot of Members). Every phone holding that name is refused on its next request and
  shows "This phone is no longer in the group"; the person opens the link again and taps
  their name.
- **The link leaks.** Members → The group link → tick "Drop every device too" and
  **Rotate the link**. The old URL dies at once; everyone re-enters through the new one,
  which you paste into the thread. Without the tick, rotation only kills the old URL and
  phones already in stay in.
- **A wrong name claimed.** The member taps the right name from Members → the claim screen
  (a phone may change its mind), and a co-lead clears the phones from the wrong row if a
  stranger took it.
- **A sign-up has closed and someone texted.** Co-leads and you can still put a name on a
  slot or take one off after the close; members cannot.

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

## 3. Port the sheet

Two ways. For the current week alone, by hand, as below. For the Sheet's history as well,
`docs/runbooks/seed-the-sheet.md`: Duet reads the Sheet and ports every week through MCP,
with two scopes on the `claude` token for the evening. Either way, do it after step 2, since
names on slots need member rows.

**Group → Sign-up → New sign-up.** Title it the way the thread would ("Dinner at Tyler
and Kelly's"), set the Thursday, set when it closes (5:00 that afternoon is the render's
example), and make the slots the sheet has today, in its order, with the capacity each
has. Save. On the sheet, each open slot has an **Add a name…** select: put every name from
the Google sheet on its slot. Those claims carry no phone; they are yours on the member's
behalf, which is what the API records.

A slot's label is its identity. If a label needs fixing after names are on it, add a slot
with the new label and move the names, rather than renaming.

## 4. Add the next meeting, the fixed liturgy, and this week's guide

The group meets every Thursday, so the home always shows the coming one, at the time and
place the fixed liturgy names (next step). **Group → Calendar → Add a meeting** is for
the nights that differ: Friendsgiving, a moved week, someone else's house. An event
within a month shows under "Coming up" with a link to its sheet, if you made one with
its date. The home turns at 5:00 on the Thursday: before it the sheet is first, after it
the guide.

**Group → Guide → The fixed liturgy → Set it up** (once, ever): the form comes filled
with Redeemer's words as the group has used them (the collect before the reading, the
songbook line, the Lord's Prayer, the final collect), the King James for the readings,
and the standing meeting (6:30, Tyler and Kelly's). Save it as it is, or change a line
first. Nothing shows under "Before the reading" or
after the closing prayer until this is saved.

**Group → Guide → Write this week's**: the seven fields from the printed guide. Series
and week ("Sanctuary", 4), the Thursday, the title; the opening prayer as a paragraph
per voice starting "Leader:" or "People:"; the readings one per line as the guide prints
them ("Ephesians 1:15–23"), which the page turns into text; the reflection sentence; the
questions one per line; the closing prayer the same way as the opening, a collect being
one Leader paragraph; the credit line. The meeting and the guide can both be kept through
MCP from here on (`docs/runbooks/group-calendar.md`): Duet reads the week's PDF and posts
it.

## 5. Make the co-leads

For Kelly, Cam and Meg: **Members → Edit** on their row, then under "Co-leads only", type
the email their sign-in code should go to and click **Make co-lead**. This gives the row
the role, creates their Cognito user, and asks SES to verify the address, which sends
them one mail from Amazon ("Email Address Verification Request") with a link. Tell them
to click it. SES is in the sandbox, so until they do, their sign-in code bounces
silently; nothing from The Keep itself is sent at this step.

(Until Oct 31 the SES step was by hand in the console, and Cam's code never arrived
because it had not been done. It is the Lambda's now.)

## 6. The co-leads sign in

Once their address is verified, each co-lead opens https://tylerfuqua.com/group/sign-in,
types the email you used, and enters the six-digit code from the mail (that one is from
The Keep, `keep@tylerfuqua.com`). The session lasts a year. They see the group's
own pages with the controls (Edit, New sign-up, Add a member, Add a name…) and nothing of
yours. They should also open the group link on their phone like everyone else if they
want to take slots from the sheet as themselves.

## 7. Paste the link into the thread

Send the URL from step 1 to the group text thread with a line like: "Our sign-up and
the week's guide live here now. Open it, tap your name, and it remembers your phone." A phone
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

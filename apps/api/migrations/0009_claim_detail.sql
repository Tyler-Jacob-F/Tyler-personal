-- 0009_claim_detail: what a claim brings (the Friendsgiving request, Nov 15, 2026; the
-- shape approved by Tyler that day).
--
-- A slot with a kind (`food`, `item`: packages/shared/src/types/signup.ts) asks the person
-- on it what they are bringing, and a food slot what the dish contains. Both are said
-- after the slot is taken, by the member or a co-lead, and changed as often as the cook
-- changes their mind, so they are columns on the claim and never versions.
--
-- `contains` is text, not an array (the RDS Data API returns no arrays): the allergens
-- comma-joined in the vocabulary's order. Null is "not said"; the empty string is "none
-- of these", said. Every claim made before this migration is "not said", which is true.

alter table signup_claim
  add column note text,
  add column contains text;

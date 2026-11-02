-- 0008_guide: the Phase 4 refresh (docs/phases/04-group.md "The refresh", Nov 2, 2026).
--
-- The weekly `questions` document became the week's `guide`, a structured record of what
-- changes in Redeemer's printed guide, and the fixed liturgy lives on one `liturgy`
-- document. A document's type is text on its row, so the schema needs nothing; the data
-- does. The one questions document posted before the refresh is retired the way every
-- delete here works (its versions stay), and the `write:questions` scope on any agent
-- token becomes `write:guides`, so the claude token keeps posting the week without a
-- visit to Tokens.

update document set deleted_at = now() where type = 'questions' and deleted_at is null;

update agent_token
set scopes = (
  select coalesce(
    jsonb_agg(case when s = 'write:questions' then 'write:guides' else s end),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(scopes) as s
)
where scopes @> '["write:questions"]'::jsonb;

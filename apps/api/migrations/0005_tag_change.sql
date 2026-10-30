-- 0005_tag_change: a record of each time a document's tag set was replaced, so the tagging
-- pass over the Phase 2 import (docs/phases/03-face.md, the set_tags tool) shows up as
-- agent activity without writing a version. Tags live on the document and are not
-- versioned; this is the history they would otherwise lack. Append-only like version.
create table tag_change (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document (id),
  tags jsonb not null default '[]'::jsonb,
  previous_tags jsonb not null default '[]'::jsonb,
  author_member_id uuid references member (id),
  author_agent_token_id uuid references agent_token (id),
  created_at timestamptz not null default now(),
  -- exactly one author: a person or an agent token
  check ((author_member_id is null) <> (author_agent_token_id is null))
);

create index tag_change_by_document_idx on tag_change (document_id, created_at desc);
create index tag_change_by_agent_idx on tag_change (created_at desc) where author_agent_token_id is not null;

create trigger tag_change_append_only
  before update or delete on tag_change
  for each row execute function version_append_only();

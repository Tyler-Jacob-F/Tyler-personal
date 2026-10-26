-- 0001_spine: the five tables of the domain model (docs/DESIGN.md "Domain model").
-- Migrations are append-only once shipped; renames need a new file and Tyler's say-so.
--
-- Array-valued columns (tags, scopes) are jsonb rather than text[] because the RDS Data
-- API cannot bind PostgreSQL array parameters.

create table member (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'group')),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table agent_token (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  secret_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table document (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  slug text not null,
  ring text not null default 'me' check (ring in ('me', 'group', 'public')),
  owner uuid not null references member (id),
  created_at timestamptz not null default now(),
  current_version_id uuid,
  tags jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  unique (type, slug)
);

create table version (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document (id),
  number integer not null check (number > 0),
  body text not null,
  frontmatter jsonb not null,
  author_member_id uuid references member (id),
  author_agent_token_id uuid references agent_token (id),
  created_at timestamptz not null default now(),
  summary text not null default '',
  unique (document_id, number),
  -- exactly one author: a person or an agent token
  check ((author_member_id is null) <> (author_agent_token_id is null))
);

alter table document
  add constraint document_current_version_fk
  foreign key (current_version_id) references version (id);

create table attachment (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references version (id),
  s3_key text not null,
  content_type text not null,
  size bigint not null check (size >= 0),
  alt text not null default '',
  created_at timestamptz not null default now()
);

create index document_live_by_type_idx on document (type, created_at desc) where deleted_at is null;
create index version_by_document_idx on version (document_id, number desc);
create index attachment_by_version_idx on attachment (version_id);

-- Versions are append-only. Saving inserts; nothing updates or deletes a version row.
create function version_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'version rows are append-only (% on %)', tg_op, old.id
    using errcode = 'restrict_violation';
end;
$$;

create trigger version_append_only
  before update or delete on version
  for each row execute function version_append_only();

-- 0007_group: members as entities, the group link, devices and sign-up claims
-- (docs/phases/04-group.md "Decided", the schema conversation; approved by Tyler Oct 31).
--
-- The member row loses its email requirement (most of the group never signs in; they hold
-- the link and claim a name), gains the colead role (a real sign-in with the power to run
-- the group's documents) and the fields a member may choose to add. Three tables join it:
-- the one active group link, the devices that opened it, and the claims on a sign-up's
-- slots. Every column is a type the RDS Data API can return (uuid, text, timestamptz):
-- no arrays, no vectors. Documents and versions are untouched.

alter table member alter column email drop not null;
alter table member drop constraint member_role_check;
alter table member add constraint member_role_check check (role in ('admin', 'colead', 'group'));
alter table member
  add column phone text,
  add column address text,
  add column notes text,
  add column claimed_at timestamptz;

-- The key to the group slice: tylerfuqua.com/g/<token>, 32 random bytes as base64url,
-- kept as its SHA-256 like an agent token. Rotating sets rotated_at on the old row and
-- inserts a new one; the partial unique index holds the table to one active link.
create table group_link (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  created_by uuid not null references member (id),
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create unique index group_link_active_idx on group_link ((rotated_at is null)) where rotated_at is null;

-- A phone that opened the link. Unclaimed until it taps a name; cleared (kept, refused)
-- when a co-lead says the phone is lost.
create table device (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique,
  member_id uuid references member (id),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cleared_at timestamptz
);

create index device_by_member_idx on device (member_id) where cleared_at is null;

-- A member's claim on one slot of a signup document, by the slot's label. device_id is
-- null when a co-lead or the admin claimed on the member's behalf (porting the sheet).
-- Releasing a claim deletes the row; capacity counts rows.
create table signup_claim (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document (id),
  slot text not null,
  member_id uuid not null references member (id),
  device_id uuid references device (id),
  created_at timestamptz not null default now(),
  unique (document_id, slot, member_id)
);

create index signup_claim_by_document_idx on signup_claim (document_id, slot);

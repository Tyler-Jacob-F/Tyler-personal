-- 0003_version_authored_at: when the content was written, when that differs from when it
-- entered The Keep. Null for versions authored in the app; set by imports of older files.
-- `created_at` stays the audit timestamp.
alter table version add column authored_at timestamptz;

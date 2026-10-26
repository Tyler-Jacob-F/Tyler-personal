-- 0002_admin_member: the one allowlisted admin (docs/phases/01-spine.md "Decided").
-- The same address is pre-created in the Cognito user pool by infra/lib/config.ts.
insert into member (email, role, display_name)
values ('tyler.fuqua@icloud.com', 'admin', 'Tyler')
on conflict (email) do nothing;

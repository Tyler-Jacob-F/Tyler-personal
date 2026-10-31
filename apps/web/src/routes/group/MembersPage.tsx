import type { RotateGroupLinkResponse } from '@the-keep/shared';
import { useState } from 'react';
import { useClearDevices, useGroupLink, useMembers, useRotateLink } from '@/api/group';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { canEdit, useGroup } from '@/group/context';
import { Control, Directory, SectionHead } from '@/routes/group/parts';
import { when } from '@/routes/recipes/format';

/** The directory; for the admin, the link above it; for co-leads and the admin, the lost-phone control. */
export function MembersPage() {
  const { viewer } = useGroup();
  const members = useMembers();
  const editor = canEdit(viewer);
  if (members.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (members.isError) return <Alert tone="danger">{members.error.message}</Alert>;
  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Members">
      {viewer.kind === 'admin' && <LinkPanel />}
      <section aria-labelledby="directory-heading">
        <SectionHead
          id="directory-heading"
          action={editor && <Control to="/group/members/new">Add a member</Control>}
        >
          Members
        </SectionHead>
        <div className="mt-3">
          <Directory members={members.data.items} viewer={viewer} />
        </div>
        {editor && <LostPhones members={members.data.items} />}
      </section>
    </article>
  );
}

/** The link (docs/phases/04-group.md "The group link is the key"): its facts, mint or rotate, the URL once. */
function LinkPanel() {
  const link = useGroupLink();
  const rotate = useRotateLink();
  const [minted, setMinted] = useState<RotateGroupLinkResponse | null>(null);
  const [clearDevices, setClearDevices] = useState(false);
  const status = link.data?.link;
  return (
    <section
      aria-labelledby="link-heading"
      className="rounded-lg border border-border bg-surface px-5 py-5"
    >
      <h2 id="link-heading" className="eyebrow">
        The group link
      </h2>
      {link.isError && (
        <Alert tone="danger" className="mt-3">
          {link.error.message}
        </Alert>
      )}
      {link.data && (
        <p className="mt-3 text-[15px] text-muted">
          {status
            ? `Minted ${when(status.createdAt)} · ${link.data.deviceCount} ${link.data.deviceCount === 1 ? 'device holds' : 'devices hold'} it`
            : 'No link yet. Mint one and paste it into the group thread.'}
        </p>
      )}
      {minted && (
        <div className="mt-4 grid gap-2" role="status">
          <p className="text-[15px]">The link, shown once. Paste it into the group thread:</p>
          <code className="rounded-sm bg-surface-raised px-2 py-1.5 font-mono text-[13px] break-all select-all">
            {minted.url}
          </code>
        </div>
      )}
      {rotate.isError && (
        <Alert tone="danger" className="mt-3">
          {rotate.error.message}
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button
          size="sm"
          disabled={rotate.isPending || link.isPending}
          onClick={() => rotate.mutate({ clearDevices }, { onSuccess: setMinted })}
        >
          {status ? 'Rotate the link' : 'Mint the link'}
        </Button>
        {status && (
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={clearDevices}
              onChange={(event) => setClearDevices(event.target.checked)}
            />
            Drop every device too (after a leak)
          </label>
        )}
      </div>
    </section>
  );
}

/** A lost phone: every device holding a name is refused from its next request. */
function LostPhones({
  members,
}: {
  members: Array<{ id: string; displayName: string; deviceCount: number }>;
}) {
  const clear = useClearDevices();
  const holding = members.filter((m) => m.deviceCount > 0);
  if (holding.length === 0) return null;
  return (
    <div className="mt-6 grid gap-2">
      <h3 className="eyebrow">Phones</h3>
      <p className="text-[13px] text-muted">
        Clearing a name signs every phone holding it out of the group; the person opens the link
        again and taps their name.
      </p>
      {clear.isError && <Alert tone="danger">{clear.error.message}</Alert>}
      <ul className="divide-y divide-border">
        {holding.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-4 py-1 text-[15px]">
            <span>
              {m.displayName}
              <span className="ml-2 text-[13px] text-muted">
                {m.deviceCount === 1 ? 'a phone' : `${m.deviceCount} phones`}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={clear.isPending}
              onClick={() => clear.mutate(m.id)}
            >
              Clear
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

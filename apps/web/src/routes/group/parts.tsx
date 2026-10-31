import {
  type EventFrontmatter,
  type Member,
  type SignupClaim,
  type SignupFrontmatter,
  signupOpen,
} from '@the-keep/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useReleaseSlot, useTakeSlot } from '@/api/group';
import { useState } from 'react';
import { Alert } from '@/components/Alert';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { canEdit, type GroupViewer, memberIdOf, useGroup } from '@/group/context';
import { capacityLine, icsUrl, telHref, type Typed } from '@/group/format';
import { closesLine, dayLine, longDay, whenLine } from '@/lib/dates';
import { quietLink } from '@/group/styles';
import { cn } from '@/lib/utils';

/** An eyebrow with, for the admin and co-leads, the one control the section has. */
export function SectionHead({
  id,
  children,
  action,
}: {
  id: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="eyebrow">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Control({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={cn(quietLink, 'text-[13px] text-muted')}>
      {children}
    </Link>
  );
}

/** The section's control: Edit when there is a document, else the way to make one. */
export function EditOrNew({
  item,
  base,
  newLabel,
}: {
  item?: { document: { id: string } };
  base: string;
  newLabel: string;
}) {
  return item ? (
    <Control to={`${base}/${item.document.id}/edit`}>Edit</Control>
  ) : (
    <Control to={`${base}/new`}>{newLabel}</Control>
  );
}

/** The other weeks, the other sign-ups: a hairline list under the current one, with a way to add. */
export function OtherList({
  heading,
  items,
  newTo,
  newLabel,
}: {
  heading: string;
  items: Array<{ id: string; to: string; title: string; aside: string }>;
  newTo?: string;
  newLabel: string;
}) {
  if (items.length === 0 && !newTo) return null;
  const id = `${heading.toLowerCase().replace(/\W+/g, '-')}-heading`;
  return (
    <section aria-labelledby={id}>
      <SectionHead id={id} action={newTo && <Control to={newTo}>{newLabel}</Control>}>
        {heading}
      </SectionHead>
      {items.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted italic">None yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={cn(
                  quietLink,
                  'flex w-full justify-between gap-4 py-1 text-[17px] no-underline',
                )}
              >
                <span className="font-serif">{item.title}</span>
                <span className="text-[13px] text-muted tabular-nums">{item.aside}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- this week's questions ----------

export function QuestionsBlock({
  weekOf,
  body,
  heading = 'h1',
}: {
  weekOf: string;
  body: string;
  heading?: 'h1' | 'h2';
}) {
  const Heading = heading;
  return (
    <>
      <Heading className="page-title mt-1">{longDay(weekOf)}</Heading>
      {body.trim() ? (
        <Markdown variant="reading" className="mt-4">
          {body}
        </Markdown>
      ) : (
        <p className="reading mt-4 text-muted italic">Nothing written yet.</p>
      )}
    </>
  );
}

// ---------- the sign-up ----------

export interface SheetProps {
  signup: Typed<SignupFrontmatter>;
  claims: SignupClaim[];
  members?: Member[];
  heading?: 'h1' | 'h2';
}

/**
 * The sheet (docs/design/group-home-*.png): title, date and close; then each slot in the
 * sheet's order, label and capacity left, the names right with the viewer's own in
 * strong, and under them "Full", or a hairline and the viewer's one action. The accent
 * appears on "Release" alone, the viewer's standing action; a guest reads the sheet and is
 * pointed at the claim screen.
 */
export function SignupSheet({ signup, claims, members = [], heading = 'h2' }: SheetProps) {
  const { viewer } = useGroup();
  const { frontmatter, item } = signup;
  const take = useTakeSlot(item.document.id);
  const release = useReleaseSlot(item.document.id);
  const mine = memberIdOf(viewer);
  const editor = canEdit(viewer);
  const guest = viewer.kind === 'guest';
  const Heading = heading;
  const error = take.error ?? release.error;
  const [now] = useState(() => new Date());
  const closed = !signupOpen(frontmatter, now);
  const others = members.filter((m) => m.id !== mine);

  return (
    <div>
      <Heading className="mt-1 font-serif text-[26px] leading-tight font-medium text-text-strong">
        {frontmatter.title}
      </Heading>
      <p className="mt-1 text-[15px] text-muted">
        {dayLine(frontmatter.date)}
        {frontmatter.closesAt && ` · ${closesLine(frontmatter.closesAt, frontmatter.date)}`}
      </p>
      {guest && (
        <p className="mt-5 text-[15px] text-muted">
          <Link to="/group/claim" className={cn('font-semibold text-accent', focusRing)}>
            Tap your name first
          </Link>{' '}
          to take a slot.
        </p>
      )}
      {closed && !editor && (
        <p className="mt-5 text-[15px] text-muted italic">This sign-up has closed.</p>
      )}
      {error && (
        <Alert tone="danger" className="mt-4">
          {error.message}
        </Alert>
      )}
      <ul className="mt-5 divide-y divide-border border-y border-border" aria-label="Slots">
        {frontmatter.slots.map((slot) => {
          const taken = claims.filter((c) => c.slot === slot.label);
          const own = mine ? taken.find((c) => c.memberId === mine) : undefined;
          const full = taken.length >= slot.capacity;
          const busy = take.isPending || release.isPending;
          let action: ReactNode = null;
          if (own) {
            action = (
              <Button
                variant="accent"
                size="sm"
                disabled={busy || (closed && !editor)}
                onClick={() => release.mutate(own.id)}
                aria-label={`Release ${slot.label}`}
              >
                Release
              </Button>
            );
          } else if (full) {
            action = <span className="text-[15px] text-muted">Full</span>;
          } else if (guest) {
            action = (
              <Button asChild size="sm">
                <Link to="/group/claim">Tap your name first</Link>
              </Button>
            );
          } else if (mine && viewer.kind !== 'signedIn' && !(closed && !editor)) {
            action = (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  take.mutate({ slot: slot.label, ...(editor ? { memberId: mine } : {}) })
                }
                aria-label={`Take ${slot.label}`}
              >
                Take this
              </Button>
            );
          }
          return (
            <li key={slot.label} className="flex items-start justify-between gap-6 py-4">
              <div className="shrink-0">
                <p className="text-[17px] font-semibold text-text-strong">{slot.label}</p>
                <p className="mt-0.5 text-[15px] text-muted">{capacityLine(slot.capacity)}</p>
              </div>
              <div className="flex min-w-0 flex-col items-end gap-1.5 text-right">
                {taken.map((claim) => (
                  <span
                    key={claim.id}
                    className={cn(
                      'inline-flex items-center gap-2 text-[17px]',
                      claim.memberId === mine ? 'font-semibold text-text-strong' : 'text-text',
                    )}
                  >
                    <span>{claim.memberName}</span>
                    {editor && claim.memberId !== mine && (
                      <button
                        type="button"
                        aria-label={`Release ${claim.memberName} from ${slot.label}`}
                        className={cn(
                          'inline-flex size-7 items-center justify-center rounded-sm text-muted hover:text-text',
                          focusRing,
                        )}
                        disabled={busy}
                        onClick={() => release.mutate(claim.id)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {action && (
                  <div
                    className={cn(
                      'mt-1 flex flex-col items-end gap-2',
                      (taken.length > 0 || !full) && 'w-full',
                    )}
                  >
                    {!full && (
                      <span className="block h-px w-48 max-w-full bg-border" aria-hidden="true" />
                    )}
                    {action}
                  </div>
                )}
                {editor && !full && others.length > 0 && (
                  <AddName
                    slot={slot.label}
                    members={others}
                    busy={busy}
                    onPick={(memberId) => take.mutate({ slot: slot.label, memberId })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A co-lead puts a name on a slot: porting the sheet, or someone who texted instead. */
function AddName({
  slot,
  members,
  busy,
  onPick,
}: {
  slot: string;
  members: Member[];
  busy: boolean;
  onPick(memberId: string): void;
}) {
  return (
    <label className="mt-1 text-[13px] text-muted">
      <span className="sr-only">Add a name to {slot}</span>
      <select
        className={cn(
          'h-9 max-w-48 rounded-md border border-border bg-surface px-2 text-[13px] text-muted',
          focusRing,
        )}
        value=""
        disabled={busy}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
      >
        <option value="">Add a name…</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- the next meeting ----------

export function MeetingRows({ event }: { event: Typed<EventFrontmatter> }) {
  const { frontmatter, item } = event;
  const rows: Array<[string, ReactNode]> = [
    ['When', whenLine(frontmatter.date, frontmatter.time)],
    ...(frontmatter.place ? ([['Where', frontmatter.place]] as Array<[string, ReactNode]>) : []),
    ...(frontmatter.notes ? ([['Notes', frontmatter.notes]] as Array<[string, ReactNode]>) : []),
  ];
  return (
    <div>
      <table className="w-full border-collapse text-[17px]">
        <tbody>
          {rows.map(([label, text]) => (
            <tr key={label}>
              <th
                scope="row"
                className="w-28 py-2 pr-4 text-left align-baseline font-normal text-muted"
              >
                {label}
              </th>
              <td className="py-2 align-baseline leading-relaxed text-text">{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.version.body.trim() && (
        <Markdown variant="ui" className="mt-3 text-muted">
          {item.version.body}
        </Markdown>
      )}
      <a
        href={icsUrl(frontmatter, item.document.id)}
        download={`${item.document.slug}.ics`}
        className={cn(quietLink, 'mt-3 text-[17px]')}
      >
        Add to calendar
      </a>
    </div>
  );
}

// ---------- the directory ----------

export function Directory({ members, viewer }: { members: Member[]; viewer: GroupViewer }) {
  const mine = memberIdOf(viewer);
  const editor = canEdit(viewer);
  return (
    <ul className="divide-y divide-border border-y border-border" aria-label="Members">
      {members.map((member) => {
        const own = member.id === mine;
        return (
          <li key={member.id} className="grid gap-1.5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[17px] text-text-strong">
                <span className="font-semibold">{member.displayName}</span>
                {member.role !== 'group' && (
                  <span className="ml-2 text-[13px] font-normal text-muted">
                    {member.role === 'admin' ? 'co-lead' : 'co-lead'}
                  </span>
                )}
                {own && <span className="ml-2 text-[13px] font-normal text-muted">you</span>}
              </p>
              {(own || editor) && (
                <Link
                  to={`/group/members/${member.id}/edit`}
                  className={cn(quietLink, 'shrink-0 text-[15px]')}
                >
                  {own ? 'Edit your details' : 'Edit'}
                </Link>
              )}
            </div>
            {member.phone && (
              <a
                href={telHref(member.phone)}
                className={cn('text-[17px] text-text tabular-nums', focusRing)}
              >
                {member.phone}
              </a>
            )}
            {member.address && <p className="text-[17px] text-muted">{member.address}</p>}
            {member.notes && (
              <p className="font-serif text-[17px] text-muted italic">{member.notes}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

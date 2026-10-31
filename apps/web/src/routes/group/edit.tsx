import { zodResolver } from '@hookform/resolvers/zod';
import {
  type EventFrontmatter,
  eventFrontmatterSchema,
  memberFieldsSchema,
  questionsFrontmatterSchema,
  type SignupFrontmatter,
  signupFrontmatterSchema,
} from '@the-keep/shared';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import {
  useAddMember,
  useClearDevices,
  useCreateGroupDocument,
  useCreateGroupVersion,
  useDeleteGroupDocument,
  useGroupDocument,
  useMakeColead,
  useMembers,
  useUpdateMember,
} from '@/api/group';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { canEdit, memberIdOf, useGroup } from '@/group/context';
import { eventsOf, questionsOf, signupsOf } from '@/group/format';
import { quietLink } from '@/group/styles';
import { cn } from '@/lib/utils';

/**
 * The forms behind the controls (docs/phases/04-group.md "Members and claims", "Types"):
 * questions, a sign-up, a meeting, for the admin and co-leads; a member's own details for
 * everyone who holds a name. Each saves a new version, never an edit in place, the way
 * every document in The Keep does.
 */

function Head({ title, back }: { title: string; back: string }) {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <h1 className="page-title">{title}</h1>
      <Link to={back} className={cn(quietLink, 'text-[15px] text-muted')}>
        Back
      </Link>
    </header>
  );
}

function NotYours() {
  return <Navigate to="/group" replace />;
}

// ---------- questions ----------

const questionsForm = z.object({
  weekOf: z.iso.date('A date, YYYY-MM-DD.'),
  body: z.string().trim().min(1, 'Write the questions.'),
  summary: z.string().trim().max(500),
});

export function QuestionsEdit() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useGroupDocument(id ?? '');
  const create = useCreateGroupDocument();
  const version = useCreateGroupVersion(id ?? '');
  const remove = useDeleteGroupDocument();
  const current = id && existing.data ? questionsOf([existing.data]) : [];
  const form = useForm({
    resolver: zodResolver(questionsForm),
    values:
      id && current[0]
        ? { weekOf: current[0].frontmatter.weekOf, body: current[0].item.version.body, summary: '' }
        : { weekOf: '', body: '', summary: '' },
  });
  if (!canEdit(viewer)) return <NotYours />;
  if (id && existing.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (id && existing.isError) return <Alert tone="danger">{existing.error.message}</Alert>;
  const error = create.error ?? version.error ?? remove.error;

  const onSubmit = form.handleSubmit(async ({ weekOf, body, summary }) => {
    const frontmatter = questionsFrontmatterSchema.parse({ weekOf });
    if (id) await version.mutateAsync({ frontmatter, body, summary });
    else await create.mutateAsync({ type: 'questions', frontmatter, body, summary, tags: [] });
    navigate('/group/questions');
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Questions form">
      <Head title={id ? 'Edit the questions' : 'This week’s questions'} back="/group/questions" />
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="weekOf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thursday</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>The Thursday these questions are for.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Questions</FormLabel>
                <FormControl>
                  <Textarea rows={12} className="font-serif text-[17px]" {...field} />
                </FormControl>
                <FormDescription>Markdown: a short lead, then a numbered list.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {id && (
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What changed</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              Save
            </Button>
            {id && (
              <DeleteButton
                id={id}
                what="these questions"
                onDone={() => navigate('/group/questions')}
                remove={remove}
              />
            )}
          </div>
        </form>
      </Form>
    </article>
  );
}

// ---------- a sign-up ----------

const signupForm = z.object({
  title: z.string().trim().min(1, 'A title, like "Dinner at Tyler and Kelly’s".').max(200),
  date: z.iso.date('A date, YYYY-MM-DD.'),
  closesAt: z.string(),
  slots: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'A label.').max(80),
        capacity: z.number().int().min(1, 'At least one.').max(50),
      }),
    )
    .min(1, 'At least one slot.'),
  body: z.string(),
  summary: z.string().trim().max(500),
});

/** `datetime-local` wants local wall time; the API wants an instant. */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function fromLocalInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function SignupEdit() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useGroupDocument(id ?? '');
  const create = useCreateGroupDocument();
  const version = useCreateGroupVersion(id ?? '');
  const remove = useDeleteGroupDocument();
  const current = id && existing.data ? signupsOf([existing.data])[0] : undefined;
  const form = useForm({
    resolver: zodResolver(signupForm),
    values: current
      ? {
          title: current.frontmatter.title,
          date: current.frontmatter.date,
          closesAt: toLocalInput(current.frontmatter.closesAt),
          slots: current.frontmatter.slots,
          body: current.item.version.body,
          summary: '',
        }
      : {
          title: '',
          date: '',
          closesAt: '',
          slots: [
            { label: 'Main', capacity: 1 },
            { label: 'Salad', capacity: 1 },
            { label: 'Bread', capacity: 1 },
            { label: 'Dessert', capacity: 2 },
            { label: 'Drinks', capacity: 2 },
          ],
          body: '',
          summary: '',
        },
  });
  const slots = useFieldArray({ control: form.control, name: 'slots' });
  if (!canEdit(viewer)) return <NotYours />;
  if (id && existing.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (id && existing.isError) return <Alert tone="danger">{existing.error.message}</Alert>;
  const error = create.error ?? version.error ?? remove.error;

  const onSubmit = form.handleSubmit(async ({ title, date, closesAt, slots, body, summary }) => {
    const parsed = signupFrontmatterSchema.safeParse({
      title,
      date,
      slots,
      closesAt: fromLocalInput(closesAt),
    });
    if (!parsed.success) {
      form.setError('slots', { message: parsed.error.issues[0]?.message ?? 'Check the slots.' });
      return;
    }
    const frontmatter: SignupFrontmatter = parsed.data;
    if (id) await version.mutateAsync({ frontmatter, body, summary });
    else {
      const created = await create.mutateAsync({
        type: 'signup',
        frontmatter,
        body,
        summary,
        tags: [],
      });
      navigate(`/group/signups/${created.document.id}`);
      return;
    }
    navigate(`/group/signups/${id}`);
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Sign-up form">
      <Head
        title={id ? 'Edit the sign-up' : 'New sign-up'}
        back={id ? `/group/signups/${id}` : '/group/signups'}
      />
      {id && (
        <p className="text-[15px] text-muted">
          Slots are known by their labels: renaming one orphans the names already on it. Add a slot
          rather than rename one.
        </p>
      )}
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thursday</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="closesAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Closes</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormDescription>
                    After this, members can neither take nor release.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-text-strong">Slots</legend>
            {slots.fields.map((slot, index) => (
              <div key={slot.id} className="flex items-end gap-2">
                <FormField
                  control={form.control}
                  name={`slots.${index}.label`}
                  render={({ field }) => (
                    <FormItem className="grow">
                      <FormLabel className="sr-only">Slot {index + 1} label</FormLabel>
                      <FormControl>
                        <Input aria-label={`Slot ${index + 1} label`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`slots.${index}.capacity`}
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <FormLabel className="sr-only">Slot {index + 1} capacity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          aria-label={`Slot ${index + 1} capacity`}
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={Number.isFinite(field.value) ? field.value : ''}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove slot ${index + 1}`}
                  onClick={() => slots.remove(index)}
                >
                  ×
                </Button>
              </div>
            ))}
            {form.formState.errors.slots?.message && (
              <p className="text-sm text-wrong">{form.formState.errors.slots.message}</p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => slots.append({ label: '', capacity: 1 })}
            >
              Add a slot
            </Button>
          </fieldset>
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {id && (
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What changed</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              Save
            </Button>
            {id && (
              <DeleteButton
                id={id}
                what="this sign-up"
                onDone={() => navigate('/group/signups')}
                remove={remove}
              />
            )}
          </div>
        </form>
      </Form>
    </article>
  );
}

// ---------- a meeting ----------

const eventForm = z.object({
  title: z.string().trim().min(1, 'A title.').max(200),
  date: z.iso.date('A date, YYYY-MM-DD.'),
  time: z.string(),
  place: z.string().trim().max(200),
  notes: z.string().trim().max(500),
  body: z.string(),
  summary: z.string().trim().max(500),
});

export function EventEdit() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useGroupDocument(id ?? '');
  const create = useCreateGroupDocument();
  const version = useCreateGroupVersion(id ?? '');
  const remove = useDeleteGroupDocument();
  const current = id && existing.data ? eventsOf([existing.data])[0] : undefined;
  const form = useForm({
    resolver: zodResolver(eventForm),
    values: current
      ? {
          title: current.frontmatter.title,
          date: current.frontmatter.date,
          time: current.frontmatter.time ?? '',
          place: current.frontmatter.place ?? '',
          notes: current.frontmatter.notes ?? '',
          body: current.item.version.body,
          summary: '',
        }
      : {
          title: 'Small group',
          date: '',
          time: '18:30',
          place: '',
          notes: '',
          body: '',
          summary: '',
        },
  });
  if (!canEdit(viewer)) return <NotYours />;
  if (id && existing.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (id && existing.isError) return <Alert tone="danger">{existing.error.message}</Alert>;
  const error = create.error ?? version.error ?? remove.error;

  const onSubmit = form.handleSubmit(async ({ title, date, time, place, notes, body, summary }) => {
    const frontmatter: EventFrontmatter = eventFrontmatterSchema.parse({
      title,
      date,
      time: time || undefined,
      place: place || undefined,
      notes: notes || undefined,
    });
    if (id) await version.mutateAsync({ frontmatter, body, summary });
    else await create.mutateAsync({ type: 'event', frontmatter, body, summary, tags: [] });
    navigate('/group/calendar');
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Meeting form">
      <Head title={id ? 'Edit the meeting' : 'Add a meeting'} back="/group/calendar" />
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription>Leave it out for an all-day note.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="place"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>One line: "Kids welcome. Park on Hanover."</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>More</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {id && (
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What changed</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
              Save
            </Button>
            {id && (
              <DeleteButton
                id={id}
                what="this meeting"
                onDone={() => navigate('/group/calendar')}
                remove={remove}
              />
            )}
          </div>
        </form>
      </Form>
    </article>
  );
}

function DeleteButton({
  id,
  what,
  onDone,
  remove,
}: {
  id: string;
  what: string;
  onDone(): void;
  remove: ReturnType<typeof useDeleteGroupDocument>;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[13px] text-muted">
      Delete {what}?
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={remove.isPending}
        onClick={() => remove.mutate(id, { onSuccess: onDone })}
      >
        Yes, delete
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        No
      </Button>
    </span>
  );
}

// ---------- a member ----------

const memberForm = memberFieldsSchema.extend({
  phone: z.string().trim().max(40),
  address: z.string().trim().max(200),
  notes: z.string().trim().max(500),
});

/** Own details for a member; any row for the admin and co-leads; a new row at `/new`. */
export function MemberEdit() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const members = useMembers();
  const update = useUpdateMember();
  const add = useAddMember();
  const promote = useMakeColead();
  const clear = useClearDevices();
  const [email, setEmail] = useState('');
  const creating = id === undefined;
  const member = members.data?.items.find((m) => m.id === id);
  const own = id !== undefined && memberIdOf(viewer) === id;
  const editor = canEdit(viewer);
  const form = useForm({
    resolver: zodResolver(memberForm),
    values: member
      ? {
          displayName: member.displayName,
          phone: member.phone ?? '',
          address: member.address ?? '',
          notes: member.notes ?? '',
        }
      : { displayName: '', phone: '', address: '', notes: '' },
  });
  if (!(own || editor)) return <NotYours />;
  if (members.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (members.isError) return <Alert tone="danger">{members.error.message}</Alert>;
  if (!creating && !member) return <Alert tone="danger">No such member.</Alert>;
  const error = update.error ?? add.error ?? promote.error ?? clear.error;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      displayName: values.displayName,
      phone: values.phone || null,
      address: values.address || null,
      notes: values.notes || null,
    };
    if (creating) await add.mutateAsync(body);
    else await update.mutateAsync({ id, ...body });
    navigate('/group/members');
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Member form">
      <Head
        title={creating ? 'Add a member' : own ? 'Your details' : member!.displayName}
        back="/group/members"
      />
      {own && (
        <p className="text-[15px] text-muted">
          Everything here is visible to the whole group. Add what you want them to have.
        </p>
      )}
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormDescription>As the group knows you; a last name is welcome.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" autoComplete="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input autoComplete="street-address" {...field} />
                </FormControl>
                <FormDescription>A street address, or just the neighborhood.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  "Text, don’t call, after eight." Allergies. Whatever helps.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="accent"
            className="justify-self-start"
            disabled={form.formState.isSubmitting}
          >
            Save
          </Button>
        </form>
      </Form>

      {!creating && editor && member && (
        <section
          aria-labelledby="manage-heading"
          className="grid gap-4 border-t border-border pt-6"
        >
          <h2 id="manage-heading" className="eyebrow">
            Co-leads only
          </h2>
          {member.deviceCount > 0 && (
            <div className="flex items-center justify-between gap-4 text-[15px]">
              <span>
                {member.deviceCount === 1 ? 'One phone holds' : `${member.deviceCount} phones hold`}{' '}
                this name.
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={clear.isPending}
                onClick={() => clear.mutate(member.id)}
              >
                Clear phones
              </Button>
            </div>
          )}
          {viewer.kind === 'admin' && member.role === 'group' && (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                promote.mutate(
                  { id: member.id, email },
                  { onSuccess: () => navigate('/group/members') },
                );
              }}
            >
              <label className="text-sm font-medium text-text-strong" htmlFor="colead-email">
                Make a co-lead
              </label>
              <p className="text-xs text-muted">
                The email their sign-in code goes to. Verify it in SES while it is in the sandbox.
              </p>
              <div className="flex gap-2">
                <Input
                  id="colead-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <Button type="submit" size="sm" disabled={promote.isPending || !email}>
                  Make co-lead
                </Button>
              </div>
            </form>
          )}
          {member.role === 'colead' && (
            <p className="text-[15px] text-muted">A co-lead, signing in as {member.email}.</p>
          )}
        </section>
      )}
    </article>
  );
}

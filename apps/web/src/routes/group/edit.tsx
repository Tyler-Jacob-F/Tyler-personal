import { zodResolver } from '@hookform/resolvers/zod';
import {
  eventFrontmatterSchema,
  memberFieldsSchema,
  questionsFrontmatterSchema,
  signupFrontmatterSchema,
} from '@the-keep/shared';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { useDocumentEditor } from '@/api/editor';
import {
  useAddMember,
  useClearDevices,
  useMakeColead,
  useMembers,
  useUpdateMember,
} from '@/api/group';
import { Alert } from '@/components/Alert';
import { ConfirmButton } from '@/components/ConfirmDialog';
import { Loading, QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormRow, SaveBar, SummaryField } from '@/components/ui/form-row';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { canEdit, memberIdOf, useGroup } from '@/group/context';
import { eventsOf, phonesLine, questionsOf, signupsOf } from '@/group/format';
import { quietLink } from '@/group/styles';
import { fromDateTimeInput, localDateTimeInput } from '@/lib/dates';
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

const NotYours = () => <Navigate to="/group" replace />;

function DeleteDocument({
  what,
  onDelete,
  pending,
}: {
  what: string;
  onDelete(): void;
  pending: boolean;
}) {
  return (
    <ConfirmButton
      label="Delete"
      className="text-muted"
      title={`Delete ${what}?`}
      confirmLabel="Yes, delete"
      pending={pending}
      onConfirm={onDelete}
    >
      Its versions stay in the database; it stops showing to the group.
    </ConfirmButton>
  );
}

// ---------- questions ----------

const questionsForm = z.object({
  weekOf: z.iso.date('A date, YYYY-MM-DD.'),
  body: z.string().trim().min(1, 'Write the questions.'),
  summary: z.string().trim().max(500),
});

export function QuestionsEdit() {
  const { viewer, api } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const editor = useDocumentEditor('questions', id, api);
  const current = editor.existing.data ? questionsOf([editor.existing.data])[0] : undefined;
  const form = useForm({
    resolver: zodResolver(questionsForm),
    values: current
      ? { weekOf: current.frontmatter.weekOf, body: current.item.version.body, summary: '' }
      : { weekOf: '', body: '', summary: '' },
  });
  if (!canEdit(viewer)) return <NotYours />;
  if (editor.existing.isError) return <QueryError queries={[editor.existing]} />;
  if (id && editor.existing.isPending) return <Loading />;

  const onSubmit = form.handleSubmit(async ({ weekOf, body, summary }) => {
    await editor.save({ frontmatter: questionsFrontmatterSchema.parse({ weekOf }), body, summary });
    navigate('/group/questions');
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Questions form">
      <Head title={id ? 'Edit the questions' : 'This week’s questions'} back="/group/questions" />
      {editor.error && <Alert tone="danger">{editor.error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormRow
            control={form.control}
            name="weekOf"
            label="Thursday"
            hint="The Thursday these questions are for."
          >
            {(field) => <Input type="date" {...field} />}
          </FormRow>
          <FormRow
            control={form.control}
            name="body"
            label="Questions"
            hint="Markdown: a short lead, then a numbered list."
          >
            {(field) => <Textarea rows={12} className="font-serif text-[17px]" {...field} />}
          </FormRow>
          {id && <SummaryField control={form.control} name="summary" />}
          <SaveBar pending={form.formState.isSubmitting}>
            {id && (
              <DeleteDocument
                what="these questions"
                pending={editor.pending}
                onDelete={() => void editor.remove().then(() => navigate('/group/questions'))}
              />
            )}
          </SaveBar>
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

const defaultSlots = [
  { label: 'Main', capacity: 1 },
  { label: 'Salad', capacity: 1 },
  { label: 'Bread', capacity: 1 },
  { label: 'Dessert', capacity: 2 },
  { label: 'Drinks', capacity: 2 },
];

export function SignupEdit() {
  const { viewer, api } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const editor = useDocumentEditor('signup', id, api);
  const current = editor.existing.data ? signupsOf([editor.existing.data])[0] : undefined;
  const form = useForm({
    resolver: zodResolver(signupForm),
    values: current
      ? {
          title: current.frontmatter.title,
          date: current.frontmatter.date,
          closesAt: localDateTimeInput(current.frontmatter.closesAt),
          slots: current.frontmatter.slots,
          body: current.item.version.body,
          summary: '',
        }
      : { title: '', date: '', closesAt: '', slots: defaultSlots, body: '', summary: '' },
  });
  const slots = useFieldArray({ control: form.control, name: 'slots' });
  if (!canEdit(viewer)) return <NotYours />;
  if (editor.existing.isError) return <QueryError queries={[editor.existing]} />;
  if (id && editor.existing.isPending) return <Loading />;

  const onSubmit = form.handleSubmit(async ({ title, date, closesAt, slots, body, summary }) => {
    const parsed = signupFrontmatterSchema.safeParse({
      title,
      date,
      slots,
      closesAt: fromDateTimeInput(closesAt),
    });
    if (!parsed.success) {
      form.setError('slots', { message: parsed.error.issues[0]?.message ?? 'Check the slots.' });
      return;
    }
    const saved = await editor.save({ frontmatter: parsed.data, body, summary });
    navigate(`/group/signups/${saved}`);
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
      {editor.error && <Alert tone="danger">{editor.error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormRow control={form.control} name="title" label="Title">
            {(field) => <Input {...field} />}
          </FormRow>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow control={form.control} name="date" label="Thursday">
              {(field) => <Input type="date" {...field} />}
            </FormRow>
            <FormRow
              control={form.control}
              name="closesAt"
              label="Closes"
              hint="After this, members can neither take nor release."
            >
              {(field) => <Input type="datetime-local" {...field} />}
            </FormRow>
          </div>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-text-strong">Slots</legend>
            {slots.fields.map((slot, index) => (
              <div key={slot.id} className="flex items-end gap-2">
                <FormRow
                  control={form.control}
                  name={`slots.${index}.label`}
                  label={`Slot ${index + 1} label`}
                  className="grow [&>label]:sr-only"
                >
                  {(field) => <Input {...field} />}
                </FormRow>
                <FormRow
                  control={form.control}
                  name={`slots.${index}.capacity`}
                  label={`Slot ${index + 1} capacity`}
                  className="w-24 [&>label]:sr-only"
                >
                  {(field) => (
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isFinite(field.value) ? field.value : ''}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  )}
                </FormRow>
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
          <FormRow control={form.control} name="body" label="Notes">
            {(field) => <Textarea rows={3} {...field} />}
          </FormRow>
          {id && <SummaryField control={form.control} name="summary" />}
          <SaveBar pending={form.formState.isSubmitting}>
            {id && (
              <DeleteDocument
                what="this sign-up"
                pending={editor.pending}
                onDelete={() => void editor.remove().then(() => navigate('/group/signups'))}
              />
            )}
          </SaveBar>
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
  const { viewer, api } = useGroup();
  const { id } = useParams();
  const navigate = useNavigate();
  const editor = useDocumentEditor('event', id, api);
  const current = editor.existing.data ? eventsOf([editor.existing.data])[0] : undefined;
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
  if (editor.existing.isError) return <QueryError queries={[editor.existing]} />;
  if (id && editor.existing.isPending) return <Loading />;

  const onSubmit = form.handleSubmit(async ({ title, date, time, place, notes, body, summary }) => {
    const frontmatter = eventFrontmatterSchema.parse({
      title,
      date,
      time: time || undefined,
      place: place || undefined,
      notes: notes || undefined,
    });
    await editor.save({ frontmatter, body, summary });
    navigate('/group/calendar');
  });

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Meeting form">
      <Head title={id ? 'Edit the meeting' : 'Add a meeting'} back="/group/calendar" />
      {editor.error && <Alert tone="danger">{editor.error.message}</Alert>}
      <Form {...form}>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <FormRow control={form.control} name="title" label="Title">
            {(field) => <Input {...field} />}
          </FormRow>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow control={form.control} name="date" label="Date">
              {(field) => <Input type="date" {...field} />}
            </FormRow>
            <FormRow
              control={form.control}
              name="time"
              label="Time"
              hint="Leave it out for an all-day note."
            >
              {(field) => <Input type="time" {...field} />}
            </FormRow>
          </div>
          <FormRow control={form.control} name="place" label="Place">
            {(field) => <Input {...field} />}
          </FormRow>
          <FormRow
            control={form.control}
            name="notes"
            label="Notes"
            hint='One line: "Kids welcome. Park on Hanover."'
          >
            {(field) => <Input {...field} />}
          </FormRow>
          <FormRow control={form.control} name="body" label="More">
            {(field) => <Textarea rows={3} {...field} />}
          </FormRow>
          {id && <SummaryField control={form.control} name="summary" />}
          <SaveBar pending={form.formState.isSubmitting}>
            {id && (
              <DeleteDocument
                what="this meeting"
                pending={editor.pending}
                onDelete={() => void editor.remove().then(() => navigate('/group/calendar'))}
              />
            )}
          </SaveBar>
        </form>
      </Form>
    </article>
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
  if (members.isError) return <QueryError queries={[members]} />;
  if (members.isPending) return <Loading />;
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
          <FormRow
            control={form.control}
            name="displayName"
            label="Name"
            hint="As the group knows you; a last name is welcome."
          >
            {(field) => <Input autoComplete="name" {...field} />}
          </FormRow>
          <FormRow control={form.control} name="phone" label="Phone">
            {(field) => <Input type="tel" autoComplete="tel" {...field} />}
          </FormRow>
          <FormRow
            control={form.control}
            name="address"
            label="Address"
            hint="A street address, or just the neighborhood."
          >
            {(field) => <Input autoComplete="street-address" {...field} />}
          </FormRow>
          <FormRow
            control={form.control}
            name="notes"
            label="Notes"
            hint='"Text, don’t call, after eight." Allergies. Whatever helps.'
          >
            {(field) => <Input {...field} />}
          </FormRow>
          <SaveBar pending={form.formState.isSubmitting} />
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
              <span>This name is on {phonesLine(member.deviceCount)}.</span>
              <ConfirmButton
                label="Clear phones"
                title={`Sign ${member.displayName}’s phones out?`}
                confirmLabel="Yes, clear them"
                pending={clear.isPending}
                onConfirm={() => clear.mutate(member.id)}
              >
                Every phone holding the name is refused from its next request; they open the link
                again and tap the name.
              </ConfirmButton>
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

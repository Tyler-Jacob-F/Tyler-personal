import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AgentScope,
  agentScopes,
  agentScopeSchema,
  agentTokenNameSchema,
  type CreateAgentTokenResponse,
} from '@the-keep/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateToken, useRevokeToken, useTokens, useUpdateToken } from '@/api/tokens';
import { AdminNav } from '@/components/AdminNav';
import { Alert } from '@/components/Alert';
import { ConfirmButton } from '@/components/ConfirmDialog';
import { Loading, QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Form } from '@/components/ui/form';
import { FormRow } from '@/components/ui/form-row';
import { Input } from '@/components/ui/input';
import { when } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { scopeDescriptions } from '@/routes/admin/scopes';

const tokenFormSchema = z.object({
  name: agentTokenNameSchema,
  scopes: z.array(agentScopeSchema).min(1, 'Pick at least one scope.'),
});
type TokenFormValues = z.infer<typeof tokenFormSchema>;

/**
 * Agent tokens: issue one (the secret is shown exactly once), see when each was last used,
 * change its scopes, revoke. The name and the secret never change; a scope edit reaches
 * every client holding the token on its next request.
 */
export function TokensPage() {
  const tokens = useTokens();
  const [issued, setIssued] = useState<CreateAgentTokenResponse | null>(null);

  return (
    <div className="grid gap-8">
      <AdminNav />
      <div>
        <h1 className="page-title">Agent tokens</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Each token is a named agent with the scopes it carries and nothing more. No token can
          promote a document, manage members or manage tokens.
        </p>
      </div>

      {issued ? (
        <IssuedPanel issued={issued} onDone={() => setIssued(null)} />
      ) : (
        <CreateTokenForm onCreated={setIssued} />
      )}

      <section className="grid gap-3">
        <h2 className="eyebrow">Issued</h2>
        <QueryError queries={[tokens]} />
        {tokens.isPending && <Loading />}
        {tokens.data && tokens.data.items.length === 0 && (
          <p className="text-sm text-muted">No tokens yet.</p>
        )}
        {tokens.data && tokens.data.items.length > 0 && (
          <ul className="divide-y divide-border border-y border-border">
            {tokens.data.items.map((token) => (
              <TokenRow key={token.id} token={token} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScopePicker({
  value,
  onChange,
  name,
  onBlur,
}: {
  value: AgentScope[];
  onChange(scopes: AgentScope[]): void;
  name?: string;
  onBlur?(): void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2" role="group" aria-label="Scopes">
      {agentScopes.map((scope) => {
        const checked = value.includes(scope);
        return (
          <label
            key={scope}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm',
              checked ? 'border-text bg-surface' : 'border-border',
            )}
          >
            <input
              type="checkbox"
              className="mt-1 accent-accent"
              name={name}
              value={scope}
              checked={checked}
              onBlur={onBlur}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? agentScopes.filter((s) => s === scope || value.includes(s))
                    : value.filter((s: AgentScope) => s !== scope),
                )
              }
            />
            <span>
              <span className="font-mono text-xs">{scope}</span>
              <span className="block text-xs text-muted">{scopeDescriptions[scope]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function CreateTokenForm({ onCreated }: { onCreated(issued: CreateAgentTokenResponse): void }) {
  const create = useCreateToken();
  const form = useForm<TokenFormValues>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: { name: '', scopes: [] },
  });

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-5 border-y border-border py-5"
        onSubmit={form.handleSubmit(async (values) => {
          onCreated(await create.mutateAsync(values).catch(() => undefined as never));
          if (!create.isError) form.reset();
        })}
      >
        <h2 className="font-serif text-xl font-medium text-text-strong">New token</h2>
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <FormRow
          control={form.control}
          name="name"
          label="Name"
          className="md:max-w-xs"
          hint="Lowercase, hyphens allowed. History shows it as the author of every version this token writes, so it cannot be reused later."
        >
          {(field) => <Input placeholder="importer" autoComplete="off" {...field} />}
        </FormRow>
        <FormRow control={form.control} name="scopes" label="Scopes" bare>
          {(field) => (
            <ScopePicker
              value={field.value}
              onChange={field.onChange}
              name={field.name}
              onBlur={field.onBlur}
            />
          )}
        </FormRow>
        <div>
          <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
            Create token
          </Button>
        </div>
      </form>
    </Form>
  );
}

function IssuedPanel({ issued, onDone }: { issued: CreateAgentTokenResponse; onDone(): void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section
      aria-label="New token secret"
      className="grid gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div>
        <h2 className="font-serif text-xl font-medium text-text-strong">
          <span className="font-mono text-lg">{issued.token.name}</span> is ready
        </h2>
        <p className="mt-1 text-sm">
          Copy the secret now and paste it into its home. It is shown once and cannot be recovered;
          if it is lost, revoke this token and issue another.
        </p>
      </div>
      <code
        data-testid="token-secret"
        className="block rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm break-all select-all"
      >
        {issued.secret}
      </code>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="accent" onClick={copy}>
          {copied ? 'Copied' : 'Copy secret'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Done, I have it
        </Button>
        <span className="text-xs text-muted">Scopes: {issued.token.scopes.join(' ')}</span>
      </div>
    </section>
  );
}

function TokenRow({
  token,
}: {
  token: {
    id: string;
    name: string;
    scopes: AgentScope[];
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  };
}) {
  const revoke = useRevokeToken();
  const update = useUpdateToken();
  const [editing, setEditing] = useState<AgentScope[] | null>(null);
  const revoked = token.revokedAt !== null;
  if (editing) {
    return (
      <li className="grid gap-3 py-3 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-medium">{token.name}</span>
          <span className="text-xs text-muted">
            scopes take effect on the token&apos;s next request
          </span>
        </div>
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <ScopePicker value={editing} onChange={setEditing} />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="accent"
            disabled={editing.length === 0 || update.isPending}
            onClick={() =>
              update.mutate(
                { id: token.id, scopes: editing },
                { onSuccess: () => setEditing(null) },
              )
            }
          >
            Save scopes
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
      <div className="grid gap-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono font-medium', revoked && 'line-through opacity-60')}>
            {token.name}
          </span>
          {revoked && <span className="text-xs text-wrong">revoked {when(token.revokedAt!)}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {token.scopes.map((scope) => (
            <Chip key={scope} className="font-mono">
              {scope}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted">
          created {when(token.createdAt)} ·{' '}
          {token.lastUsedAt ? `last used ${when(token.lastUsedAt)}` : 'never used'}
        </p>
      </div>
      {!revoked && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(token.scopes)}>
            Edit scopes
          </Button>
          <ConfirmButton
            label="Revoke"
            className="text-wrong"
            title={`Revoke ${token.name}?`}
            confirmLabel="Yes, revoke"
            pending={revoke.isPending}
            onConfirm={() => revoke.mutate(token.id)}
          >
            Anything holding it stops working now. The name stays in history and cannot be reused.
          </ConfirmButton>
        </div>
      )}
    </li>
  );
}

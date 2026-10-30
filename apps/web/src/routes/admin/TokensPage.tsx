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
import { useCreateToken, useRevokeToken, useTokens } from '@/api/tokens';
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
import { cn } from '@/lib/utils';
import { scopeDescriptions } from '@/routes/admin/scopes';
import { when } from '@/routes/recipes/format';

const tokenFormSchema = z.object({
  name: agentTokenNameSchema,
  scopes: z.array(agentScopeSchema).min(1, 'Pick at least one scope.'),
});
type TokenFormValues = z.infer<typeof tokenFormSchema>;

/**
 * Agent tokens: issue one (the secret is shown exactly once), see when each was last used,
 * revoke. Nothing here edits a token; revoke and reissue is the whole lifecycle.
 */
export function TokensPage() {
  const tokens = useTokens();
  const [issued, setIssued] = useState<CreateAgentTokenResponse | null>(null);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Agent tokens</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
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
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Issued
        </h2>
        {tokens.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {tokens.isError && <Alert tone="danger">{tokens.error.message}</Alert>}
        {tokens.data && tokens.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        )}
        {tokens.data && tokens.data.items.length > 0 && (
          <ul className="divide-y divide-border rounded-card border border-border">
            {tokens.data.items.map((token) => (
              <TokenRow key={token.id} token={token} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateTokenForm({ onCreated }: { onCreated(issued: CreateAgentTokenResponse): void }) {
  const create = useCreateToken();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<TokenFormValues>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: { name: '', scopes: [] },
  });

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-5 rounded-card border border-border p-5"
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            onCreated(await create.mutateAsync(values));
            form.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create the token.');
          }
        })}
      >
        <h2 className="text-base font-semibold tracking-tight">New token</h2>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="md:max-w-xs">
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="importer" autoComplete="off" {...field} />
              </FormControl>
              <FormDescription>
                Lowercase, hyphens allowed. History shows it as the author of every version this
                token writes, so it cannot be reused later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="scopes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Scopes</FormLabel>
              <div className="grid gap-2 md:grid-cols-2" role="group" aria-label="Scopes">
                {agentScopes.map((scope) => {
                  const checked = field.value.includes(scope);
                  return (
                    <label
                      key={scope}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2 text-sm',
                        checked ? 'border-foreground bg-muted' : 'border-border',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-foreground"
                        name={field.name}
                        value={scope}
                        checked={checked}
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? agentScopes.filter((s) => s === scope || field.value.includes(s))
                              : field.value.filter((s: AgentScope) => s !== scope),
                          )
                        }
                      />
                      <span>
                        <span className="font-mono text-xs">{scope}</span>
                        <span className="block text-xs text-muted-foreground">
                          {scopeDescriptions[scope]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
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
      className="grid gap-4 rounded-card border border-highlight bg-highlight-subtle p-5"
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          <span className="font-mono">{issued.token.name}</span> is ready
        </h2>
        <p className="mt-1 text-sm">
          Copy the secret now and paste it into its home. It is shown once and cannot be recovered;
          if it is lost, revoke this token and issue another.
        </p>
      </div>
      <code
        data-testid="token-secret"
        className="block rounded-control border border-border bg-background px-3 py-2 font-mono text-sm break-all select-all"
      >
        {issued.secret}
      </code>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy secret'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Done, I have it
        </Button>
        <span className="text-xs text-muted-foreground">
          Scopes: {issued.token.scopes.join(' ')}
        </span>
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
  const revoked = token.revokedAt !== null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
      <div className="grid gap-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono font-medium', revoked && 'line-through opacity-60')}>
            {token.name}
          </span>
          {revoked && (
            <span className="text-xs text-destructive">revoked {when(token.revokedAt!)}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {token.scopes.map((scope) => (
            <span
              key={scope}
              className="rounded-control border border-border bg-muted px-1.5 py-0.5 font-mono text-xs"
            >
              {scope}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          created {when(token.createdAt)} ·{' '}
          {token.lastUsedAt ? `last used ${when(token.lastUsedAt)}` : 'never used'}
        </p>
      </div>
      {!revoked && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={revoke.isPending}
          onClick={() => {
            if (!window.confirm(`Revoke ${token.name}? Anything holding it stops working now.`))
              return;
            revoke.mutate(token.id);
          }}
        >
          Revoke
        </Button>
      )}
    </li>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router';
import { z } from 'zod';
import { AuthError, type Challenge } from '@/auth/gateway';
import { useAuth } from '@/auth/useAuth';
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

const emailSchema = z.object({ email: z.email('Enter the email address on the allowlist.') });
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'The code is six digits.') });

function message(error: unknown): string {
  return error instanceof AuthError ? error.message : 'Something went wrong. Try again.';
}

/** Two steps: email, then the six-digit code that email delivers. */
export function SignIn() {
  const { state, rememberedEmail, requestCode, submitCode } = useAuth();
  const location = useLocation();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: rememberedEmail ?? '' },
  });
  const codeForm = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  if (state.status === 'restoring') {
    return <p className="p-6 text-sm text-muted-foreground">Signing you back in…</p>;
  }
  if (state.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const onEmail = emailForm.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      setChallenge(await requestCode(email));
    } catch (e) {
      setError(message(e));
    }
  });

  const onCode = codeForm.handleSubmit(async ({ code }) => {
    if (!challenge) return;
    setError(null);
    try {
      const ok = await submitCode(challenge, code);
      if (!ok) {
        codeForm.setError('code', {
          message: 'That code is not right. Check the email and try again.',
        });
      }
    } catch (e) {
      setError(message(e));
    }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        The Keep
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>

      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}

      {!challenge ? (
        <Form {...emailForm}>
          <form onSubmit={onEmail} className="mt-6 grid gap-4" noValidate>
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="username"
                      autoFocus={!rememberedEmail}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>A six-digit code goes to this address.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              autoFocus={Boolean(rememberedEmail)}
              disabled={emailForm.formState.isSubmitting}
            >
              Send code
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...codeForm}>
          <form onSubmit={onCode} className="mt-6 grid gap-4" noValidate>
            <FormField
              control={codeForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" autoComplete="one-time-code" autoFocus {...field} />
                  </FormControl>
                  <FormDescription>
                    Sent to {challenge.email}. It expires in ten minutes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={codeForm.formState.isSubmitting}>
              Sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChallenge(null);
                setError(null);
                codeForm.reset();
              }}
            >
              Use a different email
            </Button>
          </form>
        </Form>
      )}
    </main>
  );
}

import { type ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NODES, TRACES } from '@/routes/stack/data';
import { Diagram } from '@/routes/stack/Diagram';

const traceOrder = ['page', 'signin', 'save', 'deploy'] as const;
const traceLabels: Record<(typeof traceOrder)[number], string> = {
  page: 'Load the page',
  signin: 'Sign in',
  save: 'Save a recipe',
  deploy: 'Deploy',
};

const Eyebrow = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</p>
);

/**
 * How the site is put together, for the person who has to live with it. Click a piece for
 * what it is, why, what it costs and where to find it; or step through a request.
 */
export function StackPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [trace, setTrace] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const current = trace ? TRACES[trace] : undefined;
  const currentStep = current?.steps[step];
  const litNodes = useMemo(() => new Set(currentStep?.nodes ?? []), [currentStep]);
  const litEdges = useMemo(() => new Set(currentStep?.edges ?? []), [currentStep]);

  const select = (id: string) => {
    setTrace(null);
    setSelected(id);
  };
  const startTrace = (name: string | null) => {
    setSelected(null);
    setStep(0);
    setTrace(name);
  };

  const node = selected ? NODES[selected] : undefined;

  return (
    <div className="grid gap-6">
      <div>
        <Eyebrow>tylerfuqua.com · after Phase 1</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">The Keep, under the hood</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Five CloudFormation stacks, one domain, nothing always on except a database that sleeps.
          Click any box to learn what it is and why it is there, or trace a request to watch it
          move.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <section aria-label="Architecture diagram" className="min-w-0 lg:sticky lg:top-4">
          <div
            className="mb-3 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Trace a request"
          >
            <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Trace
            </span>
            {traceOrder.map((name) => (
              <Button
                key={name}
                size="sm"
                variant={trace === name ? 'default' : 'outline'}
                aria-pressed={trace === name}
                onClick={() => startTrace(trace === name ? null : name)}
              >
                {traceLabels[name]}
              </Button>
            ))}
            {(trace || selected) && (
              <Button size="sm" variant="ghost" onClick={() => startTrace(null)}>
                Clear
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-card border border-border bg-background">
            <figure className="m-0 min-w-[54rem] p-3">
              <Diagram
                selected={selected}
                litNodes={litNodes}
                litEdges={litEdges}
                tracing={Boolean(current)}
                onSelect={select}
              />
              <figcaption className="mt-2 text-xs text-muted-foreground">
                Solid arrows carry data; dashed arrows carry trust or configuration. Highlights show
                the request you are tracing.
              </figcaption>
            </figure>
          </div>
        </section>

        <aside className="min-w-0 rounded-card border border-border p-5" aria-live="polite">
          {current && currentStep ? (
            <div className="grid gap-4">
              <div>
                <Eyebrow>Trace</Eyebrow>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{current.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={step === current.steps.length - 1}
                  onClick={() => setStep(step + 1)}
                >
                  Next
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  step {step + 1} of {current.steps.length}
                </span>
              </div>
              <ol className="grid gap-1.5 text-sm">
                {current.steps.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={i === step ? 'step' : undefined}
                      onClick={() => setStep(i)}
                      className={cn(
                        'w-full rounded-control border border-transparent px-3 py-2 text-left',
                        i === step && 'border-highlight bg-highlight-subtle',
                      )}
                    >
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {s.text}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : node ? (
            <div className="grid gap-3 text-sm">
              <div>
                <Eyebrow>{node.kicker}</Eyebrow>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{node.title}</h2>
              </div>
              <Section title="What it is">{node.what}</Section>
              <Section title="Why it is there">{node.why}</Section>
              <Section title="What it costs">{node.cost}</Section>
              <div>
                <Eyebrow>Where to find it</Eyebrow>
                <pre className="mt-1 rounded-control border border-border bg-muted px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">
                  {node.where}
                </pre>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              <div>
                <Eyebrow>Start here</Eyebrow>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  How a solo site became five stacks
                </h2>
              </div>
              <p>
                Your admin user did two things by hand:{' '}
                <code className="font-mono text-xs">cdk bootstrap</code>, which created a bucket and
                an administrator execution role for CloudFormation, and the first deploy of the
                account stack, which taught AWS to trust GitHub. Everything since has been GitHub
                asking CloudFormation to build what the TypeScript under{' '}
                <code className="font-mono text-xs">infra/lib</code> describes.
              </p>
              <p>
                Click a box in the diagram to see what it is, why it is there, what it costs and
                where to find it in the console. Or trace a request and step through it.
              </p>
              <Eyebrow>The two ideas that matter</Eyebrow>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>A chain of trust.</strong> GitHub proves which repo and branch is running;
                  AWS hands it a one-hour, deliberately weak role; that role asks CloudFormation to
                  act; CloudFormation uses the one admin role nothing else holds.
                </li>
                <li>
                  <strong>A translation layer.</strong> CDK code does not touch AWS. It writes
                  CloudFormation templates. Deploy means "make reality match this JSON," with
                  rollback if it cannot.
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="What costs money">
          <table className="w-full text-sm">
            <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-1.5 [&_td]:align-top">
              <tr>
                <td>Route 53 hosted zone</td>
                <td className="text-right tabular-nums whitespace-nowrap">$0.50 / mo</td>
              </tr>
              <tr>
                <td>Secrets Manager, one secret</td>
                <td className="text-right tabular-nums whitespace-nowrap">$0.40 / mo</td>
              </tr>
              <tr>
                <td>Aurora storage</td>
                <td className="text-right tabular-nums whitespace-nowrap">$0.10 / GB-mo</td>
              </tr>
              <tr>
                <td>Aurora compute, only while awake</td>
                <td className="text-right tabular-nums whitespace-nowrap">$0.12 / ACU-hr</td>
              </tr>
              <tr>
                <td>CloudFront, S3, Lambda, API Gateway, Cognito, SES, CloudWatch</td>
                <td className="text-right whitespace-nowrap">free tier</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            The budget alarm fires at $5. If it ever does, check first whether the cluster stopped
            pausing.
          </p>
        </Card>
        <Card title="Decisions you could reverse">
          <p>
            <strong>Data API instead of a Postgres driver.</strong> Tens of milliseconds per query,
            invisible at this scale; it keeps every Lambda out of the VPC and the password out of
            every environment. A driver is a one-file swap plus moving the functions into the VPC.
          </p>
          <p>
            <strong>The id token as the API bearer.</strong> It carries the verified email the
            identity middleware needs.
          </p>
          <p>
            <strong>Deploy role grants from the data stack.</strong> Saved a local redeploy of the
            account stack, at the cost of one stack modifying a role another owns.
          </p>
          <p>
            <strong>Tokens in memory only.</strong> A reload asks for a new code. Persisting the
            refresh token is a Phase 2 question.
          </p>
        </Card>
        <Card title="Where to look">
          <p>
            <strong>CloudFormation, Stacks.</strong> The best map: five stacks and every resource
            each owns, with the template that made it.
          </p>
          <p>
            <strong>RDS, Databases.</strong> The cluster and whether it is paused right now.
          </p>
          <p>
            <strong>CloudWatch, Dashboards.</strong> Lambda errors and duration, API 4xx and 5xx,
            Aurora ACU.
          </p>
          <p>
            <strong>In the repo.</strong>{' '}
            <code className="font-mono text-xs">pnpm -C infra synth</code> writes the literal
            templates to <code className="font-mono text-xs">infra/cdk.out</code>. The directives
            under <code className="font-mono text-xs">docs/phases</code> record every decision and
            why.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-card border border-border p-5 text-sm [&_p]:mb-2 [&_p:last-child]:mb-0">
      <h2 className="mb-3 text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

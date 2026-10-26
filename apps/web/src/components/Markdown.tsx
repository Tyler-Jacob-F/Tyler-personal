import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';

const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: (p) => <h2 className="mt-6 text-lg font-semibold tracking-tight first:mt-0" {...p} />,
  h2: (p) => <h2 className="mt-6 text-lg font-semibold tracking-tight first:mt-0" {...p} />,
  h3: (p) => <h3 className="mt-5 text-base font-semibold first:mt-0" {...p} />,
  h4: (p) => (
    <h4
      className="mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground first:mt-0"
      {...p}
    />
  ),
  p: (p) => <p className="mt-3 leading-relaxed first:mt-0" {...p} />,
  ul: (p) => <ul className="mt-3 list-disc space-y-1 pl-5 first:mt-0" {...p} />,
  ol: (p) => <ol className="mt-3 list-decimal space-y-2 pl-5 first:mt-0" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  em: (p) => <em className="italic" {...p} />,
  blockquote: (p) => (
    <blockquote className="mt-3 border-l-2 border-border pl-4 text-muted-foreground" {...p} />
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: (p) => (
    <code className="rounded-control bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...p} />
  ),
  a: (p) => <a className="underline underline-offset-2" {...p} />,
};

/** Recipe bodies are markdown; render them with the theme's tokens and nothing else. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}

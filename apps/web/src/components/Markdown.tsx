import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type Components = NonNullable<ComponentProps<typeof ReactMarkdown>['components']>;

/** Shared by both measures; the eyebrow and link treatments are the contract's. */
const shared: Components = {
  h4: (p) => <h4 className="eyebrow mt-5 mb-1.5 first:mt-0" {...p} />,
  ul: (p) => <ul className="mt-3 list-disc space-y-1 pl-5 first:mt-0" {...p} />,
  ol: (p) => <ol className="mt-3 list-decimal space-y-2 pl-5 first:mt-0" {...p} />,
  li: (p) => <li {...p} />,
  strong: (p) => <strong className="font-semibold text-text-strong" {...p} />,
  em: (p) => <em className="italic" {...p} />,
  blockquote: (p) => (
    <blockquote className="mt-3 border-l-2 border-border pl-4 text-muted italic" {...p} />
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: (p) => (
    <code className="rounded-sm bg-surface-raised px-1 py-0.5 font-mono text-[0.9em]" {...p} />
  ),
  a: (p) => <a className="underline decoration-border-strong underline-offset-[3px]" {...p} />,
};

/** The UI measure: Source Sans, 15px. */
const ui: Components = {
  ...shared,
  h1: (p) => <h2 className="mt-6 text-lg font-semibold text-text-strong first:mt-0" {...p} />,
  h2: (p) => <h2 className="mt-6 text-lg font-semibold text-text-strong first:mt-0" {...p} />,
  h3: (p) => <h3 className="mt-5 text-base font-semibold text-text-strong first:mt-0" {...p} />,
  p: (p) => <p className="mt-3 leading-relaxed first:mt-0" {...p} />,
};

/** The reading measure: Literata 18/1.6, section labels as eyebrows (docs/DESIGN-VALUES.md "Type"). */
const reading: Components = {
  ...shared,
  h1: (p) => (
    <h2 className="mt-8 font-serif text-2xl font-medium text-text-strong first:mt-0" {...p} />
  ),
  h2: (p) => (
    <h2 className="mt-8 font-serif text-2xl font-medium text-text-strong first:mt-0" {...p} />
  ),
  h3: (p) => (
    <h3 className="mt-6 font-serif text-xl font-medium text-text-strong first:mt-0" {...p} />
  ),
  p: (p) => <p className="mt-4 first:mt-0" {...p} />,
  ol: (p) => <ol className="mt-4 list-decimal space-y-3 pl-6 first:mt-0" {...p} />,
  ul: (p) => <ul className="mt-4 list-disc space-y-2 pl-6 first:mt-0" {...p} />,
};

/** A single line of markdown with no block wrapper, for table-like rows. */
const inline: Components = {
  ...shared,
  p: (p) => <span {...p} />,
};

const variants = { ui, reading, inline } as const;

export function Markdown({
  children,
  variant = 'ui',
  className,
}: {
  children: string;
  variant?: keyof typeof variants;
  className?: string;
}) {
  const body = <ReactMarkdown components={variants[variant]}>{children}</ReactMarkdown>;
  if (variant === 'inline') return <span className={className}>{body}</span>;
  return (
    <div className={cn(variant === 'reading' ? 'reading' : 'text-[15px]', className)}>{body}</div>
  );
}

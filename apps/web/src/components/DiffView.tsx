import { cn } from '@/lib/utils';

type Kind = 'header' | 'hunk' | 'added' | 'removed' | 'context';

function classify(line: string): Kind {
  if (
    line.startsWith('+++') ||
    line.startsWith('---') ||
    line.startsWith('Index:') ||
    line.startsWith('===')
  ) {
    return 'header';
  }
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  return 'context';
}

const styles: Record<Kind, string> = {
  header: 'text-muted',
  hunk: 'bg-surface text-muted',
  added: 'bg-success/10 text-success',
  removed: 'bg-wrong/10 text-wrong',
  context: '',
};

/**
 * Renders a unified diff the server produced. The server already did the work; the
 * client only colors lines, so no diff library ships to the browser.
 */
export function DiffView({ patch }: { patch: string }) {
  const lines = patch.replace(/\n$/, '').split('\n');
  const body = lines.filter((line) => classify(line) !== 'header');
  if (body.length === 0 || body.every((line) => classify(line) === 'context')) {
    return <p className="text-sm text-muted">No changes to the method.</p>;
  }
  return (
    <pre className="overflow-x-auto rounded-lg border border-border font-mono text-xs leading-5">
      {body.map((line, i) => (
        <div key={i} className={cn('px-3 whitespace-pre', styles[classify(line)])}>
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}

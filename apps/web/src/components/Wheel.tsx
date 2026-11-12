import { type Translation, translationInfo } from '@the-keep/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { spinWheel } from '@/lib/translation';
import { cn } from '@/lib/utils';
import {
  buzz,
  CONFETTI_MS,
  labelPlacement,
  landingRotation,
  SPIN_MS,
  WEDGE_LABELS,
  WEDGES,
  wedgePath,
  WHEEL_LINES,
} from '@/lib/wheel';

/**
 * The wheel (docs/phases/04-group.md "Translations"): a full-screen overlay with a wheel of
 * fortune, ten wedges, a pointer at the top. It spins for four seconds with a hard
 * ease-out so the last wedges crawl past, lands with a buzz and a second of confetti, and
 * says one line about where it landed. "Read it" takes the translation; "Spin again" is the
 * coward's button. Everything loud lives inside this overlay, so the page under it keeps
 * the design values' one accent and its calm; the phase doc records that choice. Reduced
 * motion lands at once, with no confetti.
 */
export function Wheel({
  current,
  onChoose,
  onClose,
}: {
  current: Translation;
  onChoose: (translation: Translation) => void;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState<Translation | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [still] = useState(() => reducedMotion());
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const spin = () => {
    if (spinning) return;
    const from = landed ?? current;
    const target = spinWheel(from);
    setLanded(null);
    setConfetti(false);
    setSpinning(true);
    setRotation((r) => landingRotation(target, r));
    later(still ? 0 : SPIN_MS, () => {
      setSpinning(false);
      setLanded(target);
      buzz();
      if (!still) {
        setConfetti(true);
        later(CONFETTI_MS, () => setConfetti(false));
      }
    });
  };

  // The wheel starts turning the moment it opens: nobody opens a wheel to look at it.
  useEffect(() => {
    const id = setTimeout(spin, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const read = () => {
    if (landed) onChoose(landed);
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wheel-heading"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-bg/95 px-4 py-6 outline-none"
    >
      {confetti && <Confetti />}
      <div className="relative mx-auto w-full max-w-sm text-center">
        <h2 id="wheel-heading" className="eyebrow">
          The wheel
        </h2>
        <div className="relative mx-auto mt-5 aspect-square w-full max-w-[22rem]">
          <Pointer />
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label={spinning ? 'The wheel is spinning' : 'The wheel'}
            className={cn('block size-full drop-shadow-sm', !still && 'transition-transform')}
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: still ? '0ms' : `${SPIN_MS}ms`,
              transitionTimingFunction: 'cubic-bezier(0.12, 0.7, 0.08, 1)',
            }}
          >
            {WEDGES.map((code, index) => (
              <path
                key={code}
                d={wedgePath(index, 100, 97)}
                className={cn(
                  'stroke-border-strong transition-colors duration-300',
                  landed === code
                    ? 'fill-accent'
                    : index % 2 === 0
                      ? 'fill-surface'
                      : 'fill-surface-raised',
                )}
                strokeWidth="0.8"
              />
            ))}
            {WEDGES.map((code, index) => {
              const { x, y, rotate } = labelPlacement(index, 100, 68);
              return (
                <text
                  key={code}
                  x={x}
                  y={y}
                  transform={`rotate(${rotate} ${x} ${y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    'font-sans text-[9px] font-semibold tracking-wide',
                    landed === code ? 'fill-on-accent' : 'fill-text-strong',
                  )}
                >
                  {WEDGE_LABELS[code]}
                </text>
              );
            })}
            <circle
              cx="100"
              cy="100"
              r="9"
              className="fill-bg stroke-border-strong"
              strokeWidth="0.8"
            />
          </svg>
        </div>

        <div className="mt-6 min-h-24" aria-live="polite">
          {landed ? (
            <>
              <p className="font-serif text-2xl leading-snug font-medium text-text-strong">
                {translationInfo[landed].name}
              </p>
              <p className="reading mt-2 text-muted italic">{WHEEL_LINES[landed]}</p>
            </>
          ) : (
            <p className="reading text-muted italic">{spinning ? 'Round she goes…' : ' '}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button variant="accent" onClick={read} disabled={!landed}>
            Read it
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={spin}
            disabled={spinning}
            className="text-muted"
          >
            Spin again
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted">
            Never mind
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The pointer at the top, the overlay's accent along with the winning wedge. */
function Pointer() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="absolute top-0 left-1/2 z-10 size-7 -translate-x-1/2 -translate-y-1/3 drop-shadow"
    >
      <path d="M 2 2 L 18 2 L 10 18 Z" className="fill-accent stroke-bg" strokeWidth="1.5" />
    </svg>
  );
}

const PIECES = 28;

/** A second of paper in the theme's colours, falling from the top; gone before anyone tires of it. */
function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i * 53) % 400;
        const drift = ((i * 29) % 60) - 30;
        const tone = ['bg-accent', 'bg-text-strong', 'bg-border-strong', 'bg-accent-hover'][i % 4];
        return (
          <span
            key={i}
            className={cn('absolute -top-3 block h-3 w-2 animate-confetti rounded-sm', tone)}
            style={{
              left: `${left}%`,
              animationDelay: `${delay}ms`,
              ['--drift' as string]: `${drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

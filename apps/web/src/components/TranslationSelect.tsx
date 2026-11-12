import { type Translation, translationInfo, translations } from '@the-keep/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { fieldClasses } from '@/components/ui/styles';
import { spinWheel } from '@/lib/translation';
import { cn } from '@/lib/utils';

/** Ticks the drum makes before it lands, the first this long, each a fifth longer. */
const TICKS = 10;
const FIRST_TICK_MS = 60;
const TICK_GROWTH = 1.2;
const LANDED_MS = 350;

/**
 * Which translation the readings are in (docs/phases/04-group.md "Translations"): the
 * browser's own select, remembered by the device. `wheel` adds the spin: a Thursday-night
 * lark that lands on any translation but the one showing, the names running past like a
 * drum before it settles. Reduced motion, or a test, lands at once.
 */
export function TranslationSelect({
  value,
  onChange,
  wheel = false,
  className,
}: {
  value: Translation;
  onChange: (next: Translation) => void;
  wheel?: boolean;
  className?: string;
}) {
  const [drum, setDrum] = useState<{ shown: Translation; landed: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const spin = () => {
    if (drum) return;
    const target = spinWheel(value);
    if (reducedMotion()) return onChange(target);
    let shown = value;
    setDrum({ shown, landed: false });
    const tick = (n: number, delay: number) => {
      timer.current = setTimeout(() => {
        if (n === TICKS) {
          setDrum({ shown: target, landed: true });
          onChange(target);
          timer.current = setTimeout(() => setDrum(null), LANDED_MS);
          return;
        }
        shown = spinWheel(shown);
        setDrum({ shown, landed: false });
        tick(n + 1, delay * TICK_GROWTH);
      }, delay);
    };
    tick(0, FIRST_TICK_MS);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <label className="flex items-center gap-3 text-[13px] text-muted">
        <span>Read in</span>
        {drum ? (
          <span
            role="status"
            aria-live="polite"
            className={cn(
              fieldClasses,
              'flex h-11 w-auto min-w-48 items-center pr-9 transition-colors',
              drum.landed ? 'border-border-strong font-semibold text-text-strong' : 'text-text',
            )}
          >
            {translationInfo[drum.shown].name}
          </span>
        ) : (
          <Select
            aria-label="Translation"
            value={value}
            onChange={(event) => onChange(event.target.value as Translation)}
            className="w-auto min-w-48 text-text"
          >
            {translations.map((code) => (
              <option key={code} value={code}>
                {translationInfo[code].name}
              </option>
            ))}
          </Select>
        )}
      </label>
      {wheel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={spin}
          disabled={drum !== null}
          className="-ml-3 text-muted sm:ml-0"
        >
          {drum && !drum.landed ? 'Spinning…' : 'Spin the wheel'}
        </Button>
      )}
    </div>
  );
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

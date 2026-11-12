import { type Translation, translationInfo, translations } from '@the-keep/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Wheel } from '@/components/Wheel';
import { cn } from '@/lib/utils';

/**
 * Which translation the readings are in (docs/phases/04-group.md "Translations"): the
 * browser's own select, remembered by the device. `wheel` adds "Spin the wheel", which
 * opens the Wheel overlay; what it lands on comes back through `onChange` when the room
 * accepts it.
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
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <label className="flex items-center gap-3 text-[13px] text-muted">
        <span>Read in</span>
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
      </label>
      {wheel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="-ml-3 text-muted sm:ml-0"
        >
          Spin the wheel
        </Button>
      )}
      {open && (
        <Wheel
          current={value}
          onChoose={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

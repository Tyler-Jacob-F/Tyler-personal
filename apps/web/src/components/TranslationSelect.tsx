import { type Translation, translationInfo, translations } from '@the-keep/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Which translation the readings are in (docs/phases/04-group.md "Translations"): the
 * browser's own select, remembered by the device. `spin` is the wheel: a Thursday-night
 * lark that lands every phone in the room on the same translation for the week.
 */
export function TranslationSelect({
  value,
  onChange,
  spin,
  className,
}: {
  value: Translation;
  onChange: (next: Translation) => void;
  spin?: () => void;
  className?: string;
}) {
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
      {spin && (
        <Button variant="ghost" size="sm" onClick={spin} className="-ml-3 text-muted sm:ml-0">
          Spin the wheel
        </Button>
      )}
    </div>
  );
}

import type { ComponentProps } from 'react';

/** Inline stroke icons, 1.75px, currentColor: no icon font, no package (docs/DESIGN-VALUES.md). */
function Icon({ children, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const PlusIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MenuIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const ChevronDownIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const CheckIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const SunIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Icon>
);

export const MoonIcon = (p: ComponentProps<'svg'>) => (
  <Icon {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icon>
);

/** The Keep mark (docs/design/keep-mark.svg): always text-strong, never the accent. */
export const KeepMark = ({ size = 20, ...p }: ComponentProps<'svg'> & { size?: number }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} fill="currentColor" aria-hidden="true" {...p}>
    <path
      fillRule="evenodd"
      d={
        size <= 20
          ? 'M18 12H24V20H29V12H35V20H40V12H46V58H18ZM28 58V48A4 4 0 0 1 36 48V58Z'
          : 'M18 12H24V20H29V12H35V20H40V12H46V58H18ZM31 26H33V31H36V33H33V40H31V33H28V31H31ZM28 58V48A4 4 0 0 1 36 48V58Z'
      }
    />
  </svg>
);

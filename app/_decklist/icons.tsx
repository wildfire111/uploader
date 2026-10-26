// small inline icons, drawn on a 16px grid with a 1.75 stroke so they sit beside text

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </Icon>
  );
}

export function WarnIcon() {
  return (
    <Icon>
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3" />
      <path d="M8 11.5v.01" />
    </Icon>
  );
}

export function ChevronDownIcon() {
  return (
    <Icon>
      <path d="m4 6 4 4 4-4" />
    </Icon>
  );
}

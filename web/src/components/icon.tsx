export type IconName =
  | "grid"
  | "leaf"
  | "layers"
  | "requests"
  | "spark"
  | "swap"
  | "arrow"
  | "pin"
  | "search"
  | "menu"
  | "close"
  | "logout";
const paths: Record<IconName, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  leaf: "M20 3C9 2 3 6 4 13c1 7 12 8 15-2 1-3 1-6 1-8Z M4 21 15 10 M9 16v-6 M9 16h6",
  layers: "m12 3 10 5-10 5L2 8l10-5Z M2 12l10 5 10-5 M2 16l10 5 10-5",
  requests: "M8 4H4v17h16V4h-4 M8 2h8v5H8z M8 12h8 M8 16h5",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
  swap: "M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z m-2 5 6 6",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  close: "m5 5 14 14 M5 19 19 5",
  logout: "M9 3H3v18h6 M9 12h12 M16 7l5 5-5 5",
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

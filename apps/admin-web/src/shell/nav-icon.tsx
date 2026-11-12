export const navIcons = [
  "house",
  "chart",
  "scroll",
  "book",
  "package",
  "bike",
  "calendar",
  "building",
  "landmark",
  "users",
  "clock",
  "card",
] as const;

export type NavIconName = (typeof navIcons)[number];

const paths: Record<NavIconName, string[]> = {
  house: [
    "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
    "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ],
  chart: ["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"],
  scroll: [
    "M15 12h-5",
    "M15 8h-5",
    "M19 17V5a2 2 0 0 0-2-2H4",
    "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
  ],
  book: [
    "M12 7v14",
    "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
  ],
  package: [
    "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
    "M12 22V12",
    "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7",
    "m7.5 4.27 9 5.15",
  ],
  bike: [
    "M22 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0",
    "M9 17.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0",
    "M16 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
    "M12 17.5V14l-3-3 4-3 2 3h2",
  ],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 10h18",
    "M8 14h.01",
    "M12 14h.01",
    "M16 14h.01",
    "M8 18h.01",
    "M12 18h.01",
    "M16 18h.01",
  ],
  building: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4",
  ],
  landmark: [
    "M3 22h18",
    "M6 18V11",
    "M10 18V11",
    "M14 18V11",
    "M18 18V11",
    "M12 2 20 7H4z",
  ],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20", "M12 6v6l4 2"],
  card: [
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M2 10h20",
  ],
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

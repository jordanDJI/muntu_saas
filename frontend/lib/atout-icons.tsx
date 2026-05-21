export const ATOUT_ICONS: { key: string; label: string; paths: string[] }[] = [
  { key: "star",      label: "Étoile",         paths: ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"] },
  { key: "shield",    label: "Protection",      paths: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"] },
  { key: "award",     label: "Excellence",      paths: ["M12 15a7 7 0 100-14 7 7 0 000 14z", "M8.21 13.89L7 23l5-3 5 3-1.21-9.12"] },
  { key: "heart",     label: "Bienveillance",   paths: ["M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"] },
  { key: "clock",     label: "Disponibilité",   paths: ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "M12 6v6l4 2"] },
  { key: "home",      label: "Domicile",        paths: ["M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M9 22V12h6v10"] },
  { key: "users",     label: "Équipe",          paths: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 7a4 4 0 100 8 4 4 0 000-8", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75"] },
  { key: "map-pin",   label: "Localisation",    paths: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", "M12 10a2 2 0 100-4 2 2 0 000 4"] },
  { key: "check",     label: "Fiabilité",       paths: ["M22 11.08V12a10 10 0 11-5.93-9.14", "M22 4L12 14.01l-3-3"] },
  { key: "briefcase", label: "Expertise",       paths: ["M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z", "M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"] },
  { key: "leaf",      label: "Nature",          paths: ["M17 8C8 10 5.9 16.17 3.82 19c2.14-4.14 5.11-7 8.18-8", "M17 8c0 0-2 5-7 8"] },
  { key: "lightbulb", label: "Innovation",      paths: ["M9 21h6", "M12 3a6 6 0 016 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8C7.21 13.16 6 11.22 6 9a6 6 0 016-6z"] },
  { key: "phone",     label: "Joignable",       paths: ["M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"] },
  { key: "calendar",  label: "Agenda",          paths: ["M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"] },
  { key: "thumbs-up", label: "Satisfaction",    paths: ["M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z", "M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"] },
  { key: "globe",     label: "International",   paths: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M2 12h20", "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"] },
  { key: "lock",      label: "Confidentialité", paths: ["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z", "M17 11V7a5 5 0 00-10 0v4"] },
  { key: "zap",       label: "Rapidité",        paths: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"] },
  { key: "trending",  label: "Performance",     paths: ["M23 6l-9.5 9.5-5-5L1 18", "M17 6h6v6"] },
  { key: "smile",     label: "Convivialité",    paths: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"] },
];

export function AtoutIconSVG({ icon, className = "w-6 h-6", color = "currentColor" }: {
  icon: string;
  className?: string;
  color?: string;
}) {
  const found = ATOUT_ICONS.find((ic) => ic.key === icon);
  if (found) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
           className={className}>
        {found.paths.map((d, idx) => <path key={idx} d={d} />)}
      </svg>
    );
  }
  return <span className="text-2xl leading-none">{icon}</span>;
}
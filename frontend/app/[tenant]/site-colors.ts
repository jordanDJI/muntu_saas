// Palettes de couleurs applicables via CSS inline (évite les problèmes de purge Tailwind).
// Partagé par le site public et par les widgets embarqués, qui doivent prendre
// la couleur du site du tenant.
export const COLOR_HEX: Record<string, { hero: string; accent: string; light: string }> = {
  indigo: { hero: "#4338ca", accent: "#4f46e5", light: "#e0e7ff" },
  blue: { hero: "#1e3a8a", accent: "#1d4ed8", light: "#dbeafe" },
  green: { hero: "#15803d", accent: "#16a34a", light: "#dcfce7" },
  red: { hero: "#b91c1c", accent: "#dc2626", light: "#fee2e2" },
  purple: { hero: "#7e22ce", accent: "#9333ea", light: "#f3e8ff" },
  slate: { hero: "#475569", accent: "#64748b", light: "#f1f5f9" },
  teal: { hero: "#0f766e", accent: "#14b8a6", light: "#ccfbf1" },
  cyan: { hero: "#155e75", accent: "#0891b2", light: "#cffafe" },
  emerald: { hero: "#166534", accent: "#10b981", light: "#d1fae5" },
  amber: { hero: "#b45309", accent: "#f59e0b", light: "#fef3c7" },
  orange: { hero: "#c2410c", accent: "#f97316", light: "#ffedd5" },
  rose: { hero: "#be123c", accent: "#f43f5e", light: "#ffe4e6" },
  primary: { hero: "#4338ca", accent: "#6366f1", light: "#e0e7ff" },
  secondary: { hero: "#0f766e", accent: "#14b8a6", light: "#ccfbf1" },
  success: { hero: "#166534", accent: "#22c55e", light: "#dcfce7" },
  warning: { hero: "#b45309", accent: "#f59e0b", light: "#fef3c7" },
  danger: { hero: "#b91c1c", accent: "#ef4444", light: "#fee2e2" },
  neutral: { hero: "#334155", accent: "#64748b", light: "#f8fafc" },
  highlight: { hero: "#7e22ce", accent: "#a855f7", light: "#f3e8ff" },
};

export function resolveSiteColors(primaryColor?: string | null, customHex?: string | null) {
  if (primaryColor === "custom" && customHex) {
    return { hero: customHex, accent: customHex, light: customHex + "22" };
  }
  return COLOR_HEX[primaryColor ?? "indigo"] ?? COLOR_HEX.indigo;
}

// SMART-ANI · Official 5-Color Brand Palette & Design Tokens (Mobile)
// Team 404: Sleep Not Found · Marinduque Post-Harvest Exchange

export const brandPalette = {
  bush: "#0B2E17",
  maximumGreen: "#5D912F",
  brightNori: "#2D6320",
  venusFlytrap: "#94B54F",
  softCelery: "#C3D187",
} as const;

export const colors = {
  ...brandPalette,
  // Semantic & accessible surface/typography tokens mapped to the 5-color palette
  forest: "#0B2E17", // Bush — dark backgrounds, strong headings
  primary: "#2D6320", // Bright Nori — primary action buttons, selected navigation
  accent: "#5D912F", // Maximum Green — brand accents, secondary actions, interactive states
  highlight: "#94B54F", // Venus Flytrap — dashboard accents, chart highlights, selected cards
  celery: "#C3D187", // Soft Celery — soft background highlights, information cards
  green: "#94B54F",
  cream: "#F6F8F1",
  surface: "#FFFFFF",
  surfaceSoft: "#F1F5E6",
  surfaceCelery: "#EAEFCD",
  ink: "#0B2E17",
  muted: "#3E5641",
  border: "#D5DFC3",
  borderStrong: "#5D912F",
  white: "#FFFFFF",
  warningBg: "#FBF3DF",
  warningBorder: "#E6D09B",
  warningText: "#6E5119",
  dangerBg: "#FDF0EE",
  dangerBorder: "#E8B9B3",
  dangerText: "#942E24",
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * BRAND TOKENS — single source of truth for the public name + tagline.
 * A public rename is one config change. The CSS variables for color and
 * typography live in src/app/brand.css.
 */

export const BRAND = {
  name: process.env.NEXT_PUBLIC_REEL_NAME ?? "Reel",
  tagline: process.env.NEXT_PUBLIC_REEL_TAGLINE ?? "Self-hosted movie discovery",
  authorOf: "Tyler",
  domain: process.env.NEXT_PUBLIC_REEL_DOMAIN ?? "reel.tyflix.net",
  description:
    "Find your next favorite movie. Get recommendations rooted in your library, scored by 11 different signals, and one-click into your collection.",
} as const;

export type Brand = typeof BRAND;

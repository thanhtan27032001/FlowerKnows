export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

/** Active default — only `vi` is shipped for now; `en` is reserved for later. */
export const defaultLocale: Locale = "vi";

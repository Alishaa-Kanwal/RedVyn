"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps next-themes so the rest of the app can just `import { useTheme }
 * from "next-themes"`. attribute="class" toggles a `dark` class on <html>,
 * which is what tailwind.config.js's darkMode: "class" reads.
 *
 * System theme detection is enabled so the Settings page can offer a
 * Light/Dark/System three-way selector that drives the same theme state as
 * the top-bar theme toggle.
 */
export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={true}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
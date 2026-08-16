import { DEFAULT_APPEARANCE, THEME_STORAGE_KEY } from "@/lib/theme/types";

const themeInitScript = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var fallback = ${JSON.stringify(DEFAULT_APPEARANCE)};
    var stored = window.localStorage.getItem(key);
    var appearance = fallback;
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && (parsed.themeMode === "dark" || parsed.themeMode === "light")) {
        appearance = parsed;
      }
    }
    var root = document.documentElement;
    root.setAttribute("data-theme", appearance.themeMode);
    root.setAttribute("data-background", appearance.backgroundStyle || fallback.backgroundStyle);
  } catch (e) {
    var root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.setAttribute("data-background", "beige");
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;
}

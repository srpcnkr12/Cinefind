const THEME_INIT = `(function () {
  try {
    var stored = localStorage.getItem("movieholix-theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();`;

/** Hidrasyon öncesi flash'ı önlemek için ilk boyamadan önce çalışır. Statik, kullanıcı girdisi içermez. */
export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />;
}

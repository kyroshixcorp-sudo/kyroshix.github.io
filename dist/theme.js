// Runs before the stylesheets so the saved theme is applied before first paint.
(() => {
  const root = document.documentElement, key = 'kyroshix-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = null, timer;
  try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') preference = saved; } catch {}
  function sync() {
    const dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-checked', String(dark));
      button.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1d1d25' : '#fbfaf7');
  }
  function apply(theme, animated = false) {
    clearTimeout(timer);
    if (animated && !reducedMotion.matches) {
      root.classList.add('theme-changing');
      timer = setTimeout(() => root.classList.remove('theme-changing'), 420);
    } else root.classList.remove('theme-changing');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    sync();
    document.dispatchEvent(new CustomEvent('kyro:theme', {detail: {theme}}));
  }
  apply(preference || (system.matches ? 'dark' : 'light'));
  function mount() {
    sync();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply(preference, true);
    }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true}); else mount();
  system.addEventListener?.('change', () => { if (!preference) apply(system.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
    apply(preference || (system.matches ? 'dark' : 'light'));
  });
})();

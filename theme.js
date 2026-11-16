(() => {
  'use strict';

  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, remember = true) {
    const isDark = theme === 'dark';
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (toggle) {
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      toggle.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = toggle.querySelector('span');
      if (icon) icon.textContent = isDark ? '☀' : '☾';
    }

    if (themeMeta) themeMeta.setAttribute('content', isDark ? '#14171b' : '#f4f6f4');
    if (remember) {
      try { localStorage.setItem('study-desk-theme', isDark ? 'dark' : 'light'); } catch (_) { /* Storage may be unavailable in private contexts. */ }
    }
  }

  const initial = root.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(initial, false);

  if (toggle) {
    toggle.addEventListener('click', () => {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }
})();

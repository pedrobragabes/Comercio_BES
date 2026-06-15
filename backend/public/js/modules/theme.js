// ===== COMÉRCIO BES — THEME MODULE =====

export function initNavScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

export function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('bes_dark_mode', isDark ? '1' : '0');
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? '#0B1120' : '#047857';
}

export function aplicarTema() {
  const dark = localStorage.getItem('bes_dark_mode') === '1';
  if (dark) {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('btn-dark-mode');
    if (btn) btn.textContent = '☀️';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#0B1120';
  }
}

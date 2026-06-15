// ===== COMÉRCIO BES — UI MODULE =====
// Toast, skeleton, lazy loading, PWA install, mobile menu.

// ===== PWA STATE =====
let deferredPrompt = null;

// ===== TOAST =====
export function mostrarToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== RODAPÉ =====
export function atualizarAnoRodape() {
  const el = document.getElementById('current-year');
  if (el) el.textContent = String(new Date().getFullYear());
}

// ===== SKELETON =====
export function mostrarSkeleton() {
  const grid = document.getElementById('main-grid');
  if (!grid) return;
  let skeletonHTML = '';
  for (let i = 0; i < 4; i++) {
    skeletonHTML += '<div class="store-card skeleton-card">' +
      '<div class="skeleton-img skeleton-pulse"></div>' +
      '<div class="store-body">' +
        '<div class="skeleton-line skeleton-pulse" style="width:40%;height:12px;margin-bottom:10px;"></div>' +
        '<div class="skeleton-line skeleton-pulse" style="width:80%;height:18px;margin-bottom:12px;"></div>' +
        '<div class="skeleton-line skeleton-pulse" style="width:60%;height:14px;margin-bottom:16px;"></div>' +
        '<div class="skeleton-line skeleton-pulse" style="width:50%;height:14px;margin-bottom:16px;"></div>' +
        '<div style="display:flex;gap:8px;">' +
          '<div class="skeleton-line skeleton-pulse" style="flex:1;height:40px;border-radius:12px;"></div>' +
          '<div class="skeleton-line skeleton-pulse" style="width:48px;height:40px;border-radius:12px;"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  grid.innerHTML = skeletonHTML;

  const promosGrid = document.getElementById('promos-grid');
  if (promosGrid) {
    let promoSkeleton = '';
    for (let i = 0; i < 3; i++) {
      promoSkeleton += '<div class="promo-card skeleton-card">' +
        '<div class="skeleton-line skeleton-pulse-dark" style="width:100px;height:20px;border-radius:100px;margin-bottom:14px;"></div>' +
        '<div class="skeleton-line skeleton-pulse-dark" style="width:70%;height:18px;margin-bottom:8px;"></div>' +
        '<div class="skeleton-line skeleton-pulse-dark" style="width:90%;height:14px;margin-bottom:16px;"></div>' +
        '<div class="skeleton-line skeleton-pulse-dark" style="width:40%;height:24px;"></div>' +
      '</div>';
    }
    promosGrid.innerHTML = promoSkeleton;
  }
}

// ===== LAZY LOADING =====
export function observarLazyImages() {
  const images = document.querySelectorAll('img[data-src]');
  if (!images.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.classList.add('lazy-loaded');
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    images.forEach(img => observer.observe(img));
  } else {
    images.forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  }
}

// ===== MOBILE MENU =====
export function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

export function fecharMobileMenu() {
  document.getElementById('mobile-menu').classList.remove('open');
}

// ===== PWA INSTALL =====
export function configurarPWAInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwa-install-banner');
    if (banner && !localStorage.getItem('bes_pwa_dismissed')) banner.style.display = 'block';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    fecharBannerPWA();
    mostrarToast('✅ App instalado com sucesso!');
  });
}

export function instalarPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') mostrarToast('✅ Instalando o ComércioBES...');
    deferredPrompt = null;
    fecharBannerPWA();
  });
}

export function fecharBannerPWA() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('bes_pwa_dismissed', '1');
}

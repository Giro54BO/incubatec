/* Lenis smooths the motion between wheel/trackpad/touch input and the actual
   scroll while leaving the browser's native scroll position intact. Same
   version and config as the Aceleratec site so the two feel identical. */
if (window.Lenis && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  new window.Lenis({
    autoRaf: true,
    autoToggle: true,
    anchors: true,
    stopInertiaOnNavigate: true,
  });
}

/* Sticky hero reveal: pin the hero so the sections below scroll up over it.
   When the hero is taller than the viewport, sticking at top:0 would hide its
   lower half, so we offset by the difference and it settles bottom-aligned. */
const heroEl = document.querySelector('.hero');
if (heroEl) {
  const setHeroStick = () => {
    const offset = Math.min(0, window.innerHeight - heroEl.offsetHeight);
    document.documentElement.style.setProperty('--hero-stick-top', offset + 'px');
  };
  setHeroStick();
  window.addEventListener('resize', setHeroStick, { passive: true });
  window.addEventListener('load', setHeroStick);
}

const header = document.querySelector('[data-header]');
const brandImg = header && header.querySelector('.brand img');
const themed = [...document.querySelectorAll('[data-header-theme]')].filter((el) => el !== header);

function updateHeader() {
  if (!header) return;
  const cutoff = header.getBoundingClientRect().bottom + 12;
  let theme = 'dark';
  themed.forEach((section) => {
    if (section.getBoundingClientRect().top <= cutoff) theme = section.dataset.headerTheme;
  });
  header.dataset.headerTheme = theme;
  header.classList.toggle('is-after-hero', window.scrollY > 40);
  if (brandImg) {
    const next = theme === 'light' ? brandImg.dataset.logoLight : brandImg.dataset.logoDark;
    if (next && !brandImg.getAttribute('src').endsWith(next)) brandImg.src = next;
  }
}
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader, { passive: true });

const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }));
}

/* Destino de las respuestas del formulario de contacto.

   El sitio es estático, así que no hay servidor que reciba el POST. Por
   defecto el envío abre el cliente de correo del visitante con el mensaje ya
   redactado hacia FORM_EMAIL.

   Para que la entrega sea server-side (sin depender de que el visitante tenga
   cliente de correo configurado), basta con pegar en FORM_ENDPOINT la URL de
   un servicio de formularios —Formspree, Web3Forms, Getform— dado de alta con
   esa misma casilla. El formulario hará POST ahí en lugar del mailto. */
const FORM_EMAIL = 'incubatec.bo@gmail.com';
const FORM_ENDPOINT = '';

const form = document.querySelector('[data-form]');
const status = document.querySelector('[data-form-status]');
if (form && status) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);

    if (FORM_ENDPOINT) {
      status.textContent = 'Enviando…';
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(res.status);
        status.textContent = 'Gracias. Un responsable del programa te contactará con la información de la convocatoria vigente.';
        form.reset();
      } catch {
        status.textContent = 'No pudimos enviar el mensaje. Escríbenos a ' + FORM_EMAIL + ' o por WhatsApp.';
      }
      return;
    }

    const subject = 'Consulta desde la web — ' + (data.get('nombre') || '');
    const body = [
      'Nombre: ' + (data.get('nombre') || ''),
      'Correo: ' + (data.get('correo') || ''),
      'Ciudad: ' + (data.get('ciudad') || ''),
      '',
      data.get('mensaje') || '',
    ].join('\n');
    window.location.href = 'mailto:' + FORM_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    status.textContent = 'Abrimos tu correo con el mensaje listo para enviar a ' + FORM_EMAIL + '.';
  });
}

/* ── Scroll effects ──────────────────────────────────────────────────────
   Reveal-on-enter (staggered per group) and a light parallax on the hero
   and the photo bands. Skipped entirely when the visitor asks for reduced
   motion, so nothing is left mid-transition. */
const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (motionOK && 'IntersectionObserver' in window) {
  const revealed = document.querySelectorAll([
    '.section-head > div',
    '.section-head > p',
    '.section-head-copy',
    '.split > div',
    '.card-grid > *',
    '.media-band figure',
    '.quote-inner > *',
    '.faq details',
    '.footer-intro',
    '.footer-col'
  ].join(','));

  // stagger siblings so grids and lists cascade instead of popping at once
  const groups = new Map();
  revealed.forEach((el) => {
    el.classList.add('reveal');
    const siblings = groups.get(el.parentElement) || [];
    siblings.push(el);
    groups.set(el.parentElement, siblings);
  });
  groups.forEach((siblings) => {
    siblings.forEach((el, i) => { el.style.transitionDelay = i * 90 + 'ms'; });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  revealed.forEach((el) => observer.observe(el));
}

/* El video del hero es decorativo y se reproduce en bucle. Si el visitante pide
   movimiento reducido lo detenemos en el póster en vez de seguir animándolo. */
if (!motionOK) {
  document.querySelectorAll('video[autoplay]').forEach((video) => {
    video.autoplay = false;
    video.loop = false;
    video.pause();
  });
}

if (motionOK) {
  const mediaImages = [...document.querySelectorAll('.media-band img,.photo-band img')];
  let ticking = false;

  function updateParallax() {
    const vh = window.innerHeight;

    // each figure's image shifts against its frame as the figure crosses the viewport
    mediaImages.forEach((img) => {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2);
      img.style.transform = 'translate3d(0,' + (progress * 8).toFixed(2) + '%,0)';
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateParallax(); ticking = false; });
  }

  updateParallax();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

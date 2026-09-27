import { sb, traducirError } from './sb.js';
import { h, icon, refreshIcons, toast, modal, loading } from './ui.js';

const RUTAS = [
  { id: 'inicio', label: 'Inicio', ico: 'layout-dashboard' },
  { id: 'pisos', label: 'Pisos a comprar', ico: 'house-plus' },
  { id: 'venta', label: 'Compradores', ico: 'users' },
  { id: 'agencia', label: 'Agencia', ico: 'handshake' },
  { id: 'notaria', label: 'Notaría', ico: 'file-check-2', destacado: true },
  { id: 'impuestos', label: 'Impuestos', ico: 'calculator' },
  { id: 'suministros', label: 'Suministros', ico: 'plug-zap' },
  { id: 'reformas', label: 'Reformas', ico: 'hammer' },
  { id: 'agenda', label: 'Agenda', ico: 'calendar-days' },
  { id: 'ajustes', label: 'Ajustes', ico: 'settings' },
];
const MOVIL = ['inicio', 'pisos', 'venta', 'notaria'];

const vistas = {
  inicio: () => import('./views/inicio.js'),
  pisos: () => import('./views/pisos.js'),
  venta: () => import('./views/venta.js'),
  agencia: () => import('./views/agencia.js'),
  notaria: () => import('./views/notaria.js'),
  impuestos: () => import('./views/impuestos.js'),
  suministros: () => import('./views/suministros.js'),
  reformas: () => import('./views/reformas.js'),
  agenda: () => import('./views/agenda.js'),
  ajustes: () => import('./views/ajustes.js'),
};

const LOGO = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M6 19 20 7l14 12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 17v15h20V17" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 30s-6-3.6-6-7.6a3.3 3.3 0 0 1 6-1.9 3.3 3.3 0 0 1 6 1.9c0 4-6 7.6-6 7.6Z" fill="currentColor"/></svg>`;
export const logo = (cls = 'logo') => h('span', { class: cls, html: LOGO, 'aria-label': 'CasaMarta', role: 'img' });

// ---------- Tema ----------
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('cm-tema', t);
}
aplicarTema(localStorage.getItem('cm-tema') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
const toggleTema = () => {
  aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  const oscuro = document.documentElement.dataset.theme === 'dark';
  document.querySelectorAll('[data-tema-btn]').forEach((b) => { b.setAttribute('aria-label', oscuro ? 'Modo claro' : 'Modo oscuro'); b.title = oscuro ? 'Modo claro' : 'Modo oscuro'; b.replaceChildren(icon(oscuro ? 'sun' : 'moon')); });
  refreshIcons();
  if (session && esMiembro) router();
};
export { toggleTema };

// ---------- Estado ----------
let session = null;
let esMiembro = false;
const root = document.getElementById('app');

// ---------- Login ----------
function pantallaLogin(modo = 'entrar') {
  document.body.classList.add('is-auth');
  const email = h('input', { type: 'email', id: 'email', required: true, autocomplete: 'email', placeholder: 'tu@email.com' });
  const pass = h('input', { type: 'password', id: 'pass', required: modo !== 'recuperar', minlength: 6, autocomplete: modo === 'crear' ? 'new-password' : 'current-password', placeholder: '••••••••' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const info = h('p', { class: 'form-info', role: 'status', hidden: true });
  const titulo = { entrar: 'Entrar', crear: 'Crear cuenta', recuperar: 'Recuperar contraseña' }[modo];
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, titulo);
  const redirect = location.origin + location.pathname;

  const form = h('form', {
    class: 'auth-form', onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true; info.hidden = true; btn.disabled = true;
      try {
        if (modo === 'entrar') {
          const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
          if (error) throw error;
        } else if (modo === 'crear') {
          const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: pass.value, options: { emailRedirectTo: redirect } });
          if (error) throw error;
          if (!data.session) { info.textContent = 'Cuenta creada. Revisa tu correo para confirmar el email y después entra.'; info.hidden = false; }
        } else {
          const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: redirect });
          if (error) throw error;
          info.textContent = 'Si el email está registrado, recibirás un enlace para cambiar la contraseña.'; info.hidden = false;
        }
      } catch (ex) { err.textContent = traducirError(ex.message); err.hidden = false; }
      btn.disabled = false;
    },
  },
    h('div', { class: 'field' }, h('label', { for: 'email', class: 'label' }, 'Email'), email),
    modo !== 'recuperar' ? h('div', { class: 'field' }, h('label', { for: 'pass', class: 'label' }, 'Contraseña'), pass) : null,
    err, info, btn);

  const links = h('div', { class: 'auth-links' },
    modo !== 'entrar' ? h('button', { class: 'link', onclick: () => pantallaLogin('entrar') }, 'Ya tengo cuenta') : null,
    modo !== 'crear' ? h('button', { class: 'link', onclick: () => pantallaLogin('crear') }, 'Crear cuenta (solo emails autorizados)') : null,
    modo === 'entrar' ? h('button', { class: 'link', onclick: () => pantallaLogin('recuperar') }, '¿Has olvidado la contraseña?') : null);

  root.replaceChildren(h('main', { class: 'auth' },
    h('section', { class: 'auth-art', 'aria-hidden': 'true' },
      h('div', { class: 'auth-art-inner' }, logo('logo logo-xl'),
        h('p', { class: 'auth-quote' }, 'Vender una casa llena de recuerdos y encontrar la siguiente. Paso a paso, sin perder ningún papel.'))),
    h('section', { class: 'auth-panel' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand' }, logo(), h('span', {}, 'CasaMarta')),
        h('h1', {}, modo === 'entrar' ? 'Hola, Marta' : titulo),
        h('p', { class: 'muted' }, 'Tu espacio para organizar el gran paso: la venta de la casa de tus padres y la compra de tu nuevo hogar.'),
        form, links))));
  refreshIcons();
  setTimeout(() => email.focus(), 50);
}

function pantallaSinPermiso() {
  root.replaceChildren(h('main', { class: 'auth' }, h('section', { class: 'auth-panel', style: { gridColumn: '1 / -1' } },
    h('div', { class: 'auth-card' }, h('div', { class: 'brand' }, logo(), h('span', {}, 'CasaMarta')),
      h('h1', {}, 'Cuenta sin acceso'),
      h('p', { class: 'muted' }, `Has entrado como ${session.user.email}, pero esta cuenta todavía no es miembro de CasaMarta.`),
      h('button', { class: 'btn btn-primary', onclick: () => sb.auth.signOut() }, 'Cerrar sesión')))));
}

function pedirNuevaPassword() {
  const inp = h('input', { type: 'password', minlength: 6, required: true, autocomplete: 'new-password', id: 'np' });
  const m = modal({
    title: 'Nueva contraseña',
    body: h('div', { class: 'field' }, h('label', { for: 'np', class: 'label' }, 'Escribe tu nueva contraseña'), inp),
    actions: [h('button', { class: 'btn btn-primary', onclick: async () => {
      const { error } = await sb.auth.updateUser({ password: inp.value });
      if (error) toast(traducirError(error.message), 'error'); else { toast('Contraseña actualizada'); m.close(); }
    } }, 'Guardar')],
  });
}

// ---------- Shell ----------
let main;
function pintarShell() {
  document.body.classList.remove('is-auth');
  const actual = rutaActual().vista;
  const oscuro = document.documentElement.dataset.theme === 'dark';
  const nav = h('nav', { class: 'sidebar', id: 'sidebar', 'aria-label': 'Secciones' },
    h('a', { class: 'brand', href: '#/inicio' }, logo(), h('span', {}, 'CasaMarta')),
    h('ul', {}, RUTAS.map((r) => h('li', {}, h('a', { href: '#/' + r.id, class: 'nav-link' + (r.id === actual ? ' active' : '') + (r.destacado ? ' nav-key' : ''), 'aria-current': r.id === actual ? 'page' : null, onclick: cerrarMenu },
      icon(r.ico), h('span', {}, r.label))))),
    h('div', { class: 'sidebar-foot' },
      h('p', { class: 'small muted user-mail' }, session.user.email),
      h('div', { class: 'row' },
        h('button', { class: 'btn-icon', 'data-tema-btn': '', 'aria-label': oscuro ? 'Modo claro' : 'Modo oscuro', title: oscuro ? 'Modo claro' : 'Modo oscuro', onclick: toggleTema }, icon(oscuro ? 'sun' : 'moon')),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => sb.auth.signOut() }, icon('log-out'), 'Salir'))));
  const top = h('header', { class: 'topbar' },
    h('button', { class: 'btn-icon', 'aria-label': 'Abrir menú', 'aria-controls': 'sidebar', onclick: () => document.body.classList.add('menu-open') }, icon('menu')),
    h('a', { class: 'brand', href: '#/inicio' }, logo(), h('span', {}, 'CasaMarta')),
    h('button', { class: 'btn-icon', 'data-tema-btn': '', 'aria-label': 'Cambiar tema', onclick: toggleTema }, icon(oscuro ? 'sun' : 'moon')));
  const bottom = h('nav', { class: 'bottombar', 'aria-label': 'Accesos rápidos' },
    MOVIL.map((id) => { const r = RUTAS.find((x) => x.id === id); return h('a', { href: '#/' + id, class: id === actual ? 'active' : '' }, icon(r.ico), h('span', {}, r.label.split(' ')[0])); }),
    h('button', { onclick: () => document.body.classList.add('menu-open') }, icon('ellipsis'), h('span', {}, 'Más')));
  main = h('main', { class: 'content', id: 'contenido', tabindex: '-1' });
  root.replaceChildren(h('a', { class: 'skip', href: '#contenido', onclick: (e) => { e.preventDefault(); main.focus(); } }, 'Saltar al contenido'),
    nav, h('div', { class: 'scrim', onclick: cerrarMenu }), h('div', { class: 'main-col' }, top, main, bottom));
  refreshIcons();
}
const cerrarMenu = () => document.body.classList.remove('menu-open');

function rutaActual() {
  const [, vista = 'inicio', param] = (location.hash || '#/inicio').split('/');
  return { vista: vistas[vista] ? vista : 'inicio', param };
}

let renderId = 0;
async function router() {
  if (!session || !esMiembro) return;
  const { vista, param } = rutaActual();
  pintarShell();
  const id = ++renderId;
  main.replaceChildren(loading());
  try {
    const mod = await vistas[vista]();
    if (id !== renderId) return;
    const titulo = RUTAS.find((r) => r.id === vista).label;
    document.title = `${titulo} · CasaMarta`;
    await mod.render(main, { param, recargar: router });
    refreshIcons();
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    main.replaceChildren(h('div', { class: 'card error-card' }, h('h2', {}, 'Algo ha fallado'), h('p', {}, traducirError(e.message)),
      h('button', { class: 'btn btn-primary', onclick: router }, 'Reintentar')));
  }
}
window.addEventListener('hashchange', router);

async function comprobarMiembro() {
  const { data } = await sb.from('miembros').select('user_id').eq('user_id', session.user.id).maybeSingle();
  esMiembro = !!data;
}

async function arrancar(s) {
  session = s;
  if (!session) { esMiembro = false; pantallaLogin(); return; }
  await comprobarMiembro();
  if (!esMiembro) { pantallaSinPermiso(); return; }
  if (/access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/inicio');
  router();
}

sb.auth.onAuthStateChange((event, s) => {
  if (event === 'PASSWORD_RECOVERY') { session = s; setTimeout(pedirNuevaPassword, 300); }
  if (['SIGNED_IN', 'SIGNED_OUT', 'INITIAL_SESSION'].includes(event)) {
    if (event === 'SIGNED_IN' && session && s && session.user.id === s.user.id) { session = s; return; }
    setTimeout(() => arrancar(s), 0);
  }
});

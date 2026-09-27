// Utilidades de interfaz: elementos, formatos, modales, avisos y formularios.

// replaceChildren/append nativos convierten null en el texto "null": los filtramos.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const m of ['replaceChildren', 'append', 'prepend']) {
    const orig = proto[m];
    proto[m] = function (...nodes) { return orig.apply(this, nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false)); };
  }
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const icon = (name, cls = '') => h('i', { 'data-lucide': name, class: 'ico ' + cls, 'aria-hidden': 'true' });
export const refreshIcons = () => window.lucide && window.lucide.createIcons();

// ---------- Formatos (es-ES) ----------
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 2 });
export const money = (v, dec = false) => (v === null || v === undefined || v === '' || isNaN(v) ? '—' : (dec ? eur2 : eur).format(Number(v)));
export const number = (v) => (v === null || v === undefined || v === '' ? '—' : num.format(Number(v)));
export function fecha(d) {
  if (!d) return '—';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}
export const hora = (t) => (t ? String(t).slice(0, 5) : '');
export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function diasHasta(d) {
  if (!d) return null;
  const a = new Date(hoyISO() + 'T00:00:00');
  const b = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
export function relativo(d) {
  const n = diasHasta(d);
  if (n === null) return '';
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Avisos ----------
export function toast(msg, tipo = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: `toast toast-${tipo}`, role: tipo === 'error' ? 'alert' : 'status' },
    icon(tipo === 'error' ? 'circle-alert' : 'circle-check'), h('span', {}, msg));
  box.append(t); refreshIcons();
  setTimeout(() => t.classList.add('out'), 3800);
  setTimeout(() => t.remove(), 4300);
}

// ---------- Modal ----------
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prev = document.activeElement;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const dialog = h('div', { class: 'modal' + (wide ? ' modal-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'modal-head' }, h('h2', {}, title),
      h('button', { class: 'btn-icon', 'aria-label': 'Cerrar', onclick: close }, icon('x'))),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('footer', { class: 'modal-foot' }, actions) : null);
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) close(); } }, dialog);
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  refreshIcons();
  setTimeout(() => (dialog.querySelector('input,select,textarea,button.btn') || dialog).focus(), 30);
  return { close, el: dialog };
}

export function confirmar(msg, { ok = 'Borrar', peligro = true } = {}) {
  return new Promise((res) => {
    let done = false;
    const m = modal({
      title: 'Confirmar', body: h('p', {}, msg),
      onClose: () => { if (!done) res(false); },
      actions: [
        h('button', { class: 'btn btn-ghost', onclick: () => { done = true; res(false); m.close(); } }, 'Cancelar'),
        h('button', { class: 'btn ' + (peligro ? 'btn-danger' : 'btn-primary'), onclick: () => { done = true; res(true); m.close(); } }, ok),
      ],
    });
  });
}

// ---------- Formularios a partir de un esquema ----------
// field: { k, label, type, opts:[[valor, etiqueta]], req, full, help, min, max, step, placeholder }
export function formField(f, value) {
  const id = 'f_' + f.k + '_' + Math.random().toString(36).slice(2, 7);
  let input;
  const common = { id, name: f.k, required: f.req || null, placeholder: f.placeholder || null };
  switch (f.type) {
    case 'textarea':
      input = h('textarea', { ...common, rows: f.rows || 3 }, value ?? '');
      break;
    case 'select':
      input = h('select', common, f.req ? null : h('option', { value: '' }, '—'),
        f.opts.map(([v, l]) => h('option', { value: v, selected: String(value ?? f.def ?? '') === String(v) }, l)));
      break;
    case 'bool':
      input = h('input', { ...common, type: 'checkbox', checked: value === undefined || value === null ? !!f.def : !!value, required: null });
      return h('label', { class: 'field field-check' + (f.full ? ' full' : ''), for: id }, input, h('span', {}, f.label));
    case 'rating': {
      const wrap = h('div', { class: 'rating', role: 'radiogroup', 'aria-label': f.label });
      for (let i = 1; i <= 5; i++) {
        const rid = id + i;
        wrap.append(h('input', { type: 'radio', name: f.k, id: rid, value: i, checked: Number(value) === i }),
          h('label', { for: rid, title: `${i} de 5` }, '★'));
      }
      return h('div', { class: 'field' + (f.full ? ' full' : '') }, h('span', { class: 'label' }, f.label), wrap);
    }
    default: {
      const t = { money: 'number', number: 'number', percent: 'number', date: 'date', time: 'time', email: 'email', tel: 'tel', url: 'url', password: 'password' }[f.type] || 'text';
      input = h('input', { ...common, type: t, value: value ?? f.def ?? '', inputmode: ['money', 'number', 'percent'].includes(f.type) ? 'decimal' : null,
        step: f.step || (f.type === 'money' ? '0.01' : f.type === 'number' || f.type === 'percent' ? 'any' : null), min: f.min ?? null, max: f.max ?? null });
    }
  }
  const suf = f.type === 'money' ? '€' : f.type === 'percent' ? '%' : null;
  return h('div', { class: 'field' + (f.full || f.type === 'textarea' ? ' full' : '') },
    h('label', { for: id, class: 'label' }, f.label, f.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    suf ? h('div', { class: 'input-suf' }, input, h('span', {}, suf)) : input,
    f.help ? h('small', { class: 'help' }, f.help) : null);
}

export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'bool') { out[f.k] = form.elements[f.k].checked; continue; }
    if (f.type === 'rating') { const r = form.querySelector(`input[name="${f.k}"]:checked`); out[f.k] = r ? Number(r.value) : null; continue; }
    const el = form.elements[f.k];
    if (!el) continue;
    let v = el.value.trim();
    if (v === '') { out[f.k] = null; continue; }
    if (['money', 'number', 'percent'].includes(f.type)) v = Number(v.replace(',', '.'));
    out[f.k] = v;
  }
  return out;
}

export function formModal({ title, fields, value = {}, onSave, extra, wide = true, saveLabel = 'Guardar' }) {
  const form = h('form', { class: 'form-grid', novalidate: true }, fields.map((f) => formField(f, value[f.k])));
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, saveLabel);
  const submit = async (e) => {
    e && e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn.disabled = true; btn.textContent = 'Guardando…'; err.hidden = true;
    try {
      await onSave({ ...value, ...readForm(form, fields) });
      m.close();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = saveLabel;
    }
  };
  form.addEventListener('submit', submit);
  const m = modal({
    title, wide,
    body: h('div', {}, form, extra || null, err),
    actions: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Cancelar'),
      h('button', { class: 'btn btn-primary', onclick: submit }, saveLabel)],
  });
  return m;
}

// ---------- Otros componentes ----------
export const badge = (txt, tone = 'neutral') => h('span', { class: `badge badge-${tone}` }, txt);
export function empty(ico, titulo, texto, accion) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-ico' }, icon(ico)), h('h3', {}, titulo), h('p', {}, texto), accion || null);
}
export function progress(pct, tone = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return h('div', { class: 'progress ' + tone, role: 'progressbar', 'aria-valuenow': p, 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { style: { width: p + '%' } }));
}
export function kpi(label, value, sub, ico, href) {
  const inner = [h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, label), ico ? icon(ico) : null),
    h('div', { class: 'kpi-value' }, value), sub ? h('div', { class: 'kpi-sub' }, sub) : null];
  return href ? h('a', { class: 'card kpi', href }, inner) : h('div', { class: 'card kpi' }, inner);
}
export function pageHead(titulo, sub, ...acciones) {
  return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, titulo), sub ? h('p', { class: 'muted' }, sub) : null),
    h('div', { class: 'page-actions' }, acciones));
}
export const labelOf = (opts, v) => (opts.find(([k]) => k === v) || [v, v ?? '—'])[1];

export function exportCSV(nombre, rows, cols) {
  const escCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const keys = cols || [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !['created_by'].includes(k));
  const lines = [keys.join(';'), ...rows.map((r) => keys.map((k) => escCell(r[k])).join(';'))];
  download(nombre + '.csv', '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
}
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const loading = () => h('div', { class: 'loading' }, h('div', { class: 'skel' }), h('div', { class: 'skel' }), h('div', { class: 'skel short' }));
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

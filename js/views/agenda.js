import { db } from '../sb.js';
import { h, icon, fecha, relativo, diasHasta, pageHead, formModal, confirmar, toast, download, refreshIcons, hoyISO, labelOf } from '../ui.js';
import { F, OPT } from '../schema.js';
import { cargarTodo, eventos } from '../datos.js';

const ICO = { piso: 'house', comprador: 'user', agencia: 'handshake', documento: 'file-text', suministro: 'plug-zap', reforma: 'hammer', tarea: 'list-checks', notaria: 'stamp', evento: 'calendar' };
const NOMBRE = { piso: 'Pisos', comprador: 'Compradores', agencia: 'Agencia', documento: 'Documentos', suministro: 'Suministros', reforma: 'Reformas', tarea: 'Plazos y tareas', notaria: 'Notaría', evento: 'Citas' };
let verPasados = false;
let tipoSel = 'todos';

export async function render(el, ctx) {
  const d = await cargarTodo();
  const recargar = () => render(el, ctx);
  const editar = (v = { fecha: hoyISO() }) => formModal({ title: v.id ? 'Editar cita' : 'Nueva cita', fields: F.eventos, value: v, wide: false, onSave: async (x) => { await db.save('eventos', x); toast('Cita guardada'); recargar(); } });
  const hoy = hoyISO();
  const todos = eventos(d);
  let lista = todos.filter((e) => (verPasados ? true : e.fecha >= hoy) && (tipoSel === 'todos' || e.tipo === tipoSel));
  if (verPasados) lista = lista.slice().reverse();

  const grupos = new Map();
  for (const e of lista) {
    const k = e.fecha.slice(0, 7);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(e);
  }
  const mes = (k) => new Date(k + '-01T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const propio = (e) => d.eventos.find((x) => e.tipo !== 'piso' && e.href === '#/agenda' && x.titulo === e.titulo && x.fecha === e.fecha);

  const tipos = ['todos', ...new Set(todos.map((e) => e.tipo))];
  el.replaceChildren(
    pageHead('Agenda', 'Visitas, vencimientos, plazos y citas en un solo sitio',
      h('button', { class: 'btn btn-ghost', onclick: () => exportICS(todos) }, icon('calendar-plus'), 'Exportar a calendario (.ics)'),
      h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Nueva cita')),
    h('div', { class: 'toolbar' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por tipo' }, tipos.map((t) => h('button', { class: 'chip' + (tipoSel === t ? ' active' : ''), 'aria-pressed': tipoSel === t, onclick: () => { tipoSel = t; recargar(); } }, t === 'todos' ? 'Todo' : NOMBRE[t] || t))),
      h('label', { class: 'field-check' }, h('input', { type: 'checkbox', checked: verPasados, onchange: (e) => { verPasados = e.target.checked; recargar(); } }), h('span', {}, 'Ver pasados'))),
    lista.length ? h('div', { class: 'stack' }, [...grupos].map(([k, evs]) => h('section', { class: 'card' },
      h('h2', { class: 'cap' }, mes(k)),
      h('ol', { class: 'timeline' }, evs.map((e) => {
        const p = propio(e);
        const n = diasHasta(e.fecha);
        return h('li', { class: (n !== null && n >= 0 && n <= 2 ? 'soon' : '') + (n < 0 ? ' past' : '') },
          h('div', { class: 't-date' }, h('strong', {}, fecha(e.fecha).slice(0, 5)), h('span', {}, e.hora || relativo(e.fecha))),
          h('a', { class: 't-body', href: e.href }, icon(ICO[e.tipo] || 'calendar'), h('span', {}, e.titulo, e.extra ? h('span', { class: 'muted small' }, ' · ' + e.extra) : null)),
          p ? h('span', { class: 'row' }, h('button', { class: 'btn-icon', 'aria-label': 'Editar cita', onclick: () => editar(p) }, icon('pencil')),
            h('button', { class: 'btn-icon', 'aria-label': 'Borrar cita', onclick: async () => { if (await confirmar('¿Borrar esta cita?')) { await db.remove('eventos', p.id); recargar(); } } }, icon('trash-2'))) : null);
      }))))) : h('div', { class: 'card' }, h('p', { class: 'muted' }, verPasados ? 'No hay nada registrado.' : 'No hay próximas fechas. Añade visitas, la fecha de firma o una cita.')));
  refreshIcons();
}

function exportICS(evs) {
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date(); const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const escI = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CasaMarta//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:CasaMarta', 'X-WR-TIMEZONE:Europe/Madrid'];
  evs.forEach((e, i) => {
    const f = e.fecha.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:casamarta-${f}-${i}-${e.tipo}@torija69.github.io`, `DTSTAMP:${stamp}`);
    if (e.hora) { const [hh, mm] = e.hora.split(':'); const end = `${pad((Number(hh) + 1) % 24)}${mm}`; lines.push(`DTSTART;TZID=Europe/Madrid:${f}T${hh}${mm}00`, `DTEND;TZID=Europe/Madrid:${f}T${end}00`); }
    else { const n = new Date(e.fecha + 'T12:00:00'); n.setDate(n.getDate() + 1); lines.push(`DTSTART;VALUE=DATE:${f}`, `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, '')}`); }
    lines.push(`SUMMARY:${escI(e.titulo)}`);
    if (e.extra) lines.push(`DESCRIPTION:${escI(e.extra)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  download('casamarta.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
  toast('Calendario exportado. Ábrelo para añadirlo a tu calendario.');
}

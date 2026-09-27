import { db } from '../sb.js';
import { h, icon, money, fecha, hora, relativo, diasHasta, badge, empty, pageHead, formModal, confirmar, toast, labelOf, exportCSV, kpi, hoyISO } from '../ui.js';
import { F, OPT, TONO } from '../schema.js';

let filtro = 'todos';

export async function render(el, ctx) {
  const [comp, ofertas, op] = await Promise.all([db.list('compradores', { order: 'fecha_visita', asc: false }), db.list('ofertas', { order: 'fecha', asc: false }), db.get('operacion', 1)]);
  const recargar = () => render(el, ctx);
  const nuevo = (v = {}) => formModal({ title: v.id ? 'Editar comprador' : 'Nuevo comprador / visita', fields: F.compradores, value: v, onSave: async (x) => { await db.save('compradores', x); toast('Guardado'); recargar(); } });
  const nuevaOferta = (c, v = { fecha: hoyISO() }) => formModal({ title: `${v.id ? 'Editar' : 'Nueva'} oferta · ${c.nombre}`, fields: F.ofertas, value: v, wide: false, onSave: async (x) => { await db.save('ofertas', { ...x, comprador_id: c.id }); toast('Oferta guardada'); recargar(); } });

  const vivas = ofertas.filter((o) => !['rechazada', 'retirada'].includes(o.estado));
  const mejor = vivas.reduce((m, x) => (Number(x.importe) > Number(m?.importe || 0) ? x : m), null);
  const mejorComp = mejor && comp.find((c) => c.id === mejor.comprador_id);
  const hoy = hoyISO();
  const prox = comp.filter((c) => c.fecha_visita && c.fecha_visita >= hoy).sort((a, b) => (a.fecha_visita + (a.hora_visita || '')).localeCompare(b.fecha_visita + (b.hora_visita || '')));
  const en24 = prox.filter((c) => diasHasta(c.fecha_visita) <= 1);

  const lista = comp.filter((c) => filtro === 'todos' || c.resultado === filtro);
  const tabla = lista.length ? h('div', { class: 'stack' }, lista.map((c) => {
    const ofs = ofertas.filter((o) => o.comprador_id === c.id);
    return h('article', { class: 'card comprador tone-' + (TONO[c.resultado] || 'neutral') },
      h('div', { class: 'row between wrap' },
        h('div', {}, h('h3', {}, c.nombre), h('p', { class: 'muted small' }, [labelOf(OPT.via, c.via), c.telefono, c.email].filter(Boolean).join(' · '))),
        h('div', { class: 'row' }, badge(labelOf(OPT.resultado, c.resultado), TONO[c.resultado]),
          h('select', { class: 'inline-select', 'aria-label': 'Resultado de la visita', onchange: async (e) => { await db.save('compradores', { id: c.id, resultado: e.target.value }); toast('Actualizado'); recargar(); } },
            OPT.resultado.map(([v, l]) => h('option', { value: v, selected: v === c.resultado }, l))))),
      c.fecha_visita ? h('p', { class: 'visit' }, icon('calendar-clock'), `Visita ${fecha(c.fecha_visita)} ${hora(c.hora_visita)} · ${relativo(c.fecha_visita)}`) : null,
      c.notas ? h('p', { class: 'pre small' }, c.notas) : null,
      ofs.length ? h('ul', { class: 'ofertas' }, ofs.map((o) => h('li', {},
        h('strong', {}, money(o.importe)), h('span', { class: 'muted small' }, `${fecha(o.fecha)} · ${labelOf(OPT.financiacion, o.financiacion)}`), badge(labelOf(OPT.estadoOferta, o.estado), TONO[o.estado]),
        o.condiciones ? h('span', { class: 'small' }, o.condiciones) : null,
        h('span', { class: 'row' }, h('button', { class: 'btn-icon', 'aria-label': 'Editar oferta', onclick: () => nuevaOferta(c, o) }, icon('pencil')),
          h('button', { class: 'btn-icon', 'aria-label': 'Borrar oferta', onclick: async () => { if (await confirmar('¿Borrar esta oferta?')) { await db.remove('ofertas', o.id); recargar(); } } }, icon('trash-2')))))) : null,
      h('div', { class: 'row card-actions' },
        c.telefono ? h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:' + c.telefono.replace(/\s/g, '') }, icon('phone'), 'Llamar') : null,
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => nuevaOferta(c) }, icon('euro'), 'Registrar oferta'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => nuevo(c) }, icon('pencil'), 'Editar'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { if (await confirmar(`¿Borrar a ${c.nombre} y sus ofertas?`)) { await db.remove('compradores', c.id); recargar(); } } }, icon('trash-2'), 'Borrar')));
  })) : empty('users', comp.length ? 'Nadie con este filtro' : 'Aún no hay compradores', 'Registra cada visita a la casa de los padres: quién vino, qué le pareció y si hizo oferta.',
    comp.length ? null : h('button', { class: 'btn btn-primary', onclick: () => nuevo() }, icon('plus'), 'Registrar visita'));

  el.replaceChildren(
    pageHead('Compradores de la casa', op?.direccion_venta || 'Casa de los padres · Majadahonda',
      h('button', { class: 'btn btn-ghost', onclick: () => exportCSV('compradores', comp.map((c) => ({ ...c, ofertas: ofertas.filter((o) => o.comprador_id === c.id).map((o) => `${o.importe} (${o.estado})`).join(' | ') }))) }, icon('download'), 'CSV'),
      h('button', { class: 'btn btn-primary', onclick: () => nuevo() }, icon('plus'), 'Nuevo comprador')),
    en24.length ? h('div', { class: 'banner banner-warn', role: 'status' }, icon('bell-ring'),
      h('span', {}, en24.map((c) => `${c.nombre}: ${relativo(c.fecha_visita)}${c.hora_visita ? ' a las ' + hora(c.hora_visita) : ''}`).join(' · '))) : null,
    h('section', { class: 'kpis kpis-3' },
      kpi('Mejor oferta viva', mejor ? money(mejor.importe) : '—', mejor ? `${mejorComp?.nombre || ''} · ${fecha(mejor.fecha)}` : 'Todavía no hay ofertas', 'trophy'),
      kpi('Visitas registradas', String(comp.filter((c) => c.fecha_visita && c.fecha_visita <= hoy).length), `${prox.length} programadas`, 'door-open'),
      kpi('Interesados', String(comp.filter((c) => ['interesado', 'muy_interesado'].includes(c.resultado)).length), `${comp.filter((c) => c.resultado === 'muy_interesado').length} muy interesados`, 'heart')),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar' },
      [['todos', 'Todos'], ...OPT.resultado].map(([v, l]) => h('button', { class: 'chip' + (filtro === v ? ' active' : ''), 'aria-pressed': filtro === v, onclick: () => { filtro = v; recargar(); } }, l))),
    tabla);
}

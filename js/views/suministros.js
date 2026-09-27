import { db } from '../sb.js';
import { h, icon, money, fecha, diasHasta, badge, pageHead, formModal, confirmar, toast, labelOf, modal, exportCSV, refreshIcons } from '../ui.js';
import { F, OPT, TONO } from '../schema.js';
import { panelAdjuntos, borrarAdjuntos } from '../files.js';

const ICO = { luz: 'zap', gas: 'flame', agua: 'droplet', internet: 'wifi', movil: 'smartphone', seguro_hogar: 'shield-check', alarma: 'siren', comunidad: 'building-2', otro: 'plug' };

export async function render(el, ctx) {
  const [sums, tareas] = await Promise.all([db.list('suministros', { order: 'tipo', asc: true }), db.list('tareas', { eq: { categoria: 'mudanza' }, order: 'orden', asc: true })]);
  const recargar = () => render(el, ctx);
  const editar = (v) => formModal({ title: v.id ? 'Editar suministro' : 'Nuevo suministro', fields: F.suministros, value: v, onSave: async (x) => { await db.save('suministros', x); toast('Guardado'); recargar(); } });
  const adjuntos = (s) => modal({ title: `Contrato · ${labelOf(OPT.tipoSum, s.tipo)} ${s.compania || ''}`, wide: true, body: panelAdjuntos({ entidad: 'suministros', entidadId: s.id, titulo: 'Contratos y facturas', soloDocs: true }) });

  const tarjeta = (s) => {
    const n = diasHasta(s.fecha_vencimiento);
    return h('article', { class: 'card sum-card' },
      h('div', { class: 'row between' }, h('div', { class: 'row' }, h('span', { class: 'sum-ico' }, icon(ICO[s.tipo] || 'plug')),
        h('div', {}, h('h3', {}, labelOf(OPT.tipoSum, s.tipo)), h('p', { class: 'small muted' }, s.compania || 'Sin compañía'))),
        h('p', { class: 'price' }, s.importe_mensual ? money(s.importe_mensual) + '/mes' : '—')),
      h('div', { class: 'row wrap' }, badge(labelOf(OPT.estadoSum, s.estado), TONO[s.estado]),
        s.fecha_accion ? h('span', { class: 'small muted' }, icon('calendar'), 'Cambio: ' + fecha(s.fecha_accion)) : null,
        n !== null && n >= 0 && n <= 60 ? badge(`Permanencia acaba en ${n} d`, 'warn') : null),
      h('dl', { class: 'datos compact' },
        s.titular ? h('div', { class: 'dato' }, h('dt', {}, 'Titular'), h('dd', {}, s.titular)) : null,
        s.numero_contrato ? h('div', { class: 'dato' }, h('dt', {}, 'Contrato'), h('dd', { class: 'mono' }, s.numero_contrato)) : null,
        s.cups_referencia ? h('div', { class: 'dato' }, h('dt', {}, 'CUPS / ref.'), h('dd', { class: 'mono' }, s.cups_referencia)) : null,
        s.lectura_entrega ? h('div', { class: 'dato' }, h('dt', {}, 'Lectura entrega'), h('dd', {}, s.lectura_entrega)) : null),
      s.notas ? h('p', { class: 'small pre muted' }, s.notas) : null,
      h('div', { class: 'row card-actions' },
        s.telefono_atencion ? h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:' + s.telefono_atencion.replace(/\s/g, '') }, icon('phone'), 'Llamar') : null,
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => adjuntos(s) }, icon('paperclip'), 'Contrato'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editar(s) }, icon('pencil'), 'Editar'),
        h('button', { class: 'btn-icon', 'aria-label': 'Borrar', onclick: async () => { if (await confirmar('¿Borrar este suministro?')) { await borrarAdjuntos('suministros', s.id); await db.remove('suministros', s.id); recargar(); } } }, icon('trash-2'))));
  };

  const columna = (viv, titulo, sub) => {
    const l = sums.filter((s) => s.vivienda === viv);
    const total = l.filter((s) => s.estado !== 'de_baja').reduce((a, s) => a + (Number(s.importe_mensual) || 0), 0);
    const pend = l.filter((s) => s.estado.startsWith('pendiente')).length;
    return h('section', { class: 'col-sum' },
      h('div', { class: 'col-head' }, h('div', {}, h('h2', {}, titulo), h('p', { class: 'small muted' }, sub)),
        h('div', { class: 'right' }, h('p', { class: 'big' }, money(total)), h('p', { class: 'small muted' }, 'al mes' + (pend ? ` · ${pend} pendientes` : '')))),
      h('button', { class: 'btn btn-soft btn-block', onclick: () => editar({ vivienda: viv, estado: viv === 'actual' ? 'activo' : 'pendiente_alta' }) }, icon('plus'), 'Añadir suministro'),
      l.length ? h('div', { class: 'stack' }, l.map(tarjeta)) : h('p', { class: 'muted small center' }, viv === 'actual' ? 'Registra luz, agua, gas… de la casa de los padres para gestionar el cambio de titular o la baja.' : 'Apunta las altas que habrá que hacer en la casa nueva.'));
  };

  const check = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Checklist de mudanza'),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => formModal({ title: 'Nueva tarea de mudanza', fields: F.tareas, value: { categoria: 'mudanza' }, wide: false, onSave: async (x) => { await db.save('tareas', x); recargar(); } }) }, icon('plus'), 'Tarea')),
    tareas.length ? h('ul', { class: 'checklist' }, tareas.map((t) => h('li', { class: t.hecha ? 'is-done' : '' },
      h('label', {}, h('input', { type: 'checkbox', checked: t.hecha, onchange: async (e) => { await db.save('tareas', { id: t.id, hecha: e.target.checked }); recargar(); } }), h('span', {}, t.titulo)),
      h('span', { class: 'row' }, t.fecha_limite ? h('span', { class: 'small muted' }, fecha(t.fecha_limite)) : null,
        h('button', { class: 'btn-icon', 'aria-label': 'Borrar tarea', onclick: async () => { if (await confirmar('¿Borrar esta tarea?')) { await db.remove('tareas', t.id); recargar(); } } }, icon('x'))))))
      : h('p', { class: 'muted' }, 'Sin tareas.'));

  el.replaceChildren(
    pageHead('Suministros', 'Contratos de la casa actual y de la casa nueva',
      h('button', { class: 'btn btn-ghost', onclick: () => exportCSV('suministros', sums) }, icon('download'), 'CSV')),
    h('div', { class: 'grid-2 cols-sum' },
      columna('actual', 'Casa de los padres', 'Cambio de titular al comprador o baja tras la venta'),
      columna('nueva', 'Casa nueva', 'Altas o cambios de titular a nombre de tus padres')),
    check);
  refreshIcons();
}

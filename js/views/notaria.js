import { db, sb } from '../sb.js';
import { h, icon, fecha, diasHasta, badge, pageHead, formModal, confirmar, toast, progress, labelOf, modal, refreshIcons, exportCSV } from '../ui.js';
import { F, OPT, TONO } from '../schema.js';
import { panelAdjuntos, borrarAdjuntos } from '../files.js';

let filtroOp = 'venta';
let filtroEstado = 'todos';

export async function render(el, ctx) {
  const [docs, op, arch] = await Promise.all([db.list('documentos', { order: 'orden', asc: true }), db.get('operacion', 1),
    sb.from('archivos').select('entidad_id').eq('entidad', 'documentos').then((r) => r.data || [])]);
  const nAdj = {}; arch.forEach((a) => (nAdj[a.entidad_id] = (nAdj[a.entidad_id] || 0) + 1));
  const recargar = () => render(el, ctx);
  const editar = (v = { operacion: filtroOp }) => formModal({ title: v.id ? 'Editar documento' : 'Nuevo documento', fields: F.documentos, value: v, onSave: async (x) => { await db.save('documentos', x); toast('Guardado'); recargar(); } });
  const adjuntos = (d) => modal({ title: d.nombre, wide: true, body: panelAdjuntos({ entidad: 'documentos', entidadId: d.id, titulo: 'Archivos del documento', onChange: () => {} }), onClose: recargar });

  const resumen = (tipo) => {
    const l = docs.filter((d) => d.operacion === tipo && d.estado !== 'no_aplica');
    const ok = l.filter((d) => ['obtenido', 'entregado'].includes(d.estado)).length;
    const obl = l.filter((d) => d.obligatorio && !['obtenido', 'entregado'].includes(d.estado)).length;
    const f = tipo === 'venta' ? op?.fecha_firma_venta : op?.fecha_firma_compra;
    const n = diasHasta(f);
    return h('button', { class: 'card resumen-doc' + (filtroOp === tipo ? ' active' : ''), 'aria-pressed': filtroOp === tipo, onclick: () => { filtroOp = tipo; recargar(); } },
      h('div', { class: 'row between' }, h('h2', {}, tipo === 'venta' ? 'Venta · casa de los padres' : 'Compra · casa nueva'), h('span', { class: 'big' }, `${ok}/${l.length}`)),
      progress(l.length ? (ok / l.length) * 100 : 0, ok === l.length && l.length ? 'ok' : ''),
      h('p', { class: 'small ' + (obl ? 'txt-warn' : 'muted') }, obl ? `${obl} obligatorios pendientes` : 'Todos los obligatorios listos'),
      h('p', { class: 'small muted' }, f ? `Firma: ${fecha(f)}${n !== null && n >= 0 ? ` · faltan ${n} días` : ''}` : 'Sin fecha de firma (ponla en Ajustes)'));
  };

  let lista = docs.filter((d) => d.operacion === filtroOp);
  if (filtroEstado === 'pendientes') lista = lista.filter((d) => ['pendiente', 'en_tramite'].includes(d.estado));
  if (filtroEstado === 'listos') lista = lista.filter((d) => ['obtenido', 'entregado'].includes(d.estado));

  const fila = (d) => {
    const n = diasHasta(d.fecha_caducidad);
    const cad = d.fecha_caducidad ? (n < 0 ? badge('Caducado', 'danger') : n <= 30 ? badge(`Caduca en ${n} d`, 'warn') : h('span', { class: 'small muted' }, 'Caduca ' + fecha(d.fecha_caducidad))) : null;
    const listo = ['obtenido', 'entregado'].includes(d.estado);
    return h('li', { class: 'doc-row' + (listo ? ' is-done' : '') + (d.estado === 'no_aplica' ? ' is-muted' : '') },
      h('button', { class: 'check', 'aria-label': listo ? 'Marcar como pendiente' : 'Marcar como obtenido', 'aria-pressed': listo,
        onclick: async () => { await db.save('documentos', { id: d.id, estado: listo ? 'pendiente' : 'obtenido' }); recargar(); } }, icon(listo ? 'circle-check-big' : 'circle')),
      h('div', { class: 'doc-main' },
        h('p', { class: 'doc-title' }, d.nombre, d.obligatorio ? h('span', { class: 'req-tag' }, 'Obligatorio') : null),
        d.descripcion ? h('p', { class: 'small muted' }, d.descripcion) : null,
        h('div', { class: 'row wrap small' }, d.responsable ? h('span', { class: 'muted' }, icon('user'), d.responsable) : null, cad, d.notas ? h('span', { class: 'muted' }, '· ' + d.notas) : null)),
      h('div', { class: 'doc-side' },
        h('select', { class: 'inline-select', 'aria-label': 'Estado de ' + d.nombre, onchange: async (e) => { await db.save('documentos', { id: d.id, estado: e.target.value }); toast('Estado actualizado'); recargar(); } },
          OPT.estadoDoc.map(([v, l]) => h('option', { value: v, selected: v === d.estado }, l))),
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => adjuntos(d) }, icon('paperclip'), nAdj[d.id] ? String(nAdj[d.id]) : 'Adjuntar'),
        h('button', { class: 'btn-icon', 'aria-label': 'Editar', onclick: () => editar(d) }, icon('pencil')),
        h('button', { class: 'btn-icon', 'aria-label': 'Borrar', onclick: async () => { if (await confirmar(`¿Borrar «${d.nombre}» del checklist?`)) { await borrarAdjuntos('documentos', d.id); await db.remove('documentos', d.id); recargar(); } } }, icon('trash-2'))));
  };

  const revisarTodo = async () => {
    const obt = docs.filter((d) => d.operacion === filtroOp && d.estado === 'obtenido');
    if (!obt.length) { toast('No hay documentos «obtenidos» para marcar como entregados'); return; }
    if (!(await confirmar(`¿Marcar ${obt.length} documentos obtenidos como entregados en la notaría?`, { ok: 'Marcar', peligro: false }))) return;
    await Promise.all(obt.map((d) => db.save('documentos', { id: d.id, estado: 'entregado' })));
    toast('Documentos marcados como entregados'); recargar();
  };

  el.replaceChildren(
    pageHead('Documentación para la notaría', 'El checklist más importante: que el día de la firma no falte nada',
      h('button', { class: 'btn btn-ghost', onclick: () => exportCSV('documentos-notaria', docs) }, icon('download'), 'CSV'),
      h('button', { class: 'btn btn-ghost', onclick: () => diaFirma(docs, op) }, icon('file-down'), 'Preparar día de la firma'),
      h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Añadir documento')),
    h('div', { class: 'grid-2' }, resumen('venta'), resumen('compra')),
    h('div', { class: 'toolbar' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por estado' },
        [['todos', 'Todos'], ['pendientes', 'Pendientes'], ['listos', 'Listos']].map(([v, l]) => h('button', { class: 'chip' + (filtroEstado === v ? ' active' : ''), 'aria-pressed': filtroEstado === v, onclick: () => { filtroEstado = v; recargar(); } }, l))),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: revisarTodo }, icon('check-check'), 'Marcar obtenidos como entregados')),
    h('section', { class: 'card' }, lista.length ? h('ul', { class: 'doc-rows' }, lista.map(fila)) : h('p', { class: 'muted' }, 'No hay documentos con este filtro.')),
    h('p', { class: 'small muted disclaimer' }, 'Lista orientativa basada en la práctica notarial habitual en la Comunidad de Madrid. Confirma con la notaría qué necesita exactamente para tu caso.'));
  refreshIcons();
}

function diaFirma(docs, op) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('No se ha podido cargar el generador de PDF', 'error'); return; }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const linea = (t, size = 11, bold = false, color = 30) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color); const l = doc.splitTextToSize(t, 180); if (y + l.length * 5.5 > 285) { doc.addPage(); y = 18; } doc.text(l, 15, y); y += l.length * (size * 0.45) + 1.5; };
  linea('CasaMarta · Día de la firma', 18, true); y += 2;
  for (const tipo of ['venta', 'compra']) {
    const f = tipo === 'venta' ? op?.fecha_firma_venta : op?.fecha_firma_compra;
    const n = tipo === 'venta' ? op?.notaria_venta : op?.notaria_compra;
    y += 4; linea(tipo === 'venta' ? 'VENTA — casa de los padres' : 'COMPRA — casa nueva', 13, true);
    linea(`Fecha: ${fecha(f)}   ·   Notaría: ${n || '—'}`, 10, false, 110); y += 1;
    for (const d of docs.filter((x) => x.operacion === tipo && x.estado !== 'no_aplica')) {
      const ok = ['obtenido', 'entregado'].includes(d.estado);
      linea(`${ok ? '[x]' : '[  ]'}  ${d.nombre}${d.obligatorio ? ' (obligatorio)' : ''} — ${labelOf(OPT.estadoDoc, d.estado)}${d.fecha_caducidad ? ' · caduca ' + fecha(d.fecha_caducidad) : ''}`, 10.5, !ok && d.obligatorio, ok ? 60 : 30);
    }
  }
  y += 6; linea('Recuerda llevar los originales de los DNI en vigor y los medios de pago acordados. Lista orientativa: confírmala con la notaría.', 9, false, 120);
  doc.save('casamarta-dia-de-la-firma.pdf');
}

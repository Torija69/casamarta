import { db } from '../sb.js';
import { h, icon, money, fecha, badge, pageHead, formModal, confirmar, toast, labelOf, modal, exportCSV, refreshIcons, empty, progress } from '../ui.js';
import { F, OPT, TONO } from '../schema.js';
import { panelAdjuntos, borrarAdjuntos } from '../files.js';

export async function render(el, ctx) {
  const [refs, pres, pisos] = await Promise.all([db.list('reformas', { order: 'created_at', asc: true }), db.list('presupuestos', { order: 'importe', asc: true }), db.list('pisos')]);
  const recargar = () => render(el, ctx);
  const campoPiso = { k: 'piso_id', label: 'Piso', type: 'select', opts: [['', 'Casa nueva (sin vincular)'], ...pisos.filter((p) => p.estado !== 'descartado').map((p) => [p.id, p.direccion])], full: true };
  const campos = [F.reformas[0], campoPiso, ...F.reformas.slice(1)];
  const editar = (v = {}) => formModal({ title: v.id ? 'Editar reforma' : 'Nueva reforma', fields: campos, value: v, onSave: async (x) => { await db.save('reformas', { ...x, piso_id: x.piso_id || null }); toast('Guardado'); recargar(); } });
  const elegido = (r) => pres.find((p) => p.reforma_id === r.id && p.elegido);
  const coste = (r) => Number(elegido(r)?.importe) || Number(r.presupuesto_estimado) || 0;

  const ficha = (r) => {
    const ps = pres.filter((p) => p.reforma_id === r.id);
    const editarPres = (v = { reforma_id: r.id }) => formModal({ title: `${v.id ? 'Editar' : 'Nuevo'} presupuesto · ${r.titulo}`, fields: F.presupuestos, value: v, wide: false,
      onSave: async (x) => {
        if (x.elegido) await Promise.all(ps.filter((p) => p.elegido && p.id !== x.id).map((p) => db.save('presupuestos', { id: p.id, elegido: false })));
        await db.save('presupuestos', { ...x, reforma_id: r.id });
        if (x.elegido && ['pendiente_presupuesto', 'presupuestada'].includes(r.estado)) await db.save('reformas', { id: r.id, estado: 'aprobada' });
        else if (r.estado === 'pendiente_presupuesto') await db.save('reformas', { id: r.id, estado: 'presupuestada' });
        toast('Presupuesto guardado'); m.close(); recargar();
      } });
    const piso = pisos.find((p) => p.id === r.piso_id);
    const m = modal({ title: r.titulo, wide: true, body: h('div', { class: 'stack' },
      h('div', { class: 'row wrap' }, badge(labelOf(OPT.estadoRef, r.estado), 'info'), badge(labelOf(OPT.prioridad, r.prioridad), TONO[r.prioridad]), h('span', { class: 'muted small' }, [labelOf(OPT.categoria, r.categoria), r.estancia, piso?.direccion].filter(Boolean).join(' · '))),
      r.descripcion ? h('p', { class: 'pre' }, r.descripcion) : null,
      h('div', { class: 'grid-3 tight' },
        h('div', {}, h('p', { class: 'kpi-label' }, 'Estimado'), h('p', { class: 'big' }, money(r.presupuesto_estimado))),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Presupuesto elegido'), h('p', { class: 'big' }, money(elegido(r)?.importe))),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Pagado'), h('p', { class: 'big' }, money(r.pagado)))),
      h('div', {}, h('div', { class: 'card-head' }, h('h3', {}, 'Presupuestos'), h('button', { class: 'btn btn-soft btn-sm', onclick: () => editarPres() }, icon('plus'), 'Añadir')),
        ps.length ? h('ul', { class: 'list' }, ps.map((p) => h('li', { class: 'list-item' + (p.elegido ? ' is-chosen' : '') },
          h('div', {}, h('strong', {}, p.empresa), ' ', p.elegido ? badge('Elegido', 'ok') : null, h('p', { class: 'small muted' }, [money(p.importe), fecha(p.fecha), p.contacto, p.telefono].filter(Boolean).join(' · ')), p.notas ? h('p', { class: 'small' }, p.notas) : null),
          h('div', { class: 'row' }, h('button', { class: 'btn-icon', 'aria-label': 'Editar presupuesto', onclick: () => { m.close(); editarPres(p); } }, icon('pencil')),
            h('button', { class: 'btn-icon', 'aria-label': 'Borrar presupuesto', onclick: async () => { if (await confirmar('¿Borrar este presupuesto?')) { await db.remove('presupuestos', p.id); m.close(); recargar(); } } }, icon('trash-2'))))))
          : h('p', { class: 'muted small' }, 'Pide al menos tres presupuestos para comparar.')),
      panelAdjuntos({ entidad: 'reformas', entidadId: r.id, bucketFotos: 'reformas-fotos', titulo: 'Fotos (antes / después) y presupuestos en PDF' })),
      actions: [h('button', { class: 'btn btn-ghost', onclick: async () => { if (await confirmar('¿Borrar esta reforma y sus presupuestos?')) { await borrarAdjuntos('reformas', r.id); await db.remove('reformas', r.id); m.close(); recargar(); } } }, icon('trash-2'), 'Borrar'),
        h('button', { class: 'btn btn-primary', onclick: () => { m.close(); editar(r); } }, icon('pencil'), 'Editar')] });
  };

  const tarjeta = (r) => h('article', { class: 'card kan-card prio-' + r.prioridad },
    h('button', { class: 'kan-open', onclick: () => ficha(r) }, h('h3', {}, r.titulo),
      h('p', { class: 'small muted' }, [labelOf(OPT.categoria, r.categoria), r.estancia].filter(Boolean).join(' · ')),
      h('div', { class: 'row between' }, h('strong', {}, money(coste(r))), badge(labelOf(OPT.prioridad, r.prioridad), TONO[r.prioridad])),
      h('p', { class: 'small muted' }, `${pres.filter((p) => p.reforma_id === r.id).length} presupuestos${r.fecha_inicio ? ' · ' + fecha(r.fecha_inicio) : ''}`)),
    h('select', { class: 'inline-select', 'aria-label': 'Mover a', onchange: async (e) => { await db.save('reformas', { id: r.id, estado: e.target.value }); recargar(); } },
      OPT.estadoRef.map(([v, l]) => h('option', { value: v, selected: v === r.estado }, l))));

  const totEst = refs.reduce((s, r) => s + (Number(r.presupuesto_estimado) || 0), 0);
  const totAcep = refs.reduce((s, r) => s + (Number(elegido(r)?.importe) || 0), 0);
  const totPag = refs.reduce((s, r) => s + (Number(r.pagado) || 0), 0);
  const totPrev = refs.reduce((s, r) => s + coste(r), 0);
  const conFechas = refs.filter((r) => r.fecha_inicio && r.fecha_fin).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

  let gantt = null;
  if (conFechas.length) {
    const t0 = new Date(conFechas[0].fecha_inicio).getTime();
    const t1 = Math.max(...conFechas.map((r) => new Date(r.fecha_fin).getTime()));
    const span = Math.max(1, t1 - t0);
    gantt = h('section', { class: 'card' }, h('h2', {}, 'Calendario de obras'), h('div', { class: 'gantt' }, conFechas.map((r) => {
      const a = ((new Date(r.fecha_inicio).getTime() - t0) / span) * 100, w = Math.max(2, ((new Date(r.fecha_fin).getTime() - new Date(r.fecha_inicio).getTime()) / span) * 100);
      return h('div', { class: 'g-row' }, h('span', { class: 'g-label' }, r.titulo), h('div', { class: 'g-track' }, h('div', { class: 'g-bar', style: { left: a + '%', width: w + '%' }, title: `${fecha(r.fecha_inicio)} → ${fecha(r.fecha_fin)}` })));
    })), h('p', { class: 'small muted' }, `${fecha(conFechas[0].fecha_inicio)} → ${fecha(new Date(t1).toISOString().slice(0, 10))}`));
  }

  el.replaceChildren(
    pageHead('Reformas de la casa nueva', 'Qué hay que hacer, cuánto cuesta y en qué punto está',
      h('button', { class: 'btn btn-ghost', onclick: () => exportCSV('reformas', refs.map((r) => ({ ...r, presupuesto_elegido: elegido(r)?.importe ?? '' }))) }, icon('download'), 'CSV'),
      h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Nueva reforma')),
    h('section', { class: 'kpis kpis-4' },
      h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, 'Estimado'), h('div', { class: 'kpi-value' }, money(totEst))),
      h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, 'Presupuestos elegidos'), h('div', { class: 'kpi-value' }, money(totAcep))),
      h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, 'Coste previsto'), h('div', { class: 'kpi-value' }, money(totPrev)), h('div', { class: 'kpi-sub' }, 'elegido o, si no hay, estimado')),
      h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label' }, 'Pagado'), h('div', { class: 'kpi-value' }, money(totPag)), progress(totPrev ? (totPag / totPrev) * 100 : 0))),
    refs.length ? h('div', { class: 'kanban' }, OPT.estadoRef.map(([v, l]) => {
      const col = refs.filter((r) => r.estado === v);
      return h('section', { class: 'kan-col' }, h('header', {}, h('h2', {}, l), h('span', { class: 'badge badge-neutral' }, col.length)), col.map(tarjeta));
    })) : empty('hammer', 'Sin reformas todavía', 'Apunta lo que habría que cambiar en la casa nueva: cocina, baño, suelos, ventanas… y ve añadiendo presupuestos.', h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Nueva reforma')),
    gantt);
  refreshIcons();
}

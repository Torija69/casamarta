import { db } from '../sb.js';
import { h, icon, money, fecha, diasHasta, badge, empty, pageHead, formModal, confirmar, toast, progress, labelOf } from '../ui.js';
import { F, OPT } from '../schema.js';
import { panelAdjuntos, borrarAdjuntos } from '../files.js';
import { comisionAgencia } from '../datos.js';

export async function render(el, ctx) {
  const [agencias, op] = await Promise.all([db.list('agencias'), db.get('operacion', 1)]);
  const recargar = () => render(el, ctx);
  const editar = (v = {}) => formModal({ title: v.id ? 'Editar agencia' : 'Nueva agencia', fields: F.agencias, value: v, onSave: async (x) => { await db.save('agencias', x); toast('Guardado'); recargar(); } });
  const precioBase = Number(op?.precio_venta_previsto) || 0;

  const ficha = (a) => {
    const total = a.fecha_firma && a.fecha_vencimiento ? diasHasta(a.fecha_vencimiento) - diasHasta(a.fecha_firma) : null;
    const quedan = diasHasta(a.fecha_vencimiento);
    const pct = total ? ((total - quedan) / total) * 100 : 0;
    const preaviso = a.fecha_vencimiento && a.dias_preaviso ? quedan - a.dias_preaviso : null;
    const tono = quedan === null ? '' : quedan < 0 ? 'muted' : quedan <= 7 ? 'danger' : quedan <= 30 ? 'warn' : 'ok';
    const precio = h('input', { type: 'number', inputmode: 'decimal', value: precioBase || '', placeholder: 'Precio de venta', 'aria-label': 'Precio de venta para calcular la comisión' });
    const res = h('p', { class: 'big' });
    const calc = () => { const c = comisionAgencia(a, precio.value); res.textContent = money(c); };
    precio.addEventListener('input', calc); calc();

    return h('article', { class: 'card' },
      h('div', { class: 'row between wrap' },
        h('div', {}, h('h2', {}, a.nombre), h('p', { class: 'muted' }, [a.agente, a.telefono, a.email].filter(Boolean).join(' · '))),
        h('div', { class: 'row' }, a.exclusividad ? badge('Exclusiva', 'accent') : badge('Sin exclusiva', 'neutral'), a.prorroga_automatica ? badge('Prórroga automática', 'warn') : null)),
      h('div', { class: 'grid-3 tight' },
        h('div', {}, h('p', { class: 'kpi-label' }, 'Comisión'), h('p', { class: 'big' }, a.tipo_comision === 'porcentaje' ? `${a.comision_valor ?? '—'} %` : money(a.comision_valor)),
          h('p', { class: 'small muted' }, a.iva_incluido ? 'IVA incluido' : '+ 21 % IVA')),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Contrato'), h('p', {}, `${fecha(a.fecha_firma)} → ${fecha(a.fecha_vencimiento)}`),
          quedan !== null ? h('div', {}, progress(pct, tono), h('p', { class: 'small ' + (tono === 'danger' ? 'txt-danger' : 'muted') }, quedan < 0 ? `Venció hace ${-quedan} días` : `Quedan ${quedan} días`)) : null,
          preaviso !== null && preaviso >= 0 ? h('p', { class: 'small muted' }, `Para no renovar, avisa antes de ${preaviso} días (${a.dias_preaviso} de preaviso).`) : null),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Comisión estimada (con IVA)'), h('div', { class: 'input-suf' }, precio, h('span', {}, '€')), res)),
      a.clausulas ? h('div', {}, h('h3', {}, 'Cláusulas relevantes'), h('p', { class: 'pre' }, a.clausulas)) : null,
      a.notas ? h('p', { class: 'pre muted' }, a.notas) : null,
      panelAdjuntos({ entidad: 'agencias', entidadId: a.id, titulo: 'Contrato y documentos', soloDocs: true }),
      h('div', { class: 'row card-actions' },
        a.telefono ? h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:' + a.telefono.replace(/\s/g, '') }, icon('phone'), 'Llamar') : null,
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => editar(a) }, icon('pencil'), 'Editar'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { if (await confirmar(`¿Borrar la agencia ${a.nombre}?`)) { await borrarAdjuntos('agencias', a.id); await db.remove('agencias', a.id); recargar(); } } }, icon('trash-2'), 'Borrar')));
  };

  el.replaceChildren(
    pageHead('Agencia inmobiliaria', 'Contrato, comisión y vencimientos de la venta',
      h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Añadir agencia')),
    agencias.length ? h('div', { class: 'stack' }, agencias.map(ficha))
      : empty('handshake', 'Sin agencia registrada', 'Guarda los datos del contrato con la inmobiliaria: comisión, exclusividad y fecha de vencimiento. Te avisaremos 30 días antes.',
        h('button', { class: 'btn btn-primary', onclick: () => editar() }, icon('plus'), 'Añadir agencia')));
}

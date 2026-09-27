import { db } from '../sb.js';
import { h, icon, money, fecha, badge, pageHead, formModal, confirmar, toast, number, refreshIcons } from '../ui.js';
import { F } from '../schema.js';
import { cargarTodo, plusvalia, irpfVenta, costesCompra, comisionAgencia } from '../datos.js';

const AEAT_65 = 'https://sede.agenciatributaria.gob.es/Sede/vivienda-otros-inmuebles/que-ocurre-cuando-vendo-inmueble/transmision-vivienda-habitual-mayores-65-anos.html';
const MAJA_OF4 = 'https://portaltributario.majadahonda.org/ordenanzas/MAJADAHONDA-OF-4-MOD-2026-DEROG.pdf';
const MAJA_PLUS = 'https://www.majadahonda.org/tributos-tramites-y-servicios/-/asset_publisher/719PRln4JYZM/content/declaracion-del-impuesto-sobre-el-incremento-de-valor-de-los-terrenos-de-naturaleza-urbana-plusvali-1';

export async function render(el, ctx) {
  const d = await cargarTodo();
  const o = d.operacion;
  const recargar = () => render(el, ctx);
  const editarOp = () => formModal({ title: 'Datos de la operación', fields: F.operacion, value: o, onSave: async (v) => { await db.upsert('operacion', { ...v, id: 1 }); toast('Datos guardados'); recargar(); } });
  const editarTit = (v = {}) => formModal({ title: v.id ? 'Editar titular' : 'Añadir titular', fields: F.titulares, value: v, wide: false, onSave: async (x) => { await db.save('titulares', x); toast('Titular guardado'); recargar(); } });

  const mejorOferta = Math.max(0, ...d.ofertas.filter((x) => !['rechazada', 'retirada'].includes(x.estado)).map((x) => Number(x.importe)));
  const precioVenta = Number(o.precio_venta_previsto) || mejorOferta || 0;
  const com = comisionAgencia(d.agencias[0], precioVenta);
  const pv = plusvalia(o, d.parametros, precioVenta);
  const irpf = irpfVenta(d, precioVenta, com, pv.cuota || 0);
  const precioCompra = Number(o.precio_compra_previsto) || 0;
  const cc = costesCompra(d, precioCompra);
  const sumaPct = d.titulares.reduce((s, t) => s + Number(t.porcentaje || 0), 0);

  const fila = (l, v, cls = '') => h('div', { class: 'calc-row ' + cls }, h('span', {}, l), h('strong', {}, v));
  const falta = (txt) => h('p', { class: 'small txt-warn' }, icon('info'), txt);

  // --- Titulares ---
  const titulares = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Titulares de la casa'), h('button', { class: 'btn btn-soft btn-sm', onclick: () => editarTit() }, icon('user-plus'), 'Añadir titular')),
    h('div', { class: 'banner banner-info' }, icon('info'),
      h('span', {}, 'Si los titulares tienen 65 años o más y es su vivienda habitual, la ganancia de la venta está ', h('strong', {}, 'exenta de IRPF'),
        '. La plusvalía municipal ', h('strong', {}, 'no'), ' tiene exención por edad. ', h('a', { href: AEAT_65, target: '_blank', rel: 'noopener' }, 'Agencia Tributaria'))),
    d.titulares.length ? h('ul', { class: 'list' }, irpf.titulares.map((t) => h('li', { class: 'list-item' },
      h('div', {}, h('strong', {}, t.nombre), h('span', { class: 'muted small' }, ` · ${number(t.porcentaje)} % · ${t.edad !== null ? t.edad + ' años el día de la firma' : 'falta fecha de nacimiento'} · ${t.vivienda_habitual ? 'vivienda habitual' : 'no es vivienda habitual'}`)),
      h('div', { class: 'row' }, t.exento ? badge('Posible exención IRPF', 'ok') : t.dudoso ? badge('Faltan datos', 'warn') : badge('Tributa en IRPF', 'danger'),
        h('button', { class: 'btn-icon', 'aria-label': 'Editar titular', onclick: () => editarTit(d.titulares.find((x) => x.id === t.id)) }, icon('pencil')),
        h('button', { class: 'btn-icon', 'aria-label': 'Borrar titular', onclick: async () => { if (await confirmar(`¿Borrar a ${t.nombre}?`)) { await db.remove('titulares', t.id); recargar(); } } }, icon('trash-2'))))))
      : h('p', { class: 'muted' }, 'Añade a los padres como titulares con su porcentaje de propiedad y fecha de nacimiento.'),
    d.titulares.length && Math.round(sumaPct) !== 100 ? falta(`Los porcentajes suman ${number(sumaPct)} %, deberían sumar 100 %.`) : null);

  // --- Plusvalía ---
  const plus = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Plusvalía municipal (Majadahonda)'), h('button', { class: 'btn btn-ghost btn-sm', onclick: editarOp }, icon('pencil'), 'Datos')),
    h('p', { class: 'small muted' }, 'La paga el vendedor. Se calcula por los dos métodos y se aplica el que salga más bajo. Si se vende por menos de lo que se compró, no hay impuesto.'),
    !o.valor_catastral_suelo ? falta('Falta el valor catastral del suelo (está en el recibo del IBI).') : null,
    !o.fecha_adquisicion ? falta('Falta la fecha en que los padres compraron la casa.') : null,
    fila('Años de tenencia', pv.anios ?? '—'), fila('Valor catastral del suelo', money(o.valor_catastral_suelo)),
    fila(`Método objetivo (coef. ${pv.coef != null ? number(pv.coef) : '—'})`, money(pv.baseObj)),
    fila('Método real (ganancia × % suelo)', pv.baseReal !== null ? money(pv.baseReal) : 'faltan datos'),
    fila('Base imponible aplicada', pv.sinIncremento ? 'No sujeta: sin ganancia' : money(pv.base)),
    fila(`Tipo de gravamen`, `${pv.tipo} %`),
    fila('Plusvalía estimada', money(pv.cuota), 'total'),
    h('p', { class: 'small muted' }, 'Plazo: 30 días hábiles desde la firma. ', h('a', { href: MAJA_PLUS, target: '_blank', rel: 'noopener' }, 'Trámite en Majadahonda'), ' · ', h('a', { href: MAJA_OF4, target: '_blank', rel: 'noopener' }, 'Ordenanza fiscal nº 4 (2026)')));

  // --- IRPF ---
  const irpfCard = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'IRPF por la venta'), h('button', { class: 'btn btn-ghost btn-sm', onclick: editarOp }, icon('pencil'), 'Datos')),
    !precioVenta ? falta('Indica el precio de venta previsto (o registra una oferta).') : null,
    !o.precio_adquisicion ? falta('Falta el precio por el que se compró la casa.') : null,
    fila('Precio de venta', money(precioVenta)), fila('− Comisión agencia (con IVA)', money(com)), fila('− Plusvalía municipal', money(pv.cuota)), fila('− Otros gastos de venta', money(o.gastos_venta)),
    fila('= Valor de transmisión', money(irpf.valorTransmision)),
    fila('Valor de adquisición (precio + gastos + mejoras)', money(irpf.valorAdquisicion)),
    fila('Ganancia patrimonial', money(irpf.ganancia), irpf.ganancia > 0 ? '' : 'pos'),
    irpf.titulares.map((t) => fila(`${t.nombre} (${number(t.porcentaje)} %)`, t.exento ? `${money(t.parte)} · exento` : `${money(t.parte)} → ${money(t.cuota)}`)),
    fila('IRPF estimado total', money(irpf.total), 'total'),
    h('p', { class: 'small muted' }, 'Escala del ahorro: 19 % hasta 6.000 €, 21 % hasta 50.000 €, 23 % hasta 200.000 €, 27 % hasta 300.000 € y 30 % a partir de ahí. La venta se declara en la renta del año siguiente, aunque esté exenta.'));

  // --- Compra ---
  const compra = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Impuestos y gastos de la compra'), h('button', { class: 'btn btn-ghost btn-sm', onclick: editarOp }, icon('pencil'), 'Datos')),
    !precioCompra ? falta('Indica el precio de compra previsto en los datos de la operación.') : null,
    fila('Precio de compra', money(precioCompra)), fila('Tipo de vivienda', cc.nueva ? 'Obra nueva' : 'Segunda mano'),
    cc.nueva ? [fila(`IVA (${d.parametros.iva_obra_nueva ?? 10} %)`, money(cc.iva)), fila(`AJD Comunidad de Madrid (${d.parametros.ajd_madrid ?? 0.75} %)`, money(cc.ajd))]
      : fila(`ITP Comunidad de Madrid (${d.parametros.itp_general ?? 6} %)`, money(cc.itp)),
    fila(`Notaría, registro y gestoría (~${d.parametros.gastos_notaria_registro_pct ?? 1} %)`, money(cc.notaria)),
    fila('Total impuestos y gastos', money(cc.total), 'total'),
    h('p', { class: 'small muted' }, 'En Madrid hay tipos reducidos o bonificaciones en algunos casos (familia numerosa, menores de 35 años…). Comprueba si aplica alguno. El ITP se liquida con el modelo 600 en 30 días hábiles.'));

  // --- Parámetros ---
  const params = h('details', { class: 'card' }, h('summary', {}, h('h2', {}, 'Parámetros fiscales y fuentes')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Parámetro'), h('th', {}, 'Valor'), h('th', {}, 'Fuente'), h('th', {}, 'Consultado'))),
      h('tbody', {}, d.parametros._rows.map((r) => h('tr', {}, h('td', {}, r.descripcion || r.clave), h('td', { class: 'mono' }, JSON.stringify(r.valor)),
        h('td', {}, r.fuente_url ? h('a', { href: r.fuente_url, target: '_blank', rel: 'noopener' }, new URL(r.fuente_url).hostname) : '—'), h('td', {}, fecha(r.consultado))))))),
    h('p', { class: 'small muted' }, 'Puedes editarlos en Ajustes si cambia la normativa.'));

  // --- Checklist fiscal ---
  const tareas = d.tareas.filter((t) => t.categoria === 'fiscal').sort((a, b) => a.orden - b.orden);
  const check = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Checklist fiscal'),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => formModal({ title: 'Nueva tarea fiscal', fields: F.tareas, value: { categoria: 'fiscal' }, wide: false, onSave: async (x) => { await db.save('tareas', x); recargar(); } }) }, icon('plus'), 'Tarea')),
    h('ul', { class: 'checklist' }, tareas.map((t) => h('li', { class: t.hecha ? 'is-done' : '' },
      h('label', {}, h('input', { type: 'checkbox', checked: t.hecha, onchange: async (e) => { await db.save('tareas', { id: t.id, hecha: e.target.checked }); recargar(); } }), h('span', {}, t.titulo)),
      t.fecha_limite ? h('span', { class: 'small muted' }, fecha(t.fecha_limite)) : null))));

  el.replaceChildren(
    pageHead('Impuestos y gastos', 'Cálculos orientativos de la venta y la compra',
      h('button', { class: 'btn btn-primary', onclick: editarOp }, icon('pencil'), 'Datos de la operación')),
    h('div', { class: 'banner banner-warn', role: 'note' }, icon('scale'), h('span', {}, h('strong', {}, 'Esta información es orientativa. Consulta con un asesor fiscal.'), ' Los cálculos usan la normativa vigente consultada el 27/09/2026.')),
    titulares,
    h('div', { class: 'grid-2' }, plus, irpfCard),
    h('div', { class: 'grid-2' }, compra, check),
    params);
  refreshIcons();
}

// Carga conjunta de datos y cálculos compartidos (agenda, alertas, fiscalidad).
import { db } from './sb.js';
import { diasHasta, fecha, hora, money } from './ui.js';

export async function cargarTodo() {
  const tablas = ['pisos', 'compradores', 'ofertas', 'agencias', 'documentos', 'suministros', 'reformas', 'presupuestos', 'tareas', 'eventos', 'titulares', 'visitas_pisos'];
  const res = await Promise.all(tablas.map((t) => db.list(t)));
  const d = Object.fromEntries(tablas.map((t, i) => [t, res[i]]));
  d.operacion = (await db.get('operacion', 1)) || { id: 1 };
  d.parametros = await cargarParametros();
  return d;
}

export async function cargarParametros() {
  const rows = await db.list('parametros', { order: 'clave', asc: true });
  const p = {};
  for (const r of rows) p[r.clave] = r.valor;
  p._rows = rows;
  return p;
}

// ---------- Agenda unificada ----------
export function eventos(d) {
  const ev = [];
  const add = (f, hr, titulo, tipo, href, extra = '') => { if (f) ev.push({ fecha: String(f).slice(0, 10), hora: hora(hr), titulo, tipo, href, extra }); };
  d.pisos.forEach((p) => p.estado !== 'descartado' && add(p.fecha_visita, p.hora_visita, `Visita piso: ${p.direccion}`, 'piso', `#/pisos/${p.id}`, p.contacto_nombre || ''));
  d.visitas_pisos.forEach((v) => { const p = d.pisos.find((x) => x.id === v.piso_id); add(v.fecha, v.hora, `Visita piso: ${p ? p.direccion : ''}`, 'piso', p ? `#/pisos/${p.id}` : '#/pisos'); });
  d.compradores.forEach((c) => add(c.fecha_visita, c.hora_visita, `Visita comprador: ${c.nombre}`, 'comprador', '#/venta', c.telefono || ''));
  d.agencias.forEach((a) => {
    add(a.fecha_vencimiento, null, `Vence contrato agencia ${a.nombre}`, 'agencia', '#/agencia');
    if (a.fecha_vencimiento && a.dias_preaviso) {
      const f = new Date(a.fecha_vencimiento + 'T00:00:00'); f.setDate(f.getDate() - a.dias_preaviso);
      add(f.toISOString().slice(0, 10), null, `Último día de preaviso agencia ${a.nombre}`, 'agencia', '#/agencia');
    }
  });
  d.documentos.forEach((x) => x.estado !== 'no_aplica' && add(x.fecha_caducidad, null, `Caduca: ${x.nombre}`, 'documento', '#/notaria'));
  d.suministros.forEach((s) => { add(s.fecha_accion, null, `Suministro ${s.tipo} (${s.vivienda === 'actual' ? 'casa actual' : 'casa nueva'}): gestionar cambio`, 'suministro', '#/suministros'); add(s.fecha_vencimiento, null, `Fin permanencia ${s.compania || s.tipo}`, 'suministro', '#/suministros'); });
  d.reformas.forEach((r) => { add(r.fecha_inicio, null, `Empieza reforma: ${r.titulo}`, 'reforma', '#/reformas'); add(r.fecha_fin, null, `Termina reforma: ${r.titulo}`, 'reforma', '#/reformas'); });
  d.tareas.forEach((t) => !t.hecha && add(t.fecha_limite, null, `Tarea: ${t.titulo}`, 'tarea', t.categoria === 'mudanza' ? '#/suministros' : '#/impuestos'));
  d.eventos.forEach((e) => add(e.fecha, e.hora, e.titulo, e.tipo === 'notaria' ? 'notaria' : 'evento', '#/agenda', e.lugar || ''));
  const o = d.operacion || {};
  add(o.fecha_firma_venta, null, 'Firma de la VENTA en notaría', 'notaria', '#/notaria', o.notaria_venta || '');
  add(o.fecha_firma_compra, null, 'Firma de la COMPRA en notaría', 'notaria', '#/notaria', o.notaria_compra || '');
  if (o.fecha_firma_venta) {
    const f = sumarDiasHabiles(o.fecha_firma_venta, 30);
    add(f, null, 'Límite para presentar la plusvalía (Majadahonda)', 'tarea', '#/impuestos');
  }
  if (o.fecha_firma_compra && !o.compra_obra_nueva) add(sumarDiasHabiles(o.fecha_firma_compra, 30), null, 'Límite para liquidar el ITP (modelo 600)', 'tarea', '#/impuestos');
  return ev.sort((a, b) => (a.fecha + (a.hora || '99')).localeCompare(b.fecha + (b.hora || '99')));
}

export function sumarDiasHabiles(iso, n) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  let k = 0;
  while (k < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) k++; }
  return d.toISOString().slice(0, 10);
}

// ---------- Alertas ----------
export function alertas(d) {
  const out = [];
  const push = (nivel, texto, href) => out.push({ nivel, texto, href });
  for (const e of eventos(d)) {
    const n = diasHasta(e.fecha);
    if (['piso', 'comprador'].includes(e.tipo) && n >= 0 && n <= 2) push(n === 0 ? 'danger' : 'warn', `${e.titulo} · ${n === 0 ? 'hoy' : n === 1 ? 'mañana' : 'pasado mañana'}${e.hora ? ' a las ' + e.hora : ''}`, e.href);
  }
  for (const a of d.agencias) {
    const n = diasHasta(a.fecha_vencimiento);
    if (n !== null && n < 0) push('muted', `El contrato con ${a.nombre} venció el ${fecha(a.fecha_vencimiento)}`, '#/agencia');
    else if (n !== null && n <= 30) push(n <= 7 ? 'danger' : 'warn', `El contrato con ${a.nombre} vence en ${n} días${a.prorroga_automatica ? ' (se prorroga solo si no avisas)' : ''}`, '#/agencia');
  }
  for (const x of d.documentos) {
    if (x.estado === 'no_aplica') continue;
    const n = diasHasta(x.fecha_caducidad);
    if (n !== null && n < 0) push('danger', `Caducado: ${x.nombre}`, '#/notaria');
    else if (n !== null && n <= 30) push('warn', `${x.nombre} caduca en ${n} días`, '#/notaria');
  }
  const fv = d.operacion?.fecha_firma_venta;
  if (fv) {
    const n = diasHasta(fv);
    const pend = d.documentos.filter((x) => x.operacion === 'venta' && x.obligatorio && !['obtenido', 'entregado', 'no_aplica'].includes(x.estado)).length;
    if (n >= 0 && n <= 30 && pend) push('danger', `Faltan ${pend} documentos obligatorios y la firma de la venta es en ${n} días`, '#/notaria');
  }
  const sumPend = d.suministros.filter((s) => s.estado.startsWith('pendiente')).length;
  if (sumPend) push('info', `${sumPend} suministro${sumPend > 1 ? 's' : ''} pendiente${sumPend > 1 ? 's' : ''} de gestionar`, '#/suministros');
  const orden = { danger: 0, warn: 1, info: 2, muted: 3 };
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

// ---------- Cálculos fiscales ----------
export function comisionAgencia(a, precio) {
  if (!a || !a.comision_valor) return 0;
  let c = a.tipo_comision === 'porcentaje' ? (Number(precio) || 0) * a.comision_valor / 100 : Number(a.comision_valor);
  if (!a.iva_incluido) c *= 1.21;
  return c;
}

export function aniosCompletos(desde, hasta) {
  if (!desde) return null;
  const a = new Date(desde + 'T00:00:00'), b = new Date((hasta || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
  let y = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
  return Math.max(0, y);
}

export function edadEn(nac, en) { return nac ? aniosCompletos(nac, en) : null; }

export function cuotaAhorro(base, tramos) {
  let resto = Math.max(0, base), prev = 0, cuota = 0;
  for (const [hasta, tipo] of tramos) {
    const lim = hasta === null ? Infinity : hasta;
    const tramo = Math.min(resto, lim - prev);
    if (tramo <= 0) break;
    cuota += tramo * tipo / 100; resto -= tramo; prev = lim;
  }
  return cuota;
}

export function plusvalia(o, p, precioVenta) {
  const coefs = p.plusvalia_coeficientes || [];
  const tipo = Number(p.plusvalia_tipo ?? 20);
  const red = Number(p.plusvalia_reduccion_suelo ?? 0);
  const anios = aniosCompletos(o.fecha_adquisicion, o.fecha_firma_venta);
  const suelo = Number(o.valor_catastral_suelo) || 0;
  const sueloAj = suelo * (1 - red / 100);
  const coef = anios === null ? null : coefs[Math.min(anios, 20)];
  const baseObj = coef == null ? null : sueloAj * coef;
  // Método real: ganancia × (valor suelo / valor catastral total)
  const venta = Number(precioVenta) || 0, compra = Number(o.precio_adquisicion) || 0;
  const vct = Number(o.valor_catastral_total) || 0;
  const ganancia = venta - compra;
  const proporcion = vct > 0 ? suelo / vct : null;
  const baseReal = proporcion === null || !compra || !venta ? null : Math.max(0, ganancia * proporcion);
  const sinIncremento = compra > 0 && venta > 0 && ganancia <= 0;
  const bases = [baseObj, baseReal].filter((x) => x !== null);
  const base = sinIncremento ? 0 : bases.length ? Math.min(...bases) : null;
  return { anios, coef, tipo, baseObj, baseReal, proporcion, base, cuota: base === null ? null : base * tipo / 100, sinIncremento, metodo: base === null ? null : sinIncremento ? 'no_sujeta' : baseReal !== null && baseReal <= (baseObj ?? Infinity) ? 'real' : 'objetivo' };
}

export function irpfVenta(d, precioVenta, comision, cuotaPlusvalia) {
  const o = d.operacion || {};
  const tramos = d.parametros.irpf_ahorro_tramos || [[6000, 19], [50000, 21], [200000, 23], [300000, 27], [null, 30]];
  const valorTransmision = (Number(precioVenta) || 0) - (Number(comision) || 0) - (Number(cuotaPlusvalia) || 0) - (Number(o.gastos_venta) || 0);
  const valorAdquisicion = (Number(o.precio_adquisicion) || 0) + (Number(o.gastos_adquisicion) || 0) + (Number(o.mejoras) || 0);
  const ganancia = valorTransmision - valorAdquisicion;
  const fechaRef = o.fecha_firma_venta || new Date().toISOString().slice(0, 10);
  const titulares = (d.titulares.length ? d.titulares : []).map((t) => {
    const edad = edadEn(t.fecha_nacimiento, fechaRef);
    const exento = (edad !== null && edad >= 65 && t.vivienda_habitual) || (t.dependencia && t.vivienda_habitual);
    const parte = ganancia * (Number(t.porcentaje) || 0) / 100;
    const cuota = exento || parte <= 0 ? 0 : cuotaAhorro(parte, tramos);
    return { ...t, edad, exento, parte, cuota, dudoso: edad === null };
  });
  return { valorTransmision, valorAdquisicion, ganancia, titulares, total: titulares.reduce((s, t) => s + t.cuota, 0) };
}

export function costesCompra(d, precio) {
  const p = d.parametros; const o = d.operacion || {};
  const P = Number(precio) || 0;
  const nueva = !!o.compra_obra_nueva;
  const itp = nueva ? 0 : P * Number(p.itp_general ?? 6) / 100;
  const iva = nueva ? P * Number(p.iva_obra_nueva ?? 10) / 100 : 0;
  const ajd = nueva ? P * Number(p.ajd_madrid ?? 0.75) / 100 : 0;
  const notaria = P * Number(p.gastos_notaria_registro_pct ?? 1) / 100;
  return { nueva, itp, iva, ajd, notaria, total: itp + iva + ajd + notaria };
}

export const resumenMoney = money;

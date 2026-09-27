import { h, icon, money, fecha, relativo, diasHasta, kpi, progress, hoyISO } from '../ui.js';
import { cargarTodo, eventos, alertas, comisionAgencia, plusvalia, irpfVenta, costesCompra } from '../datos.js';

const ICO = { piso: 'house', comprador: 'user', agencia: 'handshake', documento: 'file-text', suministro: 'plug-zap', reforma: 'hammer', tarea: 'list-checks', notaria: 'stamp', evento: 'calendar' };

export async function render(el) {
  const d = await cargarTodo();
  const o = d.operacion;
  const activos = d.pisos.filter((p) => !['descartado'].includes(p.estado));
  const visitados = d.pisos.filter((p) => ['visitado', 'en_oferta', 'favorito', 'comprado'].includes(p.estado) || d.visitas_pisos.some((v) => v.piso_id === p.id));
  const interesados = d.compradores.filter((c) => ['interesado', 'muy_interesado'].includes(c.resultado));
  const vivas = d.ofertas.filter((x) => !['rechazada', 'retirada'].includes(x.estado));
  const mejor = vivas.reduce((m, x) => (Number(x.importe) > Number(m?.importe || 0) ? x : m), null);
  const docs = d.documentos.filter((x) => x.estado !== 'no_aplica');
  const docsOk = docs.filter((x) => ['obtenido', 'entregado'].includes(x.estado));
  const pctDocs = docs.length ? (docsOk.length / docs.length) * 100 : 0;
  const refEst = d.reformas.reduce((s, r) => s + (Number(r.presupuesto_estimado) || 0), 0);
  const sumNueva = d.suministros.filter((s) => s.vivienda === 'nueva' && s.estado !== 'de_baja').reduce((s, x) => s + (Number(x.importe_mensual) || 0), 0);
  const hoy = hoyISO();
  const proxPiso = eventos(d).find((e) => e.tipo === 'piso' && e.fecha >= hoy);
  const proxComp = eventos(d).find((e) => e.tipo === 'comprador' && e.fecha >= hoy);

  // Balance previsto
  const precioVenta = Number(o.precio_venta_previsto) || Number(mejor?.importe) || 0;
  const agencia = d.agencias[0];
  const com = comisionAgencia(agencia, precioVenta);
  const plus = plusvalia(o, d.parametros, precioVenta);
  const irpf = irpfVenta(d, precioVenta, com, plus.cuota || 0);
  const neto = precioVenta - com - (plus.cuota || 0) - irpf.total - (Number(o.gastos_venta) || 0) - (Number(o.hipoteca_pendiente) || 0);
  const precioCompra = Number(o.precio_compra_previsto) || 0;
  const cc = costesCompra(d, precioCompra);
  const refAcept = d.reformas.reduce((s, r) => { const el = d.presupuestos.find((p) => p.reforma_id === r.id && p.elegido); return s + (Number(el?.importe) || Number(r.presupuesto_estimado) || 0); }, 0);
  const coste = precioCompra + cc.total + refAcept;

  const al = alertas(d);
  const prox = eventos(d).filter((e) => e.fecha >= hoy).slice(0, 8);

  const saludo = new Date().getHours() < 14 ? 'Buenos días' : new Date().getHours() < 21 ? 'Buenas tardes' : 'Buenas noches';

  el.replaceChildren(
    h('div', { class: 'hero' },
      h('div', {}, h('p', { class: 'eyebrow' }, saludo + ', Marta'), h('h1', {}, 'Ayuda a tus padres en el gran paso'),
        h('p', { class: 'muted' }, 'Venta de su casa en Majadahonda y compra de su nueva vivienda.')),
      h('div', { class: 'hero-actions' },
        h('a', { class: 'btn btn-primary', href: '#/pisos' }, icon('plus'), 'Añadir piso'),
        h('a', { class: 'btn btn-soft', href: '#/venta' }, icon('user-plus'), 'Registrar comprador'))),

    h('section', { class: 'kpis' },
      kpi('Pisos en seguimiento', `${activos.length}`, `${visitados.length} visitados`, 'house', '#/pisos'),
      kpi('Compradores', `${d.compradores.length}`, `${interesados.length} interesados · mejor oferta ${mejor ? money(mejor.importe) : '—'}`, 'users', '#/venta'),
      h('a', { class: 'card kpi kpi-key', href: '#/notaria' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, 'Documentos notaría'), icon('file-check-2')),
        h('div', { class: 'kpi-value' }, `${docsOk.length}/${docs.length}`), progress(pctDocs, pctDocs >= 100 ? 'ok' : ''), h('div', { class: 'kpi-sub' }, `${Math.round(pctDocs)} % listo`)),
      kpi('Reformas', money(refEst), `${d.reformas.length} partidas estimadas`, 'hammer', '#/reformas'),
      kpi('Próxima visita a piso', proxPiso ? fecha(proxPiso.fecha) : '—', proxPiso ? `${relativo(proxPiso.fecha)} · ${proxPiso.titulo.replace('Visita piso: ', '')}` : 'Sin visitas programadas', 'calendar-clock', '#/pisos'),
      kpi('Próxima visita de comprador', proxComp ? fecha(proxComp.fecha) : '—', proxComp ? `${relativo(proxComp.fecha)} · ${proxComp.titulo.replace('Visita comprador: ', '')}` : 'Sin visitas programadas', 'door-open', '#/venta'),
      kpi('Suministros casa nueva', sumNueva ? money(sumNueva) + '/mes' : '—', 'Estimación mensual', 'plug-zap', '#/suministros')),

    h('div', { class: 'grid-2' },
      h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Avisos'), al.length ? h('span', { class: 'badge badge-danger' }, al.length) : null),
        al.length ? h('ul', { class: 'alerts' }, al.map((a) => h('li', { class: 'alert alert-' + a.nivel }, h('a', { href: a.href }, icon(a.nivel === 'danger' ? 'triangle-alert' : a.nivel === 'warn' ? 'clock' : 'info'), h('span', {}, a.texto)))))
          : h('p', { class: 'muted' }, 'Todo en orden. No hay nada urgente ahora mismo.')),
      h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Próximas fechas'), h('a', { class: 'link', href: '#/agenda' }, 'Ver agenda')),
        prox.length ? h('ol', { class: 'timeline' }, prox.map((e) => h('li', { class: diasHasta(e.fecha) <= 2 ? 'soon' : '' },
          h('div', { class: 't-date' }, h('strong', {}, fecha(e.fecha).slice(0, 5)), h('span', {}, e.hora || relativo(e.fecha))),
          h('a', { class: 't-body', href: e.href }, icon(ICO[e.tipo] || 'calendar'), h('span', {}, e.titulo)))))
          : h('p', { class: 'muted' }, 'Cuando añadas visitas, vencimientos o la fecha de firma aparecerán aquí.'))),

    h('section', { class: 'card balance' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Balance previsto de la operación'), h('a', { class: 'link', href: '#/impuestos' }, 'Ver detalle')),
      h('div', { class: 'balance-grid' },
        h('div', {}, h('p', { class: 'kpi-label' }, 'Venta neta estimada'), h('p', { class: 'big' }, precioVenta ? money(neto) : '—'),
          h('p', { class: 'small muted' }, precioVenta ? `${money(precioVenta)} − agencia ${money(com)} − plusvalía ${money(plus.cuota)} − IRPF ${money(irpf.total)}` : 'Indica el precio de venta previsto en Ajustes o registra una oferta.')),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Coste total de la compra'), h('p', { class: 'big' }, precioCompra ? money(coste) : '—'),
          h('p', { class: 'small muted' }, precioCompra ? `${money(precioCompra)} + impuestos y gastos ${money(cc.total)} + reformas ${money(refAcept)}` : 'Indica el precio de compra previsto en Ajustes.')),
        h('div', {}, h('p', { class: 'kpi-label' }, 'Diferencia'), h('p', { class: 'big ' + (neto - coste >= 0 ? 'pos' : 'neg') }, precioVenta && precioCompra ? money(neto - coste) : '—'),
          h('p', { class: 'small muted' }, 'Orientativo. Consulta con un asesor fiscal.')))));
}

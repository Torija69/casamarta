import { db } from '../sb.js';
import { h, icon, money, number, fecha, hora, relativo, badge, empty, pageHead, formModal, confirmar, toast, modal, labelOf, exportCSV, refreshIcons, debounce } from '../ui.js';
import { F, OPT, TONO } from '../schema.js';
import { panelAdjuntos, portadas, listar, urlsFirmadas, borrarAdjuntos } from '../files.js';

let filtros = { q: '', estado: 'activos', max: '', orden: 'visita' };
let seleccion = new Set();

export async function render(el, ctx) {
  if (ctx.param) return detalle(el, ctx.param, ctx);
  const [pisos, fotos] = await Promise.all([db.list('pisos'), portadas('pisos')]);

  const nuevo = () => formModal({ title: 'Nuevo piso', fields: F.pisos, onSave: async (v) => { const p = await db.save('pisos', v); toast('Piso guardado'); location.hash = '#/pisos/' + p.id; } });

  const lista = h('div', { class: 'cards-grid' });
  const mapaBox = h('div', { class: 'map', hidden: true, id: 'mapa' });
  const compararBtn = h('button', { class: 'btn btn-soft', disabled: true, onclick: () => comparar(pisos.filter((p) => seleccion.has(p.id)), fotos) }, icon('columns-3'), 'Comparar');

  const pintar = () => {
    let r = pisos.filter((p) => {
      if (filtros.estado === 'activos' && p.estado === 'descartado') return false;
      if (!['activos', 'todos'].includes(filtros.estado) && p.estado !== filtros.estado) return false;
      if (filtros.max && Number(p.precio_pedido) > Number(filtros.max)) return false;
      const q = filtros.q.toLowerCase();
      if (q && ![p.direccion, p.municipio, p.barrio, p.contacto_nombre, p.notas].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    const ord = { visita: (a, b) => (a.fecha_visita || '9999').localeCompare(b.fecha_visita || '9999'), precio: (a, b) => (a.precio_pedido || 0) - (b.precio_pedido || 0),
      m2: (a, b) => (a.precio_pedido / a.metros || 9e9) - (b.precio_pedido / b.metros || 9e9), valoracion: (a, b) => (b.valoracion || 0) - (a.valoracion || 0), reciente: (a, b) => b.created_at.localeCompare(a.created_at) }[filtros.orden];
    r.sort(ord);
    lista.replaceChildren(...(r.length ? r.map((p) => tarjeta(p, fotos)) : [empty('house-plus', pisos.length ? 'Ningún piso con estos filtros' : 'Aún no hay pisos', pisos.length ? 'Prueba a cambiar los filtros.' : 'Añade el primer piso que te interese: dirección, precio, contacto y fecha de visita.', pisos.length ? null : h('button', { class: 'btn btn-primary', onclick: nuevo }, icon('plus'), 'Añadir piso'))]));
    compararBtn.disabled = seleccion.size < 2;
    compararBtn.lastChild.textContent = seleccion.size ? `Comparar (${seleccion.size})` : 'Comparar';
    refreshIcons();
    if (!mapaBox.hidden) pintarMapa(mapaBox, r);
  };

  const tarjeta = (p) => {
    const m2 = p.precio_pedido && p.metros ? p.precio_pedido / p.metros : null;
    const chk = h('input', { type: 'checkbox', 'aria-label': 'Seleccionar para comparar', checked: seleccion.has(p.id), onchange: (e) => {
      if (e.target.checked) { if (seleccion.size >= 3) { e.target.checked = false; toast('Puedes comparar hasta 3 pisos', 'error'); return; } seleccion.add(p.id); } else seleccion.delete(p.id);
      compararBtn.disabled = seleccion.size < 2; compararBtn.lastChild.textContent = seleccion.size ? `Comparar (${seleccion.size})` : 'Comparar';
    } });
    return h('article', { class: 'card piso-card' + (p.estado === 'descartado' ? ' is-muted' : '') },
      h('a', { class: 'piso-foto', href: '#/pisos/' + p.id, 'aria-label': p.direccion },
        fotos.url[p.id] ? h('img', { src: fotos.url[p.id], alt: '', loading: 'lazy' }) : h('div', { class: 'no-foto' }, icon('image')),
        fotos.count[p.id] ? h('span', { class: 'foto-count' }, icon('camera'), fotos.count[p.id]) : null,
        h('span', { class: 'piso-estado' }, badge(labelOf(OPT.estadoPiso, p.estado), TONO[p.estado]))),
      h('div', { class: 'piso-body' },
        h('div', { class: 'row between' }, h('p', { class: 'price' }, money(p.precio_pedido)), h('label', { class: 'cmp' }, chk, h('span', { class: 'small muted' }, 'Comparar'))),
        h('h3', {}, h('a', { href: '#/pisos/' + p.id }, p.direccion)),
        h('p', { class: 'muted small' }, [p.barrio, p.municipio].filter(Boolean).join(' · ')),
        h('ul', { class: 'specs' },
          p.metros ? h('li', {}, icon('ruler'), `${number(p.metros)} m²`) : null,
          p.habitaciones != null ? h('li', {}, icon('bed-double'), p.habitaciones) : null,
          p.banos != null ? h('li', {}, icon('bath'), p.banos) : null,
          m2 ? h('li', {}, `${money(m2)}/m²`) : null),
        p.fecha_visita ? h('p', { class: 'visit' }, icon('calendar-clock'), `Visita ${fecha(p.fecha_visita)} ${hora(p.hora_visita)} · ${relativo(p.fecha_visita)}`) : null,
        p.valoracion ? h('p', { class: 'stars', 'aria-label': `${p.valoracion} de 5` }, '★'.repeat(p.valoracion) + '☆'.repeat(5 - p.valoracion)) : null));
  };

  const buscar = h('input', { type: 'search', placeholder: 'Buscar dirección, barrio, contacto…', value: filtros.q, 'aria-label': 'Buscar', oninput: debounce((e) => { filtros.q = e.target.value; pintar(); }) });
  const selEstado = h('select', { 'aria-label': 'Estado', onchange: (e) => { filtros.estado = e.target.value; pintar(); } },
    [['activos', 'Todos menos descartados'], ['todos', 'Todos'], ...OPT.estadoPiso].map(([v, l]) => h('option', { value: v, selected: filtros.estado === v }, l)));
  const max = h('input', { type: 'number', placeholder: 'Precio máx.', value: filtros.max, 'aria-label': 'Precio máximo', inputmode: 'numeric', oninput: debounce((e) => { filtros.max = e.target.value; pintar(); }) });
  const orden = h('select', { 'aria-label': 'Ordenar', onchange: (e) => { filtros.orden = e.target.value; pintar(); } },
    [['visita', 'Por fecha de visita'], ['precio', 'Por precio'], ['m2', 'Por €/m²'], ['valoracion', 'Por valoración'], ['reciente', 'Más recientes']].map(([v, l]) => h('option', { value: v, selected: filtros.orden === v }, l)));
  const mapaBtn = h('button', { class: 'btn btn-ghost', onclick: () => { mapaBox.hidden = !mapaBox.hidden; mapaBtn.classList.toggle('active', !mapaBox.hidden); pintar(); } }, icon('map'), 'Mapa');

  el.replaceChildren(
    pageHead('Pisos a comprar', `${pisos.filter((p) => p.estado !== 'descartado').length} en seguimiento`,
      h('button', { class: 'btn btn-ghost', onclick: () => exportCSV('pisos', pisos) }, icon('download'), 'CSV'),
      h('button', { class: 'btn btn-primary', onclick: nuevo }, icon('plus'), 'Añadir piso')),
    h('div', { class: 'toolbar' }, buscar, selEstado, max, orden, mapaBtn, compararBtn),
    mapaBox, lista);
  pintar();
}

// ---------- Mapa ----------
function pintarMapa(box, pisos) {
  if (!window.L) { box.textContent = 'No se ha podido cargar el mapa.'; return; }
  if (box._map) { box._map.remove(); }
  const map = L.map(box).setView([40.4735, -3.8722], 13);
  box._map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const pts = pisos.filter((p) => p.lat && p.lng);
  pts.forEach((p) => L.marker([p.lat, p.lng]).addTo(map).bindPopup(`<strong>${p.direccion.replace(/</g, '&lt;')}</strong><br>${money(p.precio_pedido)}<br><a href="#/pisos/${p.id}">Ver ficha</a>`));
  if (pts.length) map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => map.invalidateSize(), 50);
  if (!pts.length) toast('Abre la ficha de un piso y pulsa «Ubicar en el mapa» para verlo aquí');
}

async function geocodificar(p) {
  const q = encodeURIComponent(`${p.direccion}, ${p.municipio || 'Majadahonda'}, España`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, { headers: { 'Accept-Language': 'es' } });
  const j = await r.json();
  if (!j.length) throw new Error('No he encontrado esa dirección en el mapa. Prueba a escribirla más completa.');
  return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
}

// ---------- Comparador ----------
function comparar(ps, fotos) {
  const filas = [
    ['Foto', (p) => fotos.url[p.id] ? h('img', { src: fotos.url[p.id], alt: '', class: 'cmp-img' }) : '—'],
    ['Precio pedido', (p) => money(p.precio_pedido)], ['Nuestra oferta', (p) => money(p.precio_oferta)],
    ['Superficie', (p) => p.metros ? number(p.metros) + ' m²' : '—'], ['€/m²', (p) => p.precio_pedido && p.metros ? money(p.precio_pedido / p.metros) : '—'],
    ['Habitaciones', (p) => p.habitaciones ?? '—'], ['Baños', (p) => p.banos ?? '—'], ['Planta', (p) => p.planta || '—'],
    ['Ascensor', (p) => (p.ascensor ? 'Sí' : 'No')], ['Garaje', (p) => (p.garaje ? 'Sí' : 'No')], ['Trastero', (p) => (p.trastero ? 'Sí' : 'No')], ['Terraza', (p) => (p.terraza ? 'Sí' : 'No')],
    ['Año', (p) => p.anio_construccion || '—'], ['Certificado energético', (p) => p.certificado_energetico || '—'],
    ['Comunidad', (p) => p.gastos_comunidad ? money(p.gastos_comunidad) + '/mes' : '—'], ['IBI', (p) => p.ibi_anual ? money(p.ibi_anual) + '/año' : '—'],
    ['Valoración', (p) => p.valoracion ? '★'.repeat(p.valoracion) : '—'], ['Lo mejor', (p) => p.pros || '—'], ['Lo peor', (p) => p.contras || '—'],
  ];
  const tabla = h('div', { class: 'table-wrap' }, h('table', { class: 'table cmp-table' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ps.map((p) => h('th', {}, h('a', { href: '#/pisos/' + p.id, onclick: () => document.querySelector('.modal-wrap')?.remove() }, p.direccion))))),
    h('tbody', {}, filas.map(([l, f]) => h('tr', {}, h('th', { scope: 'row' }, l), ps.map((p) => h('td', {}, f(p))))))));
  modal({ title: 'Comparativa de pisos', body: tabla, wide: true });
}

// ---------- Detalle ----------
async function detalle(el, id, ctx) {
  const p = await db.get('pisos', id);
  if (!p) { el.replaceChildren(empty('search-x', 'Piso no encontrado', 'Puede que se haya borrado.', h('a', { class: 'btn btn-primary', href: '#/pisos' }, 'Volver'))); return; }
  const visitas = await db.list('visitas_pisos', { eq: { piso_id: id }, order: 'fecha', asc: false });
  const reformas = await db.list('reformas', { eq: { piso_id: id } });
  const recargar = () => detalle(el, id, ctx);
  const editar = () => formModal({ title: 'Editar piso', fields: F.pisos, value: p, onSave: async (v) => { await db.save('pisos', v); toast('Cambios guardados'); recargar(); } });
  const borrarPiso = async () => { if (await confirmar('¿Borrar este piso con sus visitas? También se borrarán sus fotos y documentos.')) { await borrarAdjuntos('pisos', id); await db.remove('pisos', id); toast('Piso borrado'); location.hash = '#/pisos'; } };
  const nuevaVisita = (v = { piso_id: id }) => formModal({ title: v.id ? 'Editar visita' : 'Registrar visita', fields: F.visitas_pisos, value: v, wide: false, onSave: async (x) => {
    await db.save('visitas_pisos', { ...x, piso_id: id });
    if (!v.id && ['interesante', 'visita_programada'].includes(p.estado) && x.fecha <= new Date().toISOString().slice(0, 10)) await db.save('pisos', { id, estado: 'visitado' });
    toast('Visita guardada'); recargar();
  } });
  const ubicar = async (btn) => { btn.disabled = true; try { const c = await geocodificar(p); await db.save('pisos', { id, ...c }); toast('Ubicado en el mapa'); recargar(); } catch (e) { toast(e.message, 'error'); btn.disabled = false; } };
  const m2 = p.precio_pedido && p.metros ? p.precio_pedido / p.metros : null;
  const dato = (l, v) => h('div', { class: 'dato' }, h('dt', {}, l), h('dd', {}, v ?? '—'));
  const selEstado = h('select', { class: 'inline-select', 'aria-label': 'Cambiar estado', onchange: async (e) => { await db.save('pisos', { id, estado: e.target.value }); toast('Estado actualizado'); } },
    OPT.estadoPiso.map(([v, l]) => h('option', { value: v, selected: p.estado === v }, l)));

  el.replaceChildren(
    h('a', { class: 'back', href: '#/pisos' }, icon('arrow-left'), 'Pisos'),
    pageHead(p.direccion, [p.barrio, p.municipio].filter(Boolean).join(' · '),
      h('button', { class: 'btn btn-ghost', onclick: () => fichaPDF(p, visitas) }, icon('file-down'), 'Ficha PDF'),
      h('button', { class: 'btn btn-ghost', onclick: borrarPiso }, icon('trash-2'), 'Borrar'),
      h('button', { class: 'btn btn-primary', onclick: editar }, icon('pencil'), 'Editar')),
    h('div', { class: 'detail-grid' },
      h('div', { class: 'stack' },
        h('section', { class: 'card' },
          h('div', { class: 'row between wrap' }, h('p', { class: 'price big' }, money(p.precio_pedido)), selEstado),
          m2 ? h('p', { class: 'muted' }, `${money(m2)}/m²${p.precio_oferta ? ` · nuestra oferta: ${money(p.precio_oferta)}` : ''}`) : null,
          h('dl', { class: 'datos' },
            dato('Superficie', p.metros ? number(p.metros) + ' m²' : null), dato('Habitaciones', p.habitaciones), dato('Baños', p.banos), dato('Planta', p.planta),
            dato('Extras', [p.ascensor && 'ascensor', p.garaje && 'garaje', p.trastero && 'trastero', p.terraza && 'terraza'].filter(Boolean).join(', ') || null),
            dato('Año', p.anio_construccion), dato('Cert. energético', p.certificado_energetico), dato('Comunidad', p.gastos_comunidad ? money(p.gastos_comunidad) + '/mes' : null),
            dato('IBI', p.ibi_anual ? money(p.ibi_anual) + '/año' : null), dato('Tipo', p.obra_nueva ? 'Obra nueva' : 'Segunda mano'),
            dato('Valoración', p.valoracion ? '★'.repeat(p.valoracion) + '☆'.repeat(5 - p.valoracion) : null)),
          p.enlace_anuncio ? h('p', {}, h('a', { href: p.enlace_anuncio, target: '_blank', rel: 'noopener', class: 'link' }, icon('external-link'), 'Ver anuncio')) : null,
          p.pros || p.contras ? h('div', { class: 'grid-2 tight' }, h('div', { class: 'pros' }, h('h3', {}, 'Lo mejor'), h('p', {}, p.pros || '—')), h('div', { class: 'contras' }, h('h3', {}, 'Lo peor'), h('p', {}, p.contras || '—'))) : null,
          p.notas ? h('div', {}, h('h3', {}, 'Notas'), h('p', { class: 'pre' }, p.notas)) : null),
        h('section', { class: 'card' }, panelAdjuntos({ entidad: 'pisos', entidadId: id, bucketFotos: 'fotos-pisos', titulo: 'Fotos de las visitas y documentos' })),
        h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Visitas'), h('button', { class: 'btn btn-soft btn-sm', onclick: () => nuevaVisita() }, icon('plus'), 'Registrar visita')),
          visitas.length ? h('ul', { class: 'list' }, visitas.map((v) => h('li', { class: 'list-item' },
            h('div', {}, h('strong', {}, `${fecha(v.fecha)} ${hora(v.hora)}`), v.asistentes ? h('span', { class: 'muted small' }, ' · ' + v.asistentes) : null, v.impresiones ? h('p', { class: 'pre small' }, v.impresiones) : null),
            h('div', { class: 'row' }, h('button', { class: 'btn-icon', 'aria-label': 'Editar visita', onclick: () => nuevaVisita(v) }, icon('pencil')),
              h('button', { class: 'btn-icon', 'aria-label': 'Borrar visita', onclick: async () => { if (await confirmar('¿Borrar esta visita?')) { await db.remove('visitas_pisos', v.id); recargar(); } } }, icon('trash-2'))))))
            : h('p', { class: 'muted' }, 'Registra cada visita con tus impresiones.'))),
      h('aside', { class: 'stack' },
        h('section', { class: 'card' }, h('h2', {}, 'Contacto'),
          h('p', {}, h('strong', {}, p.contacto_nombre || 'Sin nombre')), p.contacto_agencia ? h('p', { class: 'muted' }, p.contacto_agencia) : null,
          p.contacto_telefono ? h('a', { class: 'btn btn-soft btn-block', href: 'tel:' + p.contacto_telefono.replace(/\s/g, '') }, icon('phone'), p.contacto_telefono) : null,
          p.fecha_visita ? h('p', { class: 'visit' }, icon('calendar-clock'), `Próxima visita: ${fecha(p.fecha_visita)} ${hora(p.hora_visita)} (${relativo(p.fecha_visita)})`) : null),
        h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Ubicación'),
          h('button', { class: 'btn btn-soft btn-sm', onclick: (e) => ubicar(e.currentTarget) }, icon('map-pin'), p.lat ? 'Recalcular' : 'Ubicar en el mapa')),
          p.lat ? h('div', { class: 'map small-map', id: 'mini-mapa' }) : h('p', { class: 'muted small' }, 'Busca la dirección en OpenStreetMap para verla en el mapa.')),
        h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Reformas previstas'), h('a', { class: 'link', href: '#/reformas' }, 'Reformas')),
          reformas.length ? h('ul', { class: 'list compact' }, reformas.map((r) => h('li', {}, r.titulo, h('span', { class: 'muted' }, ' · ' + money(r.presupuesto_estimado))))) : h('p', { class: 'muted small' }, 'Puedes vincular reformas a este piso desde la sección Reformas.')))));
  refreshIcons();
  if (p.lat && window.L) {
    const box = document.getElementById('mini-mapa');
    const map = L.map(box, { scrollWheelZoom: false }).setView([p.lat, p.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    L.marker([p.lat, p.lng]).addTo(map);
  }
}

// ---------- Ficha PDF ----------
async function fichaPDF(p, visitas) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('No se ha podido cargar el generador de PDF', 'error'); return; }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(p.direccion, 15, y, { maxWidth: 180 }); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(110);
  doc.text([p.barrio, p.municipio].filter(Boolean).join(' · ') + `   ·   ${labelOf(OPT.estadoPiso, p.estado)}`, 15, y); y += 10;
  doc.setTextColor(30);
  try {
    const fotos = (await listar('pisos', p.id)).filter((a) => a.tipo === 'foto').slice(0, 2);
    const urls = await urlsFirmadas(fotos);
    let x = 15;
    for (const f of fotos) {
      const data = await fetch(urls[f.id]).then((r) => r.blob()).then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }));
      doc.addImage(data, 'JPEG', x, y, 87, 58, undefined, 'FAST'); x += 93;
    }
    if (fotos.length) y += 64;
  } catch { /* sin fotos */ }
  const m2 = p.precio_pedido && p.metros ? p.precio_pedido / p.metros : null;
  const filas = [['Precio pedido', money(p.precio_pedido)], ['Nuestra oferta', money(p.precio_oferta)], ['€/m²', m2 ? money(m2) : '—'], ['Superficie', p.metros ? number(p.metros) + ' m²' : '—'],
    ['Habitaciones / baños', `${p.habitaciones ?? '—'} / ${p.banos ?? '—'}`], ['Planta', p.planta || '—'],
    ['Extras', [p.ascensor && 'ascensor', p.garaje && 'garaje', p.trastero && 'trastero', p.terraza && 'terraza'].filter(Boolean).join(', ') || '—'],
    ['Año / Cert. energético', `${p.anio_construccion || '—'} / ${p.certificado_energetico || '—'}`], ['Comunidad / IBI', `${money(p.gastos_comunidad)}/mes · ${money(p.ibi_anual)}/año`],
    ['Contacto', [p.contacto_nombre, p.contacto_telefono, p.contacto_agencia].filter(Boolean).join(' · ') || '—'], ['Valoración', p.valoracion ? `${p.valoracion} de 5` : '—']];
  doc.setFontSize(11);
  for (const [l, v] of filas) { doc.setFont('helvetica', 'bold'); doc.text(l, 15, y); doc.setFont('helvetica', 'normal'); doc.text(String(v), 70, y, { maxWidth: 125 }); y += 7; }
  const bloque = (t, txt) => { if (!txt) return; y += 3; doc.setFont('helvetica', 'bold'); doc.text(t, 15, y); y += 6; doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(txt, 180); doc.text(lines, 15, y); y += lines.length * 5.5; };
  bloque('Lo mejor', p.pros); bloque('Lo peor', p.contras); bloque('Notas', p.notas);
  if (visitas.length) bloque('Visitas', visitas.map((v) => `${fecha(v.fecha)} ${hora(v.hora)}${v.impresiones ? ' — ' + v.impresiones : ''}`).join('\n'));
  doc.setFontSize(9); doc.setTextColor(140); doc.text(`CasaMarta · ${new Date().toLocaleDateString('es-ES')}`, 15, 288);
  doc.save(`ficha-${p.direccion.replace(/[^\w]+/g, '-').slice(0, 40)}.pdf`);
}

// Archivos: subida (con compresión de fotos), listado, miniaturas, visor y borrado.
import { sb, db, traducirError } from './sb.js';
import { h, icon, refreshIcons, toast, modal, confirmar, fecha } from './ui.js';

const esImagen = (mime = '', name = '') => mime.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(name);

async function comprimir(file, max = 1600, calidad = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900_000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}

const limpiar = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);

export async function subir(file, { entidad, entidadId, bucket, descripcion }) {
  const f = await comprimir(file);
  const foto = esImagen(f.type, f.name);
  const path = `${entidad}/${entidadId || 'general'}/${Date.now()}-${limpiar(f.name)}`;
  const { error } = await sb.storage.from(bucket).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error(traducirError(error.message));
  return db.save('archivos', { entidad, entidad_id: entidadId || null, bucket, path, nombre: file.name, mime: f.type, tamano: f.size, tipo: foto ? 'foto' : 'documento', descripcion: descripcion || null });
}

export async function listar(entidad, entidadId) {
  let q = sb.from('archivos').select('*').eq('entidad', entidad).order('created_at', { ascending: true });
  q = entidadId ? q.eq('entidad_id', entidadId) : q.is('entidad_id', null);
  const { data, error } = await q;
  if (error) throw new Error(traducirError(error.message));
  return data || [];
}

export async function urlsFirmadas(archivos, segundos = 3600) {
  const porBucket = {};
  for (const a of archivos) (porBucket[a.bucket] ||= []).push(a);
  const out = {};
  await Promise.all(Object.entries(porBucket).map(async ([bucket, list]) => {
    const { data } = await sb.storage.from(bucket).createSignedUrls(list.map((a) => a.path), segundos);
    (data || []).forEach((d, i) => { if (d.signedUrl) out[list[i].id] = d.signedUrl; });
  }));
  return out;
}

export async function borrar(a) {
  await sb.storage.from(a.bucket).remove([a.path]);
  await db.remove('archivos', a.id);
}

// Borra todos los adjuntos (Storage + registros) de una entidad antes de borrarla
export async function borrarAdjuntos(entidad, entidadId) {
  const lista = await listar(entidad, entidadId);
  const porBucket = {};
  for (const a of lista) (porBucket[a.bucket] ||= []).push(a.path);
  for (const [b, paths] of Object.entries(porBucket)) await sb.storage.from(b).remove(paths);
  for (const a of lista) await db.remove('archivos', a.id);
}

// Primera foto de cada entidad (para miniaturas en listados)
export async function portadas(entidad) {
  const { data } = await sb.from('archivos').select('*').eq('entidad', entidad).eq('tipo', 'foto').order('created_at', { ascending: true });
  const first = {};
  for (const a of data || []) if (a.entidad_id && !first[a.entidad_id]) first[a.entidad_id] = a;
  const urls = await urlsFirmadas(Object.values(first));
  const out = {};
  for (const [id, a] of Object.entries(first)) out[id] = urls[a.id];
  const counts = {};
  for (const a of data || []) counts[a.entidad_id] = (counts[a.entidad_id] || 0) + 1;
  return { url: out, count: counts };
}

export function visor(lista, urls, inicio = 0) {
  let i = inicio;
  const img = h('img', { alt: '' });
  const pie = h('p', { class: 'lb-cap' });
  const pintar = () => { img.src = urls[lista[i].id]; img.alt = lista[i].nombre; pie.textContent = `${i + 1} / ${lista.length} · ${lista[i].nombre}`; };
  const nav = (d) => { i = (i + d + lista.length) % lista.length; pintar(); };
  const body = h('div', { class: 'lightbox' },
    lista.length > 1 ? h('button', { class: 'btn-icon lb-prev', 'aria-label': 'Anterior', onclick: () => nav(-1) }, icon('chevron-left')) : null,
    img,
    lista.length > 1 ? h('button', { class: 'btn-icon lb-next', 'aria-label': 'Siguiente', onclick: () => nav(1) }, icon('chevron-right')) : null,
    pie);
  const m = modal({ title: 'Fotos', body, wide: true });
  const key = (e) => { if (e.key === 'ArrowLeft') nav(-1); if (e.key === 'ArrowRight') nav(1); };
  document.addEventListener('keydown', key);
  const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { document.removeEventListener('keydown', key); obs.disconnect(); } });
  obs.observe(document.body, { childList: true });
  pintar();
}

export function verDocumento(a, url) {
  const esPdf = (a.mime || '').includes('pdf') || /\.pdf$/i.test(a.nombre);
  modal({
    title: a.nombre, wide: true,
    body: esPdf ? h('iframe', { class: 'pdf-frame', src: url, title: a.nombre })
      : esImagen(a.mime, a.nombre) ? h('img', { src: url, alt: a.nombre, class: 'doc-img' })
      : h('p', {}, 'Este tipo de archivo no se puede previsualizar.'),
    actions: [h('a', { class: 'btn btn-primary', href: url, target: '_blank', rel: 'noopener' }, icon('external-link'), 'Abrir / descargar')],
  });
}

// Panel reutilizable de adjuntos
export function panelAdjuntos({ entidad, entidadId, bucketFotos, bucketDocs = 'documentos', titulo = 'Fotos y documentos', soloDocs = false, onChange }) {
  const cont = h('section', { class: 'adjuntos' });
  const grid = h('div', { class: 'thumbs' });
  const docs = h('ul', { class: 'doc-list' });
  const estado = h('p', { class: 'muted small', 'aria-live': 'polite' });

  const inputFoto = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const inputArch = h('input', { type: 'file', multiple: true, accept: soloDocs ? '.pdf,image/*,.doc,.docx,.xls,.xlsx' : 'image/*,.pdf,.doc,.docx,.xls,.xlsx', hidden: true });

  async function manejar(files) {
    const arr = [...files]; if (!arr.length) return;
    let ok = 0;
    for (const [n, f] of arr.entries()) {
      estado.textContent = `Subiendo ${n + 1} de ${arr.length}…`;
      try {
        const bucket = esImagen(f.type, f.name) && bucketFotos ? bucketFotos : bucketDocs;
        await subir(f, { entidad, entidadId, bucket }); ok++;
      } catch (e) { toast(`${f.name}: ${e.message}`, 'error'); }
    }
    estado.textContent = '';
    if (ok) toast(ok === 1 ? 'Archivo subido' : `${ok} archivos subidos`);
    await cargar(); onChange && onChange();
  }
  inputFoto.addEventListener('change', () => manejar(inputFoto.files).then(() => (inputFoto.value = '')));
  inputArch.addEventListener('change', () => manejar(inputArch.files).then(() => (inputArch.value = '')));

  async function cargar() {
    grid.innerHTML = ''; docs.innerHTML = '';
    let lista = [];
    try { lista = await listar(entidad, entidadId); } catch (e) { estado.textContent = e.message; return; }
    const urls = await urlsFirmadas(lista);
    const fotos = lista.filter((a) => a.tipo === 'foto');
    const otros = lista.filter((a) => a.tipo !== 'foto');
    fotos.forEach((a, i) => grid.append(h('div', { class: 'thumb' },
      h('button', { class: 'thumb-btn', 'aria-label': 'Ver ' + a.nombre, onclick: () => visor(fotos, urls, i) }, h('img', { src: urls[a.id], alt: a.nombre, loading: 'lazy' })),
      h('button', { class: 'thumb-del', 'aria-label': 'Borrar foto', onclick: async () => { if (await confirmar('¿Borrar esta foto?')) { await borrar(a); cargar(); onChange && onChange(); } } }, icon('trash-2')))));
    otros.forEach((a) => docs.append(h('li', {},
      h('button', { class: 'doc-link', onclick: () => verDocumento(a, urls[a.id]) }, icon((a.mime || '').includes('pdf') ? 'file-text' : 'file'), h('span', {}, a.nombre)),
      h('span', { class: 'muted small' }, fecha(a.created_at)),
      h('button', { class: 'btn-icon', 'aria-label': 'Borrar ' + a.nombre, onclick: async () => { if (await confirmar(`¿Borrar «${a.nombre}»?`)) { await borrar(a); cargar(); onChange && onChange(); } } }, icon('trash-2')))));
    if (!lista.length) grid.append(h('p', { class: 'muted small' }, soloDocs ? 'Aún no hay documentos.' : 'Aún no hay fotos ni documentos.'));
    refreshIcons();
  }

  cont.append(
    h('div', { class: 'adj-head' }, h('h3', {}, titulo),
      h('div', { class: 'adj-actions' },
        !soloDocs ? h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: () => inputFoto.click() }, icon('camera'), 'Hacer foto') : null,
        h('button', { class: 'btn btn-soft btn-sm', type: 'button', onclick: () => inputArch.click() }, icon('upload'), soloDocs ? 'Subir documento' : 'Subir archivos'))),
    inputFoto, inputArch, estado, grid, docs);
  cargar();
  return cont;
}

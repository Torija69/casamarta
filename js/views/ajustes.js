import { db, sb } from '../sb.js';
import { h, icon, fecha, pageHead, formModal, confirmar, toast, formField, readForm, badge, refreshIcons, download } from '../ui.js';
import { F } from '../schema.js';
import { cargarTodo } from '../datos.js';
import { toggleTema } from '../app.js';

export async function render(el, ctx) {
  const recargar = () => render(el, ctx);
  const { data: { user } } = await sb.auth.getUser();
  const [op, miembros, permitidos, params] = await Promise.all([db.get('operacion', 1), db.list('miembros', { order: 'created_at', asc: true }),
    sb.from('usuarios_permitidos').select('*').order('created_at').then((r) => r.data || []), db.list('parametros', { order: 'clave', asc: true })]);
  const yo = miembros.find((m) => m.user_id === user.id);
  const propietario = yo?.rol === 'propietario';

  // --- Operación ---
  const form = h('form', { class: 'form-grid', novalidate: true }, F.operacion.map((f) => formField(f, op?.[f.k])));
  const guardarOp = async (e) => {
    e.preventDefault();
    try { await db.upsert('operacion', { ...readForm(form, F.operacion), id: 1 }); toast('Datos de la operación guardados'); }
    catch (ex) { toast(ex.message, 'error'); }
  };
  form.addEventListener('submit', guardarOp);
  form.append(h('div', { class: 'full row end' }, h('button', { class: 'btn btn-primary', type: 'submit' }, icon('save'), 'Guardar')));

  // --- Accesos ---
  const accesos = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Personas con acceso'),
      propietario ? h('button', { class: 'btn btn-soft btn-sm', onclick: () => formModal({
        title: 'Dar acceso a una persona', wide: false,
        fields: [{ k: 'email', label: 'Email', type: 'email', req: true, full: true, placeholder: 'marta@ejemplo.com' }, { k: 'nombre', label: 'Nombre', full: true },
          { k: 'rol', label: 'Rol', type: 'select', opts: [['colaborador', 'Colaborador (puede ver y editar todo)'], ['propietario', 'Propietario (además gestiona accesos)']], def: 'colaborador', full: true }],
        extra: h('p', { class: 'small muted' }, 'Después, crea su usuario en Supabase (Authentication → Users → Add user → Create new user, con «Auto Confirm User») usando este mismo email y pásale la contraseña. Podrá cambiarla en Ajustes.'),
        onSave: async (x) => { const { error } = await sb.from('usuarios_permitidos').insert({ ...x, email: x.email.toLowerCase().trim() }); if (error) throw new Error(error.message.includes('duplicate') ? 'Ese email ya tiene acceso.' : error.message); toast('Acceso concedido'); recargar(); },
      }) }, icon('user-plus'), 'Dar acceso') : null),
    h('ul', { class: 'list' }, permitidos.map((p) => {
      const m = miembros.find((x) => x.email === p.email);
      return h('li', { class: 'list-item' },
        h('div', {}, h('strong', {}, p.nombre || p.email), p.nombre ? h('span', { class: 'muted small' }, ' · ' + p.email) : null,
          h('p', { class: 'small muted' }, m ? `Cuenta creada el ${fecha(m.created_at)}` : 'Aún no ha creado su cuenta')),
        h('div', { class: 'row' }, badge(p.rol === 'propietario' ? 'Propietario' : 'Colaborador', p.rol === 'propietario' ? 'accent' : 'neutral'), m ? badge('Activo', 'ok') : badge('Invitado', 'warn'),
          propietario && p.email !== user.email ? h('button', { class: 'btn-icon', 'aria-label': 'Quitar acceso', onclick: async () => {
            if (!(await confirmar(`¿Quitar el acceso a ${p.email}? Si ya tiene cuenta, dejará de poder ver los datos.`, { ok: 'Quitar acceso' }))) return;
            const { error } = await sb.from('usuarios_permitidos').delete().eq('email', p.email);
            if (error) return toast(error.message, 'error');
            if (m) await sb.from('miembros').delete().eq('user_id', m.user_id);
            toast('Acceso retirado'); recargar();
          } }, icon('user-x')) : null));
    })),
    !propietario ? h('p', { class: 'small muted' }, 'Solo un propietario puede dar o quitar accesos.') : null);

  // --- Parámetros ---
  const paramRows = params.map((p) => {
    const ta = h('textarea', { class: 'mono', rows: Array.isArray(p.valor) ? 3 : 1, 'aria-label': p.descripcion || p.clave }, JSON.stringify(p.valor));
    return h('div', { class: 'param' },
      h('div', {}, h('strong', {}, p.descripcion || p.clave), h('p', { class: 'small muted' }, p.clave, p.fuente_url ? [' · ', h('a', { href: p.fuente_url, target: '_blank', rel: 'noopener' }, 'fuente')] : null, ` · ${fecha(p.consultado)}`)),
      ta, h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
        let v; try { v = JSON.parse(ta.value); } catch { toast('Valor no válido. Usa números con punto decimal, p. ej. 6 o 0.75', 'error'); return; }
        const { error } = await sb.from('parametros').update({ valor: v, consultado: new Date().toISOString().slice(0, 10) }).eq('clave', p.clave);
        error ? toast(error.message, 'error') : toast('Parámetro actualizado');
      } }, 'Guardar'));
  });

  // --- Copia de seguridad ---
  const backup = async () => {
    const d = await cargarTodo(); delete d.parametros._rows;
    download(`casamarta-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), 'application/json');
  };

  // --- Cambio de contraseña ---
  const cambiarPass = () => formModal({ title: 'Cambiar contraseña', wide: false, fields: [{ k: 'p', label: 'Nueva contraseña', type: 'password', req: true, full: true, help: 'Mínimo 8 caracteres.' }],
    onSave: async ({ p }) => { if (!p || p.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.'); const { error } = await sb.auth.updateUser({ password: p }); if (error) throw new Error(error.message); toast('Contraseña cambiada'); } });

  el.replaceChildren(
    pageHead('Ajustes', `Has entrado como ${user.email}`),
    h('section', { class: 'card' }, h('h2', {}, 'Datos de la operación'), h('p', { class: 'small muted' }, 'Se usan en los cálculos de impuestos, en el balance del inicio y en la agenda.'), form),
    h('div', { class: 'grid-2' }, accesos,
      h('section', { class: 'card' }, h('h2', {}, 'Tu cuenta'),
        h('div', { class: 'stack tight' },
          h('button', { class: 'btn btn-soft', onclick: toggleTema }, icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'), document.documentElement.dataset.theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'),
          h('button', { class: 'btn btn-soft', onclick: cambiarPass }, icon('key-round'), 'Cambiar contraseña'),
          h('button', { class: 'btn btn-soft', onclick: backup }, icon('database-backup'), 'Descargar copia de seguridad (JSON)'),
          h('button', { class: 'btn btn-ghost', onclick: () => sb.auth.signOut() }, icon('log-out'), 'Cerrar sesión')))),
    h('details', { class: 'card' }, h('summary', {}, h('h2', {}, 'Parámetros fiscales')),
      h('p', { class: 'small muted' }, 'Valores usados en las calculadoras. Cámbialos solo si cambia la normativa (los porcentajes van como número: 6 = 6 %).'),
      h('div', { class: 'stack' }, paramRows)));
  refreshIcons();
}

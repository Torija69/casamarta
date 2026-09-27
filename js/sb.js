import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const fail = (error, ctx) => {
  if (error) {
    console.error(ctx, error);
    throw new Error(traducirError(error.message || String(error)));
  }
};

export function traducirError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Tienes que confirmar tu email antes de entrar (revisa tu correo).';
  if (m.includes('no está autorizado') || m.includes('database error saving new user')) return 'Este email no está autorizado en CasaMarta. Pide a Antonio que lo añada.';
  if (m.includes('already registered')) return 'Ese email ya tiene cuenta. Prueba a iniciar sesión.';
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('row-level security')) return 'No tienes permiso para esta acción.';
  if (m.includes('failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  if (m.includes('payload too large') || m.includes('exceeded the maximum')) return 'El archivo es demasiado grande.';
  if (m.includes('mime type')) return 'Ese tipo de archivo no está permitido aquí.';
  return msg;
}

export const db = {
  async list(table, { order = 'created_at', asc = false, eq = null } = {}) {
    let q = sb.from(table).select('*');
    if (eq) for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    q = q.order(order, { ascending: asc, nullsFirst: false });
    const { data, error } = await q;
    fail(error, table);
    return data || [];
  },
  async get(table, id, key = 'id') {
    const { data, error } = await sb.from(table).select('*').eq(key, id).maybeSingle();
    fail(error, table);
    return data;
  },
  async save(table, row, key = 'id') {
    const clean = { ...row };
    for (const k of ['created_at', 'updated_at', 'created_by']) delete clean[k];
    if (clean[key]) {
      const id = clean[key];
      const { data, error } = await sb.from(table).update(clean).eq(key, id).select().single();
      fail(error, table);
      return data;
    }
    delete clean[key];
    const { data, error } = await sb.from(table).insert(clean).select().single();
    fail(error, table);
    return data;
  },
  async upsert(table, row) {
    const clean = { ...row };
    delete clean.updated_at;
    const { data, error } = await sb.from(table).upsert(clean).select().single();
    fail(error, table);
    return data;
  },
  async remove(table, id, key = 'id') {
    const { error } = await sb.from(table).delete().eq(key, id);
    fail(error, table);
  },
};

import http from 'node:http';
import os from 'node:os';

import {
  createToken,
  generatePatientCode,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  publicUser,
  verifyPassword,
} from './auth.mjs';
import { createDemoPatientState, createEmptyPatientState } from './demo-state.mjs';
import {
  isSupabaseConfigured,
  supabaseQuery,
  usingServiceRole,
} from './supabase.mjs';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SESSION_DAYS = 30;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, 'El contenido enviado es demasiado grande.');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'El cuerpo debe ser JSON válido.');
  }
}

function normalizeText(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

function firstNameOf(name) {
  return String(name).trim().split(/\s+/)[0] || 'Paciente';
}

function assertStateShape(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new HttpError(400, 'El estado del paciente no es válido.');
  }
  if (!Array.isArray(state.treatments) || !Array.isArray(state.doses)) {
    throw new HttpError(400, 'El estado debe incluir tratamientos y dosis.');
  }
  if (!state.profile || typeof state.profile !== 'object') {
    throw new HttpError(400, 'El estado debe incluir el perfil del paciente.');
  }
}

function sanitizePatientState(user, incoming) {
  assertStateShape(incoming);
  const now = new Date().toISOString();
  return {
    ...incoming,
    version: 1,
    role: 'patient',
    roleChosen: true,
    linkedPatientCode: null,
    alarmEnabled: incoming.alarmEnabled !== false,
    profile: {
      ...incoming.profile,
      name: user.name,
      firstName: firstNameOf(user.name),
      caregiverCode: user.patient_code ?? user.patientCode ?? null,
      caregiverName: normalizeText(incoming.profile.caregiverName, 80) || 'Tu cuidador',
      phone: normalizeText(incoming.profile.phone, 40),
    },
    messages: Array.isArray(incoming.messages) ? incoming.messages.slice(-80) : [],
    scanDraft: incoming.scanDraft ?? null,
    lastSyncAt: now,
    toast: null,
  };
}

/**
 * Traduce errores de Supabase a mensajes entendibles y deja el detalle en los
 * logs del servidor para poder diagnosticar desde Render.
 */
function databaseError(error, fallback) {
  const detail = String(error?.message ?? '');
  console.error('[medsync] error de base de datos:', detail || error);
  if (/invalid api key|invalid jwt|no api key|jwt/i.test(detail)) {
    return new HttpError(
      500,
      'El servidor no tiene una clave válida de Supabase. Revisa las variables de entorno.',
    );
  }
  if (/relation .* does not exist|schema cache/i.test(detail)) {
    return new HttpError(
      500,
      'Faltan las tablas en Supabase. Ejecuta el archivo server/schema.sql en el editor SQL.',
    );
  }
  return new HttpError(500, fallback);
}

async function findUserByEmail(email) {
  const { data, error } = await supabaseQuery((client) =>
    client.from('users').select('*').eq('email', email).maybeSingle(),
  );
  if (error) throw databaseError(error, 'Error al buscar usuario.');
  return data ?? null;
}

async function findPatientByCode(code) {
  const normalized = normalizeText(code, 20).toUpperCase();
  const { data, error } = await supabaseQuery((client) =>
    client
      .from('users')
      .select('*')
      .eq('role', 'patient')
      .eq('patient_code', normalized)
      .maybeSingle(),
  );
  if (error) throw databaseError(error, 'Error al buscar paciente.');
  return data ?? null;
}

async function getUserFromSessions(token) {
  const result = await supabaseQuery((client) =>
    client.from('sessions').select('*, users(*)').eq('token', token).maybeSingle(),
  );
  if (result.error) return null;
  if (!result.data) return null;

  const session = result.data;
  if (
    Date.now() - new Date(session.created_at).getTime() >
    SESSION_DAYS * 24 * 60 * 60 * 1000
  ) {
    await supabaseQuery((client) =>
      client.from('sessions').delete().eq('token', token),
    );
    return null;
  }
  return session.users;
}

async function requireUser(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer '))
    throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  const token = header.slice(7).trim();
  const user = await getUserFromSessions(token);
  if (!user)
    throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  return user;
}

async function sessionPayload(user) {
  const payload = { user: publicUser(user), patient: null };
  if (user.role === 'patient') {
    const { data: stateRow } = await supabaseQuery((client) =>
      client
        .from('patient_states')
        .select('state, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    );
    if (stateRow) {
      payload.patient = {
        id: user.id,
        name: user.name,
        code: user.patient_code,
        state: stateRow.state,
        updatedAt: stateRow.updated_at,
      };
    }
  } else if (user.linked_patient_id) {
    const { data: patient } = await supabaseQuery((client) =>
      client
        .from('users')
        .select('*')
        .eq('id', user.linked_patient_id)
        .eq('role', 'patient')
        .maybeSingle(),
    );
    if (patient) {
      const { data: stateRow } = await supabaseQuery((client) =>
        client
          .from('patient_states')
          .select('state, updated_at')
          .eq('user_id', patient.id)
          .maybeSingle(),
      );
      payload.patient = {
        id: patient.id,
        name: patient.name,
        code: patient.patient_code,
        state: stateRow?.state ?? null,
        updatedAt: stateRow?.updated_at ?? patient.updated_at,
      };
    }
  }
  return payload;
}

async function createSessionDb(user) {
  const token = createToken();
  const { error } = await supabaseQuery((client) =>
    client.from('sessions').insert({
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
    }),
  );
  if (error) throw new HttpError(500, 'No se pudo crear la sesión.');

  const { data: sessions } = await supabaseQuery((client) =>
    client
      .from('sessions')
      .select('token, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  );

  if (sessions && sessions.length > 5) {
    const toDelete = sessions.slice(5).map((s) => s.token);
    await supabaseQuery((client) => client.from('sessions').delete().in('token', toDelete));
  }

  return token;
}

async function seedDemoAccounts() {
  try {
    const { data: existing } = await supabaseQuery((client) =>
      client.from('users').select('id').limit(1),
    );
    if (existing && existing.length > 0) return;

    const password = hashPassword('demo1234');
    const now = new Date().toISOString();

    const rosaState = createDemoPatientState('Rosa Martínez', 'MED-4821', 'Diego Martínez');

    const { data: rosa, error: rosaError } = await supabaseQuery((client) =>
      client
        .from('users')
        .insert({
          name: 'Rosa Martínez',
          email: 'rosa@medsync.app',
          role: 'patient',
          patient_code: 'MED-4821',
          linked_patient_id: null,
          password_salt: password.salt,
          password_hash: password.hash,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single(),
    );

    if (rosaError) {
      console.warn('[medsync] No se pudo crear cuenta demo de paciente:', rosaError.message);
      return;
    }

    await supabaseQuery((client) =>
      client.from('patient_states').insert({
        user_id: rosa.id,
        state: rosaState,
        updated_at: now,
      }),
    );

    const diegoPassword = hashPassword('demo1234');
    const { error: diegoError } = await supabaseQuery((client) =>
      client
        .from('users')
        .insert({
          name: 'Diego Martínez',
          email: 'diego@medsync.app',
          role: 'caregiver',
          patient_code: null,
          linked_patient_id: rosa.id,
          password_salt: diegoPassword.salt,
          password_hash: diegoPassword.hash,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single(),
    );

    if (diegoError) {
      console.warn('[medsync] No se pudo crear cuenta demo de cuidador:', diegoError.message);
    }
  } catch (error) {
    console.warn('[medsync] Seed de cuentas demo omitido:', error.message);
  }
}

async function register(body) {
  const name = normalizeText(body.name, 80);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');
  const role = body.role === 'caregiver' ? 'caregiver' : 'patient';

  if (name.length < 2) throw new HttpError(400, 'Escribe tu nombre completo.');
  if (!isValidEmail(email)) throw new HttpError(400, 'Escribe un correo válido.');
  if (password.length < 6) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
  }

  const credentials = hashPassword(password);
  const now = new Date().toISOString();

  const userData = {
    name,
    email,
    role,
    patient_code: null,
    linked_patient_id: null,
    password_salt: credentials.salt,
    password_hash: credentials.hash,
    created_at: now,
    updated_at: now,
  };

  if (role === 'patient') {
    let patientCode = generatePatientCode([]);
    let attempts = 0;
    while (attempts < 10) {
      const existingCode = await findPatientByCode(patientCode);
      if (!existingCode) break;
      patientCode = generatePatientCode([]);
      attempts += 1;
    }
    userData.patient_code = patientCode;

    const { data: user, error } = await supabaseQuery((client) =>
      client.from('users').insert(userData).select().single(),
    );
    if (error) throw new HttpError(500, 'No se pudo registrar el usuario.');

    const emptyState = createEmptyPatientState(
      name,
      patientCode,
      normalizeText(body.caregiverName, 80) || 'Tu cuidador',
    );
    await supabaseQuery((client) =>
      client.from('patient_states').insert({
        user_id: user.id,
        state: emptyState,
        updated_at: now,
      }),
    );

    const token = await createSessionDb(user);
    return { token, ...(await sessionPayload(user)) };
  } else if (body.linkCode) {
    const patient = await findPatientByCode(body.linkCode);
    if (!patient) {
      throw new HttpError(
        404,
        'Ese código no existe. Pídele al paciente su código de vinculación.',
      );
    }
    userData.linked_patient_id = patient.id;

    const { data: user, error } = await supabaseQuery((client) =>
      client.from('users').insert(userData).select().single(),
    );
    if (error) throw new HttpError(500, 'No se pudo registrar el usuario.');

    const token = await createSessionDb(user);
    return { token, ...(await sessionPayload(user)) };
  }

  const { data: user, error } = await supabaseQuery((client) =>
    client.from('users').insert(userData).select().single(),
  );
  if (error) throw new HttpError(500, 'No se pudo registrar el usuario.');

  const token = await createSessionDb(user);
  return { token, ...(await sessionPayload(user)) };
}

async function login(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  const token = await createSessionDb(user);
  return { token, ...(await sessionPayload(user)) };
}

async function logout(req) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    await supabaseQuery((client) => client.from('sessions').delete().eq('token', token));
  }
  return { ok: true };
}

async function route(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  if (method === 'GET' && path === '/api/health') {
    let database = 'not_configured';
    let databaseError = null;
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabaseQuery((client) =>
          client.from('users').select('id', { head: true, count: 'exact' }),
        );
        if (error) {
          database = 'error';
          databaseError = error.message;
        } else {
          database = 'supabase';
        }
      } catch (error) {
        database = 'error';
        databaseError = error.message;
      }
    }
    send(res, 200, {
      ok: true,
      service: 'medsync-ai-backend',
      version: 1,
      time: new Date().toISOString(),
      database,
      key: usingServiceRole() ? 'service_role' : 'anon',
      ...(databaseError ? { databaseError } : {}),
    });
    return;
  }

  if (!isSupabaseConfigured()) {
    send(res, 503, {
      error:
        'El backend no está configurado. Faltan SUPABASE_URL y una clave (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY).',
    });
    return;
  }

  await seedDemoAccounts();

  if (method === 'POST' && path === '/api/auth/register') {
    const body = await readJson(req);
    const result = await register(body);
    send(res, 201, result);
    return;
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await readJson(req);
    const result = await login(body);
    send(res, 200, result);
    return;
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const result = await logout(req);
    send(res, 200, result);
    return;
  }

  if (method === 'GET' && path === '/api/session') {
    const user = await requireUser(req);
    send(res, 200, await sessionPayload(user));
    return;
  }

  if (method === 'GET' && path === '/api/patient/state') {
    const user = await requireUser(req);
    if (user.role !== 'patient') {
      throw new HttpError(403, 'Esta cuenta no es de paciente.');
    }
    const { data: stateRow } = await supabaseQuery((client) =>
      client
        .from('patient_states')
        .select('state, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    );
    send(res, 200, {
      state: stateRow?.state ?? null,
      updatedAt: stateRow?.updated_at ?? user.updated_at,
    });
    return;
  }

  if (method === 'PUT' && path === '/api/patient/state') {
    const user = await requireUser(req);
    if (user.role !== 'patient') {
      throw new HttpError(403, 'Solo el paciente puede actualizar su tratamiento.');
    }
    const body = await readJson(req);
    const state = sanitizePatientState(user, body.state);
    const now = new Date().toISOString();

    const { error } = await supabaseQuery((client) =>
      client
        .from('patient_states')
        .upsert(
          {
            user_id: user.id,
            state,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        ),
    );

    if (error) throw new HttpError(500, 'No se pudo guardar el estado.');

    await supabaseQuery((client) =>
      client.from('users').update({ updated_at: now }).eq('id', user.id),
    );

    send(res, 200, { ok: true, updatedAt: now });
    return;
  }

  if (method === 'GET' && path === '/api/caregiver/patient') {
    const user = await requireUser(req);
    if (user.role !== 'caregiver') {
      throw new HttpError(403, 'Esta cuenta no es de cuidador.');
    }
    if (!user.linked_patient_id) {
      throw new HttpError(404, 'Todavía no tienes un paciente vinculado.');
    }
    const { data: patient } = await supabaseQuery((client) =>
      client
        .from('users')
        .select('*')
        .eq('id', user.linked_patient_id)
        .eq('role', 'patient')
        .maybeSingle(),
    );
    if (!patient) throw new HttpError(404, 'El paciente ya no está disponible.');

    const { data: stateRow } = await supabaseQuery((client) =>
      client
        .from('patient_states')
        .select('state, updated_at')
        .eq('user_id', patient.id)
        .maybeSingle(),
    );

    send(res, 200, {
      patient: {
        id: patient.id,
        name: patient.name,
        code: patient.patient_code,
        state: stateRow?.state ?? null,
        updatedAt: stateRow?.updated_at ?? patient.updated_at,
      },
    });
    return;
  }

  if (method === 'POST' && path === '/api/caregiver/link') {
    const user = await requireUser(req);
    if (user.role !== 'caregiver') {
      throw new HttpError(403, 'Esta cuenta no es de cuidador.');
    }
    const body = await readJson(req);
    const patient = await findPatientByCode(body.code);
    if (!patient) {
      throw new HttpError(404, 'Ese código no coincide con ningún paciente.');
    }
    const now = new Date().toISOString();
    await supabaseQuery((client) =>
      client
        .from('users')
        .update({ linked_patient_id: patient.id, updated_at: now })
        .eq('id', user.id),
    );
    send(res, 200, {
      patient: {
        id: patient.id,
        name: patient.name,
        code: patient.patient_code,
        state: null,
        updatedAt: patient.updated_at,
      },
    });
    return;
  }

  if (method === 'POST' && path === '/api/caregiver/unlink') {
    const user = await requireUser(req);
    if (user.role !== 'caregiver') {
      throw new HttpError(403, 'Esta cuenta no es de cuidador.');
    }
    const now = new Date().toISOString();
    await supabaseQuery((client) =>
      client
        .from('users')
        .update({ linked_patient_id: null, updated_at: now })
        .eq('id', user.id),
    );
    send(res, 200, { ok: true });
    return;
  }

  throw new HttpError(404, 'Ruta no encontrada.');
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { error: error.message });
      return;
    }
    console.error('[medsync] error inesperado:', error);
    send(res, 500, { error: 'Error interno del servidor.' });
  }
});

function localAddresses() {
  const addresses = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) addresses.push(item.address);
    }
  }
  return addresses;
}

server.listen(PORT, HOST, async () => {
  console.log(`MedSync AI backend escuchando en http://localhost:${PORT}`);
  for (const address of localAddresses()) {
    console.log(`  En tu teléfono: http://${address}:${PORT}`);
  }
  console.log('Cuentas demo: rosa@medsync.app / diego@medsync.app · demo1234');

  const anonKey = String(process.env.SUPABASE_ANON_KEY ?? '').trim();
  if (anonKey.startsWith('sbp_')) {
    console.warn(
      'ADVERTENCIA: SUPABASE_ANON_KEY parece un token de administración (sbp_...). ' +
        'Usa la clave anon/service_role del proyecto.',
    );
  }

  if (!isSupabaseConfigured()) {
    console.warn(
      'ADVERTENCIA: SUPABASE_URL y las claves de Supabase no están configuradas.',
    );
    return;
  }

  try {
    const { error } = await supabaseQuery((client) =>
      client.from('users').select('id', { head: true, count: 'exact' }),
    );
    if (error) {
      console.error('Base de datos: ERROR →', error.message);
    } else {
      console.log(
        `Base de datos: Supabase (${usingServiceRole() ? 'service_role' : 'anon'})`,
      );
    }
  } catch (error) {
    console.error('Base de datos: ERROR →', error.message);
  }
});

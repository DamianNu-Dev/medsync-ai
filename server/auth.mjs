import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expected) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actual.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actual, expectedBuffer)
  );
}

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function generatePatientCode(users) {
  const used = new Set(
    users
      .map((user) => user.patientCode)
      .filter((code) => typeof code === 'string')
      .map((code) => code.toUpperCase()),
  );
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = `MED-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    if (!used.has(code)) return code;
  }
  return `MED-${Date.now().toString().slice(-4)}`;
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    patientCode: user.role === 'patient' ? user.patientCode : null,
    linkedPatientId: user.linkedPatientId ?? null,
    createdAt: user.createdAt,
  };
}

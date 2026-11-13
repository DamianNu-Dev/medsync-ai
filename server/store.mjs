import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR =
  process.env.MEDSYNC_DATA_DIR ?? path.join(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'medsync.json');

let cache = null;
let writeChain = Promise.resolve();

function emptyDb() {
  return { version: 1, users: [], sessions: {} };
}

export function readDb() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users) || typeof parsed.sessions !== 'object') {
      cache = emptyDb();
    } else {
      cache = parsed;
    }
  } catch {
    cache = emptyDb();
  }
  return cache;
}

export function writeDb(db) {
  cache = db;
  const snapshot = JSON.stringify(db, null, 2);
  writeChain = writeChain.then(async () => {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.promises.writeFile(tmp, snapshot, 'utf8');
    await fs.promises.rename(tmp, DATA_FILE);
  });
  return writeChain;
}

export function dataFilePath() {
  return DATA_FILE;
}

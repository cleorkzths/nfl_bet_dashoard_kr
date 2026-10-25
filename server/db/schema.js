import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.json');

const defaultData = { parlays: [], legs: [] };

let db = null;

export async function getDb() {
  if (!db) {
    db = await JSONFilePreset(DB_PATH, defaultData);
  }
  return db;
}

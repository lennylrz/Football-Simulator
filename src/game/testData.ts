// Loads public/data from disk for tests and scripts (Node only).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type GameData, loadGameData } from './data';

let cached: Promise<GameData> | null = null;

export function loadTestData(): Promise<GameData> {
  cached ??= loadGameData(async (file) =>
    JSON.parse(await readFile(join(process.cwd(), 'public', 'data', file), 'utf8')),
  );
  return cached;
}

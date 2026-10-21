// Loads public/data from disk for tests and scripts (Node only).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Era, type GameData, loadGameData } from './data';
import { activateEra } from './game';

const cached = new Map<Era, Promise<GameData>>();

/** An era's data, made the current era. */
export async function loadTestData(era: Era = 2015): Promise<GameData> {
  if (!cached.has(era)) {
    cached.set(era, loadGameData(async (file) =>
      JSON.parse(await readFile(join(process.cwd(), 'public', 'data', file), 'utf8')), era));
  }
  const data = await cached.get(era)!;
  activateEra(data);
  return data;
}

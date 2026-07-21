import { LIFE_SAVE_KEY_V3, migrateSaveV2ToV3, validateLifeState } from './life-engine-v3.js';

const deepClone = (value) => structuredClone(value);
export const LIFE_ARCHIVE_LIMIT = 100;
export const LIFE_APP_VERSION = '0.3.0';

export function createEmptySave(options = {}) {
  return {
    schemaVersion: 3,
    appVersion: options.appVersion || LIFE_APP_VERSION,
    savedAt: options.savedAt || new Date(0).toISOString(),
    currentLife: null,
    archives: [],
    achievements: [],
    settings: {
      reducedMotion: false,
      showEffectHints: true,
      confirmReset: true,
      ...(options.settings || {}),
    },
  };
}

function assertIso(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${label}`);
}

export function validateSaveV3(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save)) throw new Error('Save object is required');
  if (save.schemaVersion !== 3) throw new Error('Expected schemaVersion 3 save');
  if (typeof save.appVersion !== 'string') throw new Error('Invalid appVersion');
  assertIso(save.savedAt, 'savedAt');
  if (save.currentLife != null) validateLifeState(save.currentLife);
  if (!Array.isArray(save.archives) || save.archives.length > LIFE_ARCHIVE_LIMIT) throw new Error('Invalid archives');
  if (!Array.isArray(save.achievements) || new Set(save.achievements).size !== save.achievements.length) throw new Error('Invalid achievements');
  if (!save.settings || ['reducedMotion','showEffectHints','confirmReset'].some((key) => typeof save.settings[key] !== 'boolean')) throw new Error('Invalid settings');
  for (const archive of save.archives) {
    if (!archive?.lifeId || !archive.name || !archive.endingId) throw new Error('Invalid archive record');
    if (!Number.isInteger(archive.ageYears) || archive.ageYears < 0) throw new Error('Invalid archive age');
    if (!Number.isInteger(archive.score) || archive.score < 0 || archive.score > 100) throw new Error('Invalid archive score');
    assertIso(archive.endedAt, 'archive endedAt');
    if (archive.snapshot) validateLifeState(archive.snapshot);
  }
  return true;
}

export function normalizeSave(input) {
  if (!input || typeof input !== 'object') throw new Error('Save input is required');
  const save = input.schemaVersion === 2 ? migrateSaveV2ToV3(input) : deepClone(input);
  validateSaveV3(save);
  return save;
}

export function archiveFinishedLife(save, life, options = {}) {
  validateSaveV3(save);
  if (!life || life.alive !== false || !life.ending) throw new Error('Only a finalized life can be archived');
  const next = deepClone(save);
  const endedAt = options.endedAt || new Date(0).toISOString();
  const record = {
    lifeId: life.id,
    name: life.identity.name,
    ageYears: Math.floor(life.clock.totalWeeks / 52),
    endingId: life.ending.primaryEnding,
    deathCauseId: life.ending.deathCause,
    score: life.ending.lifeScore,
    endedAt,
    summaryTags: [...new Set(life.ending.secondaryTags || [])],
    snapshot: options.includeSnapshot === false ? undefined : deepClone(life),
  };
  next.archives = [record, ...next.archives.filter((item) => item.lifeId !== life.id)].slice(0, LIFE_ARCHIVE_LIMIT);
  next.currentLife = null;
  next.savedAt = endedAt;
  validateSaveV3(next);
  return next;
}

export function setCurrentLife(save, life, savedAt = new Date(0).toISOString()) {
  validateSaveV3(save);
  if (life != null) validateLifeState(life);
  const next = deepClone(save);
  next.currentLife = deepClone(life);
  next.savedAt = savedAt;
  validateSaveV3(next);
  return next;
}

export function unlockAchievements(save, ids, savedAt = new Date(0).toISOString()) {
  validateSaveV3(save);
  const next = deepClone(save);
  next.achievements = [...new Set([...next.achievements, ...(ids || [])])].sort();
  next.savedAt = savedAt;
  validateSaveV3(next);
  return next;
}

export function exportSaveJson(save, space = 2) {
  validateSaveV3(save);
  return JSON.stringify(save, null, space);
}

export function importSaveJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Import text is required');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Invalid save JSON'); }
  return normalizeSave(parsed);
}

export function loadLocalSave(storage, key = LIFE_SAVE_KEY_V3) {
  if (!storage?.getItem) throw new Error('Storage adapter is required');
  const raw = storage.getItem(key);
  return raw == null ? createEmptySave() : importSaveJson(raw);
}

export function persistLocalSave(storage, save, key = LIFE_SAVE_KEY_V3) {
  if (!storage?.setItem) throw new Error('Storage adapter is required');
  const json = exportSaveJson(save, 0);
  storage.setItem(key, json);
  return save;
}

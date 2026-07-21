const getPath = (object, path) => path.split('.').reduce((current, key) => current?.[key], object);

function conditionMatches(context, condition = {}) {
  for (const [path, minimum] of Object.entries(condition.min || {})) {
    if (Number(getPath(context, path) ?? 0) < minimum) return false;
  }
  for (const [path, maximum] of Object.entries(condition.max || {})) {
    if (Number(getPath(context, path) ?? 0) > maximum) return false;
  }
  for (const [path, value] of Object.entries(condition.equals || {})) {
    if (getPath(context, path) !== value) return false;
  }
  for (const [path, required] of Object.entries(condition.includes || {})) {
    const actual = getPath(context, path);
    if (!Array.isArray(actual) || !(required || []).every((item) => actual.includes(item))) return false;
  }
  return true;
}

export function buildAchievementContext(save, finalizedLife = null) {
  const archives = save.archives || [];
  return {
    save: {
      archiveCount: archives.length,
      uniqueEndingCount: new Set(archives.map((item) => item.endingId)).size,
      highestScore: archives.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0),
      achievements: save.achievements || [],
    },
    life: finalizedLife ? {
      ageYears: Math.floor(finalizedLife.clock.totalWeeks / 52),
      endingId: finalizedLife.ending?.primaryEnding,
      deathCauseId: finalizedLife.ending?.deathCause,
      score: finalizedLife.ending?.lifeScore || 0,
      tags: finalizedLife.history.tags || [],
      secondaryTags: finalizedLife.ending?.secondaryTags || [],
      relationshipCount: finalizedLife.relationships.length,
      childrenCount: finalizedLife.identity.childrenCount || 0,
    } : {},
  };
}

export function evaluateAchievements(save, definitions, finalizedLife = null) {
  if (!Array.isArray(definitions)) throw new Error('Achievement definitions are required');
  const context = buildAchievementContext(save, finalizedLife);
  return definitions
    .filter((definition) => definition?.id && conditionMatches(context, definition.conditions))
    .map((definition) => definition.id)
    .filter((id) => !(save.achievements || []).includes(id))
    .sort();
}

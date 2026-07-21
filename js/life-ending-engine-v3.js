const deepClone = (value) => structuredClone(value);
const ageYears = (life) => Math.floor(life.clock.totalWeeks / 52);

function assertKnownMetric(id, metrics) {
  if (!(id in metrics)) throw new Error(`Unknown ending metric: ${id}`);
}

function validateRuleMetrics(rule, metrics) {
  for (const id of Object.keys(rule.conditions?.metricMin || {})) assertKnownMetric(id, metrics);
  for (const id of Object.keys(rule.conditions?.metricMax || {})) assertKnownMetric(id, metrics);
  for (const id of Object.keys(rule.score || {})) assertKnownMetric(id, metrics);
}

function validateEndingMetricReferences(rules, metrics) {
  for (const rule of rules.deathCauses || []) validateRuleMetrics(rule, metrics);
  for (const rule of rules.primaryEndings || []) validateRuleMetrics(rule, metrics);
  for (const rule of rules.secondaryTags || []) validateRuleMetrics(rule, metrics);
  for (const id of Object.keys(rules.lifeScoreWeights || {})) assertKnownMetric(id, metrics);
}

function conditionsMatch(life, metrics, conditions = {}) {
  const age = ageYears(life);
  if (conditions.ageYearsMin != null && age < conditions.ageYearsMin) return false;
  if (conditions.ageYearsMax != null && age > conditions.ageYearsMax) return false;
  if (!(conditions.requiredTags || []).every((tag) => life.history.tags.includes(tag))) return false;
  if (!(conditions.requiredFlags || []).every((flag) => Boolean(life.history.flags[flag]))) return false;
  for (const [id, minimum] of Object.entries(conditions.metricMin || {})) {
    if (metrics[id] < minimum) return false;
  }
  for (const [id, maximum] of Object.entries(conditions.metricMax || {})) {
    if (metrics[id] > maximum) return false;
  }
  return true;
}

function weightedScore(rule, metrics) {
  let score = 0;
  for (const [id, weight] of Object.entries(rule.score || {})) score += metrics[id] * weight;
  return score;
}

function chooseRule(rules, life, metrics) {
  const eligible = rules.filter((rule) => conditionsMatch(life, metrics, rule.conditions));
  if (!eligible.length) throw new Error('No eligible ending rule');
  return eligible.sort((a, b) => {
    const priority = Number(b.priority || 0) - Number(a.priority || 0);
    if (priority) return priority;
    const score = weightedScore(b, metrics) - weightedScore(a, metrics);
    return score || a.id.localeCompare(b.id);
  })[0];
}

export function resolveEnding(life, metrics, rules) {
  if (!rules?.deathCauses || !rules?.primaryEndings) throw new Error('Ending rules are required');
  validateEndingMetricReferences(rules, metrics);
  const deathCause = chooseRule(rules.deathCauses, life, metrics);
  const primary = chooseRule(rules.primaryEndings, life, metrics);
  const secondary = (rules.secondaryTags || [])
    .filter((rule) => conditionsMatch(life, metrics, rule.conditions))
    .map((rule) => rule.id)
    .sort()
    .slice(0, Number(rules.selection?.secondaryTagLimit || 6));
  const lifeScore = Math.round(Object.entries(rules.lifeScoreWeights || {}).reduce((sum, [id, weight]) => sum + metrics[id] * weight, 0));
  return { deathCause: deathCause.id, primaryEnding: primary.id, secondaryTags: secondary, lifeScore, metrics: deepClone(metrics) };
}

export function finalizeLife(life, metrics, rules) {
  const next = deepClone(life);
  next.alive = false;
  next.derivedMetrics = deepClone(metrics);
  next.ending = resolveEnding(next, metrics, rules);
  return next;
}

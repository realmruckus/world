const clamp = (value) => Math.max(0, Math.min(100, value));
const getPath = (object, path) => path.split('.').reduce((current, key) => current?.[key], object);

function tokenize(input) {
  const tokens = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_.]*)|'([^']*)'|([()+\-*/,]))/gy;
  let index = 0;
  while (index < input.length) {
    re.lastIndex = index;
    const match = re.exec(input);
    if (!match) throw new Error(`Invalid metric expression near: ${input.slice(index, index + 20)}`);
    index = re.lastIndex;
    if (match[1] != null) tokens.push({ type: 'number', value: Number(match[1]) });
    else if (match[2] != null) tokens.push({ type: 'identifier', value: match[2] });
    else if (match[3] != null) tokens.push({ type: 'string', value: match[3] });
    else tokens.push({ type: match[4], value: match[4] });
  }
  return tokens;
}

function parser(tokens) {
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = (type) => {
    const token = tokens[cursor];
    if (!token || (type && token.type !== type)) throw new Error(`Expected ${type || 'token'}`);
    cursor += 1;
    return token;
  };
  function primary() {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');
    if (token.type === 'number' || token.type === 'string') return take().value;
    if (token.type === '-') { take('-'); return { op: 'negate', value: primary() }; }
    if (token.type === '(') { take('('); const value = expression(); take(')'); return value; }
    if (token.type === 'identifier') {
      const name = take('identifier').value;
      if (peek()?.type !== '(') return { ref: name };
      take('(');
      const args = [];
      if (peek()?.type !== ')') {
        do { args.push(expression()); } while (peek()?.type === ',' && take(','));
      }
      take(')');
      return { call: name, args };
    }
    throw new Error(`Unexpected token: ${token.type}`);
  }
  function multiplication() {
    let node = primary();
    while (['*','/'].includes(peek()?.type)) node = { op: take().type, left: node, right: primary() };
    return node;
  }
  function expression() {
    let node = multiplication();
    while (['+','-'].includes(peek()?.type)) node = { op: take().type, left: node, right: multiplication() };
    return node;
  }
  const ast = expression();
  if (cursor !== tokens.length) throw new Error('Unexpected trailing metric tokens');
  return ast;
}

const experienceTags = (experiences, tag) => new Set((experiences || []).filter((item) => (item.tags || []).includes(tag)).map((item) => item.id || item.title)).size;
const relationshipsByRole = (relationships, role) => (relationships || []).filter((item) => item.role === role || (role === 'partner' && item.role === 'partner_candidate'));

function functions(state) {
  return {
    clamp: (value) => clamp(value), min: (...values) => Math.min(...values), max: (...values) => Math.max(...values),
    logNormalize: (value, min, max) => max <= min ? 0 : clamp(100 * Math.log1p(Math.max(0, value - min)) / Math.log1p(max - min)),
    countUniqueExperienceTag: (experiences, tag) => experienceTags(experiences, tag),
    meanDimension: (relationships, role, dimension) => { const list = relationshipsByRole(relationships, role); return list.length ? list.reduce((sum, item) => sum + Number(item.dimensions?.[dimension] || 0), 0) / list.length : 0; },
    countRelationshipRuptures: (relationships, role) => relationshipsByRole(relationships, role).filter((item) => ['estranged','broken_up','no_contact'].includes(item.status)).length,
    countRelationships: (relationships, role, status) => relationshipsByRole(relationships, role).filter((item) => item.status === status).length,
    uniqueExperienceTypeRatio: (experiences) => new Set((experiences || []).map((item) => item.type).filter(Boolean)).size / 14,
    uniqueCareerRatio: (timeline) => new Set((timeline || []).map((item) => item.careerId).filter(Boolean)).size / 8,
    uniqueRegionRatio: (timeline) => new Set((timeline || []).map((item) => item.regionId).filter(Boolean)).size / 5,
    uniqueMajorActivityRatio: (experiences) => experienceTags(experiences, 'major_activity') / 10,
    profitableYearsRatio: (timeline) => { const years = (timeline || []).filter((item) => item.timeScale === 'year'); return years.length ? years.filter((item) => Number(item.netIncome || 0) > 0).length / years.length : 0; },
    entrepreneurshipScore: (experiences) => clamp(experienceTags(experiences, 'entrepreneurship_progress') * 12),
    businessAssetScore: (finance) => maxSafeLog(finance?.businessAssets || 0, 5000000),
    profitableBusinessYearsRatio: (timeline) => { const years = (timeline || []).filter((item) => item.timeScale === 'year'); return years.length ? years.filter((item) => Number(item.businessProfit || 0) > 0).length / years.length : 0; },
    reputationFromCreativeWork: (experiences, reputation) => experienceTags(experiences, 'creative_work') ? Number(reputation || 0) : 0,
    publicContributionMagnitude: (experiences) => (experiences || []).reduce((sum, item) => sum + Number(item.contributionMagnitude || 0), 0),
    dependencyPenalty: (relationships, finance) => clamp((relationships || []).reduce((max, item) => Math.max(max, Number(item.dimensions?.dependence || 0)), 0) * 0.6 + (Number(finance?.debt || 0) > Number(finance?.assets || 0) ? 25 : 0)),
  };
}
const maxSafeLog = (value, max) => clamp(100 * Math.log1p(Math.max(0, value)) / Math.log1p(max));

function evaluateAst(ast, state, metrics, registry, visiting) {
  if (typeof ast === 'number' || typeof ast === 'string') return ast;
  if (ast.op === 'negate') return -Number(evaluateAst(ast.value, state, metrics, registry, visiting));
  if (ast.op) {
    const left = Number(evaluateAst(ast.left, state, metrics, registry, visiting));
    const right = Number(evaluateAst(ast.right, state, metrics, registry, visiting));
    if (ast.op === '+') return left + right; if (ast.op === '-') return left - right; if (ast.op === '*') return left * right;
    if (right === 0) throw new Error('Metric division by zero'); return left / right;
  }
  if (ast.ref) {
    if (registry.metrics[ast.ref]) return evaluateMetric(ast.ref, state, metrics, registry, visiting);
    const value = getPath(state, ast.ref);
    if (value === undefined) throw new Error(`Unknown metric reference: ${ast.ref}`);
    return value;
  }
  if (ast.call) {
    const fn = functions(state)[ast.call];
    if (!fn) throw new Error(`Unknown metric function: ${ast.call}`);
    return fn(...ast.args.map((arg) => evaluateAst(arg, state, metrics, registry, visiting)));
  }
  throw new Error('Invalid metric AST');
}

function evaluateMetric(id, state, metrics, registry, visiting) {
  if (metrics[id] != null) return metrics[id];
  if (visiting.has(id)) throw new Error(`Metric dependency cycle: ${id}`);
  const definition = registry.metrics[id];
  if (!definition) throw new Error(`Unknown metric: ${id}`);
  visiting.add(id);
  const value = evaluateAst(parser(tokenize(definition.formula)), state, metrics, registry, visiting);
  visiting.delete(id);
  if (!Number.isFinite(Number(value))) throw new Error(`Metric is not finite: ${id}`);
  metrics[id] = Math.round(clamp(Number(value)));
  return metrics[id];
}

export function calculateDerivedMetrics(state, registry) {
  if (!registry?.metrics) throw new Error('Metric registry is required');
  const metrics = {};
  for (const id of Object.keys(registry.metrics).sort()) evaluateMetric(id, state, metrics, registry, new Set());
  return metrics;
}

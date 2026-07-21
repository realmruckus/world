export function derivedClock(life) {
  const totalWeeks = Number(life?.clock?.totalWeeks || 0);
  return { ageYears: Math.floor(totalWeeks / 52), weekOfYear: totalWeeks % 52 };
}

export function avatarSvg(life) {
  const { ageYears } = derivedClock(life);
  const seed = Number(life?.seed || 0);
  const hue = Math.abs(seed % 360);
  const smarts = Number(life?.mind?.smarts || 0);
  const health = Number(life?.health?.health || 0);
  const hair = ageYears < 12 ? 'M34 40 Q50 18 66 40' : ageYears < 55 ? 'M30 42 Q50 16 70 42' : 'M30 42 Q50 22 70 42';
  const glasses = smarts > 75 ? '<circle cx="42" cy="49" r="7" fill="none" stroke="currentColor"/><circle cx="58" cy="49" r="7" fill="none" stroke="currentColor"/><path d="M49 49h2" stroke="currentColor"/>' : '';
  const mouthY = health < 30 ? 59 : ageYears > 60 ? 64 : 68;
  const name = String(life?.identity?.name || '无名者').replace(/[&<>"']/g, '');
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${name} 的程序生成头像" style="--avatar-hue:${hue}"><rect width="100" height="100" rx="24" fill="hsl(var(--avatar-hue) 45% 86%)"/><circle cx="50" cy="50" r="25" fill="hsl(calc(var(--avatar-hue) + 25) 35% 72%)"/><path d="${hair}" fill="none" stroke="hsl(var(--avatar-hue) 30% 26%)" stroke-width="9" stroke-linecap="round"/><circle cx="42" cy="49" r="2"/><circle cx="58" cy="49" r="2"/>${glasses}<path d="M42 62 Q50 ${mouthY} 58 62" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M25 96 Q50 72 75 96" fill="hsl(calc(var(--avatar-hue) + 160) 40% 45%)"/></svg>`;
}

export function profileView(life) {
  const clock = derivedClock(life);
  return {
    name: life.identity.name,
    ageLabel: life.alive === false ? '人生档案已封存' : `${clock.ageYears} 岁 · 第 ${clock.weekOfYear + 1} 周`,
    stageLabel: life.clock.stage === 'romance' ? '恋爱周阶段' : '年度人生阶段',
    location: life.location?.name || life.identity.region,
    education: life.career.educationId || 'none',
    career: life.career.id || 'none',
    avatar: avatarSvg(life),
  };
}

export function metricRows(life) {
  return [
    ['健康', life.health.health],
    ['快乐', life.mind.happiness],
    ['智慧', life.mind.smarts],
    ['自律', life.mind.discipline],
    ['压力', life.mind.stress],
  ].map(([label, value]) => ({ label, value: Math.round(Number(value || 0)) }));
}

export function timelineRows(life, limit = 30) {
  return [...(life.history.timeline || [])].reverse().slice(0, limit).map((entry) => ({
    time: entry.timeScale === 'week' ? `${Math.floor(entry.atTotalWeeks / 52)}岁 W${entry.atTotalWeeks % 52 + 1}` : `${Math.floor(entry.atTotalWeeks / 52)}岁`,
    title: entry.title,
    summary: entry.summary,
    kind: entry.kind,
  }));
}

export function activeRelationship(life) {
  const id = life.history.flags.activeRomanceRelationshipId;
  return life.relationships.find((item) => item.id === id) || life.relationships.find((item) => ['potential','dating','exclusive','cohabiting','engaged','married','paused'].includes(item.status)) || null;
}

export function eventView(life) {
  const event = life.pendingEvent;
  if (!event) return null;
  return {
    id: event.id,
    type: event.type,
    title: event.narration?.title || event.id,
    description: event.narration?.description || '',
    caption: event.scene?.caption || '',
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label, result: choice.result || '' })),
  };
}
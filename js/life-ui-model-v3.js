const educationNames = {
  none:'尚未入学', preschool:'幼儿阶段', primary_school:'小学阶段', middle_school:'中学阶段', high_school:'高中阶段',
  vocational_school:'职业教育', college:'大学阶段', university:'大学阶段', graduate_school:'研究生阶段', doctorate:'博士阶段', graduated:'已完成学业',
};

const careerNames = {
  none:'尚未工作', student:'在校学习', starter_job:'职场起步', junior_job:'初入职场', mid_career:'事业发展期', senior_job:'资深从业者',
  manager:'管理岗位', executive:'企业高管', entrepreneur:'自主创业', freelancer:'自由职业', unemployed:'待业中', retired:'退休生活',
};

const eventTypeNames = {
  values:'人生选择', wealth:'财富规划', education:'学习成长', career:'职业发展', health:'健康生活', family:'家庭关系',
  social:'人际关系', romance:'感情发展', crisis:'突发状况', opportunity:'人生机会', lifestyle:'生活方式',
};

const surnames = ['赵','钱','孙','李','周','吴','郑','王','冯','陈','褚','卫','蒋','沈','韩','杨','朱','秦','许','何','吕','施','张','孔','曹','严','华','金','魏','陶','姜','谢','邹','苏','潘','杜','叶','程','林','罗','高','郭'];
const givenFirst = ['子','宇','嘉','思','明','安','景','云','泽','书','亦','承','若','知','星','清','梓','雨','昕','锦','文','浩','宁','语','晨','奕','晓','沐','庭','俊'];
const givenSecond = ['涵','然','轩','妍','辰','宁','瑶','川','琪','远','菲','航','悦','桐','熙','诚','萱','阳','琳','哲','岚','睿','佳','彤','博','晴','凡','君','翊','衡'];

function readableId(value, names, fallback) {
  if (!value || value === 'none') return fallback;
  if (names[value]) return names[value];
  return String(value).replaceAll('_', ' ');
}

function level(value, bands) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));
  return bands.find(({ max }) => score <= max)?.label || bands.at(-1).label;
}

function pick(list, seed, offset) {
  const value = Math.abs((Number(seed) * (offset * 2654435761 + 97)) >>> 0);
  return list[value % list.length];
}

export function generatedChineseIdentity(seed) {
  const value = Number(seed) >>> 0;
  const surname = pick(surnames, value, 1);
  const first = pick(givenFirst, value, 2);
  const useTwoGivenNames = value % 5 !== 0;
  const second = useTwoGivenNames ? pick(givenSecond, value, 3) : '';
  return {
    name: `${surname}${first}${second}`,
    gender: value % 2 === 0 ? '女' : '男',
    birthMonth: value % 12 + 1,
    birthDay: Math.floor(value / 12) % 28 + 1,
  };
}

export function zodiacName(month, day) {
  const boundary = [20,19,21,20,21,22,23,23,23,24,23,22];
  const names = ['摩羯座','水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座'];
  const index = Number(day) < boundary[Number(month) - 1] ? Number(month) - 1 : Number(month);
  return names[index] || '未知星座';
}

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
  const identity = life.identity || {};
  const fallback = generatedChineseIdentity(life.seed || 0);
  const birthMonth = Number(identity.birthMonth || fallback.birthMonth);
  const birthDay = Number(identity.birthDay || fallback.birthDay);
  return {
    name: identity.name,
    ageLabel: life.alive === false ? '人生档案已封存' : `${clock.ageYears} 岁 · 第 ${clock.weekOfYear + 1} 周`,
    stageLabel: life.clock.stage === 'romance' ? '恋爱阶段' : '人生阶段',
    location: life.location?.name || identity.region,
    education: readableId(life.career.educationId, educationNames, '尚未入学'),
    career: readableId(life.career.id, careerNames, '尚未工作'),
    gender: identity.gender || fallback.gender,
    zodiac: zodiacName(birthMonth, birthDay),
    birthdayLabel: `${birthMonth}月${birthDay}日`,
    avatar: avatarSvg(life),
  };
}

export function metricRows(life) {
  return [
    { label:'身体', status:level(life.health.health, [{max:24,label:'身体很差'},{max:49,label:'需要休养'},{max:74,label:'状态良好'},{max:100,label:'精力充沛'}]) },
    { label:'心情', status:level(life.mind.happiness, [{max:24,label:'情绪低落'},{max:49,label:'心情一般'},{max:74,label:'心情不错'},{max:100,label:'心情愉快'}]) },
    { label:'思维', status:level(life.mind.smarts, [{max:24,label:'仍在摸索'},{max:49,label:'思路普通'},{max:74,label:'思路清晰'},{max:100,label:'思维敏锐'}]) },
    { label:'习惯', status:level(life.mind.discipline, [{max:24,label:'比较随性'},{max:59,label:'自律一般'},{max:79,label:'做事有序'},{max:100,label:'高度自律'}]) },
    { label:'压力', status:level(life.mind.stress, [{max:24,label:'压力较低'},{max:49,label:'略有压力'},{max:74,label:'压力明显'},{max:100,label:'不堪重负'}]) },
  ];
}

export function timelineRows(life, limit = 30) {
  return [...(life.history.timeline || [])].reverse().slice(0, limit).map((entry) => ({
    time: entry.timeScale === 'week' ? `${Math.floor(entry.atTotalWeeks / 52)}岁 第${entry.atTotalWeeks % 52 + 1}周` : `${Math.floor(entry.atTotalWeeks / 52)}岁`,
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
    type: eventTypeNames[event.type] || readableId(event.type, eventTypeNames, '人生事件'),
    title: event.narration?.title || event.id,
    description: event.narration?.description || '',
    caption: event.scene?.caption || '',
    choices: event.choices.map((choice) => ({ id: choice.id, label: choice.label, result: choice.result || '' })),
  };
}

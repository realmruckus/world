import assert from 'node:assert/strict';
import { applyCommandsAtomic, createLifeStateV3 } from '../js/life-engine-v3.js';

const life = createLifeStateV3({ id:'experience-life', seed:9 });
const command = {
  op:'AppendExperience',
  experience:{ id:'exp_work_growth', type:'career', title:'争取职业成长', tags:['career_growth'] },
};
const first = applyCommandsAtomic(life, [command], { advanceTime:false });
const second = applyCommandsAtomic(first, [command], { advanceTime:false });

assert.equal(second.history.experiences.length, 2);
assert.notEqual(second.history.experiences[0].id, second.history.experiences[1].id);
assert.equal(second.history.experiences[0].definitionId, 'exp_work_growth');
assert.equal(second.history.experiences[1].definitionId, 'exp_work_growth');
assert.equal(new Set(second.history.experiences.map((item) => item.id)).size, 2);

console.log('\n1/1 tests passed');

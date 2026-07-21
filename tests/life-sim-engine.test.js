import test from "node:test";
import assert from "node:assert/strict";
import { advanceYear, calculateLifeScore, chooseWeightedEvent, createPerson, deriveAchievements, eligibleEvents, mulberry32, resolveChoice } from "../js/life-sim-engine.js";

const events = [
  { id: "child", weight: 1, condition: { minAge: 5, maxAge: 10 }, choices: [{ id: "a", label: "A", result: "R", effect: { stats: { smarts: 10 }, money: 50 } }] },
  { id: "adult", weight: 1, condition: { minAge: 18 }, choices: [{ id: "b", label: "B", result: "R", effect: {} }] },
];

test("seeded person generation is deterministic", () => {
  const a = createPerson({ seed: 42, name: "测试" });
  const b = createPerson({ seed: 42, name: "测试" });
  assert.deepEqual(a.stats, b.stats);
});

test("event eligibility respects age", () => {
  const person = createPerson({ seed: 1 });
  person.age = 7;
  assert.deepEqual(eligibleEvents(person, events).map((event) => event.id), ["child"]);
});

test("weighted selection uses supplied random source", () => {
  const person = createPerson({ seed: 1 });
  person.age = 7;
  assert.equal(chooseWeightedEvent(person, events, () => 0).id, "child");
});

test("choice effects are applied and archived", () => {
  const person = createPerson({ seed: 1 });
  person.age = 7;
  const next = resolveChoice(person, events[0], "a");
  assert.equal(next.stats.smarts, Math.min(100, person.stats.smarts + 10));
  assert.equal(next.money, 50);
  assert.equal(next.timeline.length, 1);
});

test("advance year increments age and creates a pending event", () => {
  const person = createPerson({ seed: 5 });
  person.age = 4;
  const next = advanceYear(person, events, mulberry32(9));
  assert.equal(next.age, 5);
  assert.equal(next.pendingEvent.id, "child");
});

test("achievements and score are derived from final state", () => {
  const person = createPerson({ seed: 2 });
  person.age = 85;
  person.money = 1_500_000;
  const achievements = deriveAchievements(person);
  assert.ok(achievements.includes("long-life"));
  assert.ok(achievements.includes("millionaire"));
  assert.ok(calculateLifeScore(person) > 0);
});

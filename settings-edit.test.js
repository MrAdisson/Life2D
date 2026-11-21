import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "./settings.js";
import {
  addType,
  getRule,
  removeType,
  setCount,
  setFriction,
  setRange,
  setRule,
} from "./settings-edit.js";

const fresh = () => structuredClone(defaultSettings);

test("setRule borne la règle à [-1, 1]", () => {
  const s = fresh();
  setRule(s, "red", "blue", 0.5);
  assert.equal(s.rules.red.blue, 0.5);
  setRule(s, "red", "blue", 7);
  assert.equal(s.rules.red.blue, 1);
  assert.equal(getRule(s, "blue", "nope"), 0);
});

test("setCount, setRange, setFriction", () => {
  const s = fresh();
  setCount(s, "red", "12.7");
  assert.equal(s.types[0].count, 12);
  setCount(s, "red", -3);
  assert.equal(s.types[0].count, 0);
  setRange(s, "40");
  assert.equal(s.range, 40);
  setRange(s, "");
  assert.equal(s.range, Infinity);
  setFriction(s, 5);
  assert.equal(s.friction, 1);
  setFriction(s, 0);
  assert.equal(s.friction, 0);
});

test("ajouter un type : règles à 0, nom unique", () => {
  const s = fresh();
  assert.deepEqual(
    addType(s, { name: "gold", color: "gold", count: 10, mass: 3 }),
    { ok: true },
  );
  assert.equal(s.types.length, 5);
  for (const t of s.types) {
    assert.equal(s.rules.gold[t.name], 0);
    assert.equal(s.rules[t.name].gold, 0);
  }
  assert.equal(s.rules.red.blue, 1); // règles existantes inchangées
  assert.equal(addType(s, { name: "gold", color: "x", count: 1, mass: 1 }).ok, false);
  assert.equal(addType(s, { name: " ", color: "x", count: 1, mass: 1 }).ok, false);
  assert.equal(addType(s, { name: "z", color: "x", count: 1, mass: 0 }).ok, false);
  assert.equal(s.types.length, 5);
});

test("retirer un type supprime ses règles et celles qui le citent", () => {
  const s = fresh();
  removeType(s, "blue");
  assert.deepEqual(s.types.map((t) => t.name), ["red", "green", "white"]);
  assert.equal("blue" in s.rules, false);
  for (const row of Object.values(s.rules)) assert.equal("blue" in row, false);
  assert.equal(s.rules.red.green, -1);
});

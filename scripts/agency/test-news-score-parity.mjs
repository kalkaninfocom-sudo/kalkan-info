#!/usr/bin/env node
/**
 * G7 parity test -- newsScore without boost MUST equal old output.
 * Run: node scripts/agency/test-news-score-parity.mjs
 */
import { newsScore } from '../../lib/news-score.mjs';

let pass = 0, fail = 0;
const assert = (desc, got, expected) => {
  if (got === expected) { console.log(`  OK  ${desc}`); pass++; }
  else { console.error(`  FAIL ${desc}: got ${got}, expected ${expected}`); fail++; }
};

// Reference scores computed manually against original newsScore logic
// (no boost param -- must be identical to pre-G7 behavior)
// opts: useTags=false, featuredBonus=false, srcPenalty=-4  (gazete-editorial defaults)
const cases = [
  // Kalkan local source, Turizm: +3(core)+2(kalkan)+3(src)+2(cat) = 10
  { it: { title: "Kalkan'da turizm zirvesi", summary: '', source: 'kalkan-haber', category: 'Turizm' }, expected: 10 },
  // National source, no core: srcPenalty -4 + Plaj +2 = -2
  { it: { title: 'Yaz tatili rehberi', summary: 'Turkiye geneli', source: 'Anadolu Ajansi', category: 'Plaj' }, expected: -2 },
  // Antalya only (no core), Gundem: -4(antalya) + srcPenalty -4 + 0(cat) = -8
  { it: { title: 'Antalya belediyesi karari', summary: '', source: 'Milliyet', category: 'Gundem' }, expected: -8 },
  // Kas (ASCII, no Turkish s-cedilla) does NOT match core rx -> no core bonus. antalya-haber src +1, Etkinlik +2 = 3
  { it: { title: 'Kas festivali basliyor', summary: '', source: 'antalya-haber', category: 'Etkinlik' }, expected: 3 },
  // Kalkan in title: core+3, kalkan+2, CNN Turk srcPenalty-4. 'Asayis' (ASCII) not in TOURIST_CATS -> 0. total=1
  { it: { title: 'Kalkan asayis olayi', summary: '', source: 'CNN Turk', category: 'Asayis' }, expected: 1 },
];

console.log('\n-- Parity test: newsScore (no boost) --');
for (const { it, expected } of cases) {
  const got = newsScore(it, { useTags: false, featuredBonus: false, srcPenalty: -4 });
  assert(it.title, got, expected);
}

// boost=null must be identical to no boost param
console.log('\n-- boost=null vs no boost --');
for (const { it } of cases) {
  const withoutBoost = newsScore(it, { useTags: false, featuredBonus: false, srcPenalty: -4 });
  const withNullBoost = newsScore(it, { useTags: false, featuredBonus: false, srcPenalty: -4, boost: null });
  assert(`null parity: "${it.title.slice(0, 35)}"`, withNullBoost, withoutBoost);
}

// boost=empty Map must also be identical
console.log('\n-- boost=empty Map vs no boost --');
for (const { it } of cases) {
  const withoutBoost = newsScore(it, { useTags: false, featuredBonus: false, srcPenalty: -4 });
  const withEmptyBoost = newsScore(it, { useTags: false, featuredBonus: false, srcPenalty: -4, boost: new Map() });
  assert(`emptyMap parity: "${it.title.slice(0, 35)}"`, withEmptyBoost, withoutBoost);
}

// Verify boost actually nudges score when keyword matches
console.log('\n-- boost adds bounded bonus when keyword matches --');
const item = { title: 'Kas festival basliyor', summary: '', source: 'antalya-haber', category: 'Etkinlik' };
const opts = { useTags: false, featuredBonus: false, srcPenalty: -4 };
const baseScore = newsScore(item, opts);
const boostMap = new Map([['festival', 1], ['kas', 1], ['muzik', 2]]);
const boostedScore = newsScore(item, { ...opts, boost: boostMap });
assert('boost adds bonus (boosted > base)', boostedScore > baseScore, true);
assert('boost bonus <= 3', boostedScore - baseScore <= 3, true);

// Verify cap: even when matched keywords sum >3, result is capped at +3
const bigBoost = new Map([['festival', 2], ['basliyor', 2], ['kas', 2]]);
const cappedScore = newsScore(item, { ...opts, boost: bigBoost });
assert('cap: delta > 3 input still gives delta == 3', cappedScore - baseScore, 3);

// Default call (no opts at all) still works -- backward compat
const defaultScore = newsScore({ title: 'Kalkan plaji', summary: '', source: 'kalkan-haber', category: 'Plaj' });
assert('default call (no opts) returns number', typeof defaultScore, 'number');

console.log(`\n====  ${pass} passed, ${fail} failed  ====`);
if (fail > 0) process.exit(1);

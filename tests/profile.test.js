import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,normalizeProfile,reward,level} from '../src/profile.js';
import {validateDeck} from '../src/cards.js';
test('wins and losses award real XP and unlock cards at the documented thresholds',()=>{
  let p=freshProfile();assert.equal(level(p),1);assert.ok(!p.unlocked.includes('sniper'));
  p=reward(p,true);assert.equal(p.xp,50);assert.equal(p.games,1);assert.equal(p.wins,1);
  p=reward(p,true);assert.equal(p.xp,100);assert.equal(level(p),2);assert.ok(p.unlocked.includes('sniper'));assert.ok(!p.unlocked.includes('heavy'));
  p=reward(p,false);assert.equal(p.xp,130);assert.equal(p.wins,2);
  p=reward(reward(p,true),false);assert.equal(p.xp,210);assert.ok(p.unlocked.includes('heavy'));assert.equal(level(p),3);
  assert.equal(validateDeck(p.deck,p.unlocked),null);
});
test('corrupt or manipulated storage cannot inject unknown or locked cards or invalid counts',()=>{
  const p=normalizeProfile({xp:-1,games:'99',wins:NaN,deck:['not-a-card'],unlocked:['heavy'],sound:'yes'});
  assert.equal(p.xp,0);assert.equal(p.games,0);assert.equal(p.wins,0);assert.equal(p.sound,false);assert.ok(!p.unlocked.includes('heavy'));assert.equal(validateDeck(p.deck,p.unlocked),null);
  assert.deepEqual(normalizeProfile(null),freshProfile());
});

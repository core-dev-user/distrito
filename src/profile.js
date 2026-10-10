import { DEFAULT_DECK, STARTER_UNLOCKED, validateDeck } from './cards.js';
export const STORAGE_KEY='distrito.profile.v1';
export function freshProfile() { return {xp:0,games:0,wins:0,unlocked:[...STARTER_UNLOCKED],deck:[...DEFAULT_DECK],sound:false}; }
export function normalizeProfile(value) {
  const p=freshProfile();
  if(!value||typeof value!=='object') return p;
  for(const key of ['xp','games','wins']) if(Number.isSafeInteger(value[key])&&value[key]>=0) p[key]=value[key];
  p.unlocked=[...STARTER_UNLOCKED];if(p.xp>=100) p.unlocked.push('sniper');if(p.xp>=200) p.unlocked.push('heavy');
  if(!validateDeck(value.deck,p.unlocked)) p.deck=[...value.deck];
  p.sound=value.sound===true;return p;
}
export function reward(profile,won) {
  const p=normalizeProfile(profile);p.games++;if(won)p.wins++;p.xp+=won?50:30;
  return normalizeProfile(p);
}
export function level(profile) { return Math.floor(profile.xp/100)+1; }

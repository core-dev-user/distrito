import { findMelds, canMeld, strength, canRaise } from './engine.js';
// Decisions receive a redacted observation, never the opponent's hand or the live state.
export function decide(v, who, rng = Math.random) {
  const p=v.players[who], difficulty=v.difficulty, other=v.players[1-who];
  if(v.turn!==who) return null;
  const agents=p.hand.filter(c=>c.category==='agent');
  if(v.phase==='draw') {
    const top=v.discard.at(-1), useful=top&&findMelds([...p.hand,top]).some(m=>m.includes(top));
    return {type:'draw',source:difficulty!=='easy'&&useful?'discard':'deck'};
  }
  if(v.phase==='prepare') {
    const melds=findMelds(p.hand).filter(m=>canMeld(v,who,m.map(c=>c.uid)));
    if(melds.length && (difficulty!=='easy'||rng()>.35)) {
      melds.sort((a,b)=>a.reduce((n,c)=>n+c.strength,0)-b.reduce((n,c)=>n+c.strength,0));
      return {type:'meld',ids:melds[0].map(c=>c.uid)};
    }
    const candidates=p.hand.filter(c=>c.category!=='agent'||agents.length>3);
    const value=c=>c.category==='agent'?strength(v,who,c)+ (difficulty==='hard'?p.hand.filter(x=>x.role===c.role&&Math.abs(x.rank-c.rank)<=2).length:0):c.strength*1.4+2-c.cost;
    candidates.sort((a,b)=>value(a)-value(b));
    const card=difficulty==='easy'&&rng()<.3?candidates[Math.floor(rng()*candidates.length)]:candidates[0];
    return {type:'discard',uid:card.uid};
  }
  const powers=agents.map(c=>strength(v,who,c)).sort((a,b)=>b-a);
  const confidence=(powers.slice(0,3).reduce((a,b)=>a+b,0)/Math.min(3,powers.length)) + p.wins*1.4-other.wins*1.4;
  if(v.phase==='betResponse') {
    const threshold= difficulty==='easy'?6: v.pendingBet.value>=9?9:7;
    const accepts=confidence>=threshold || rng()<(difficulty==='hard'?.12:.22) || (v.score[1-who]+v.bet>=12);
    return {type:accepts?'accept':'refuse'};
  }
  if(v.phase==='duel') {
    if(canRaise(v,who)&&((confidence>=9&&rng()<.65)||(difficulty==='hard'&&confidence<7&&rng()<.12))) return {type:'raise'};
    const supports=p.hand.filter(c=>c.category!=='agent'&&c.cost<=p.energy);
    const choices=agents.flatMap(agent=>[null,...supports].map(support=>({agent,support,power:strength(v,who,agent,support)})));
    let best;
    if(difficulty==='easy') best=choices[Math.floor(rng()*choices.length)];
    else {
      const known=v.revealed.filter(c=>c.category==='agent');
      const estimated=difficulty==='hard'&&known.length?Math.max(...known.map(c=>strength(v,1-who,c))):other.bonus+7.5+(other.energy>=3?1:0);
      const needed=difficulty==='hard'?estimated:9;
      // Save a high agent when a cheap play is likely to win; spend harder in decisive duels.
      choices.sort((a,b)=> {
        const utility=c=> {
          const tactical=c.support?.id==='jam'?1.4:c.support?.id==='shield'?.4:c.support?.id==='priority'?.8:c.support?.id==='scan'&&v.duel===1?.5:c.support?.id==='reserve'&&v.duel<3&&p.energy<=2?1:0;
          return Math.min(c.power+tactical,needed)*2.8-c.agent.strength*.5-(c.support?.cost||0)*.45-(c.support? .6:0);
        };
        return utility(b)-utility(a);
      });best=choices[0];
    }
    return {type:'play',agent:best.agent.uid,support:best.support?.uid};
  }
  return null;
}

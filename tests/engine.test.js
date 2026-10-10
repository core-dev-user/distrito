import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dispatch, isMeld, findMelds, observe, seededRandom, strength, canMeld, canRaise } from '../src/engine.js';
import { decide } from '../src/ai.js';
import { CARD_BY_ID, DEFAULT_DECK, validateDeck } from '../src/cards.js';
const c=(id,uid=id)=>({...CARD_BY_ID[id],uid});
function ready(seed=1) {
  const s=createGame({seed});
  for(const who of [0,1]) {assert.ok(dispatch(s,who,{type:'draw',source:'deck'}).ok);assert.ok(dispatch(s,who,{type:'discard',uid:s.players[who].hand.at(-1).uid}).ok);}
  return s;
}
function commit(s,ids,supports=[null,null]) {
  for(const who of [s.turn,1-s.turn]) {
    const result=dispatch(s,who,{type:'play',agent:ids[who],support:supports[who]});assert.ok(result.ok,result.error);
  }
}
test('legal deck: copies, ownership, agents and size',()=> {
  assert.equal(validateDeck(DEFAULT_DECK),null);
  assert.match(validateDeck(DEFAULT_DECK.slice(1)),/36/);
  assert.match(validateDeck([...DEFAULT_DECK.slice(3),'duelist-1','duelist-1','duelist-1']),/2 cópias/);
  assert.match(validateDeck(DEFAULT_DECK,[]),/indisponível/);
});
test('melds require unique cards and exact ranks, not arbitrary matching roles',()=>{
  assert.ok(isMeld([c('duelist-1'),c('duelist-2'),c('duelist-3')]));
  assert.ok(isMeld([c('duelist-2'),c('sentinel-2'),c('initiator-2')]));
  assert.ok(!isMeld([c('duelist-1'),c('duelist-3'),c('duelist-5')]));
  assert.ok(!isMeld([c('duelist-1'),c('duelist-1'),c('duelist-1')]));
  assert.ok(!isMeld([c('duelist-1'),c('duelist-2'),c('rifle')]));
});
test('invalid actions do not mutate state, and no out-of-turn moves',()=>{
  const s=createGame({seed:1}), before=JSON.stringify(s);
  for(const [who,action] of [[1,{type:'draw',source:'deck'}],[0,{type:'play',agent:s.players[0].hand[0].uid}],[0,{type:'draw',source:'other'}],[0,{type:'raise'}],[0,{type:'next'}]]) {
    assert.equal(dispatch(s,who,action).ok,false);assert.equal(JSON.stringify(s),before);
  }
  assert.ok(dispatch(s,0,{type:'draw',source:'deck'}).ok);
  assert.equal(dispatch(s,0,{type:'draw',source:'deck'}).ok,false);
});
test('meld costs cards, grants bonus and energy, once per preparation; protects duel reserve',()=>{
  const s=createGame({seed:1});dispatch(s,0,{type:'draw',source:'deck'});
  s.players[0].hand=['duelist-1','duelist-2','duelist-3','sentinel-1','sentinel-2','sentinel-3'].map(id=>c(id));
  assert.ok(dispatch(s,0,{type:'meld',ids:['duelist-1','duelist-2','duelist-3']}).ok);
  assert.equal(s.players[0].energy,4);assert.equal(s.players[0].bonus,2);assert.equal(s.players[0].hand.length,3);
  assert.ok(!canMeld(s,0,['sentinel-1','sentinel-2','sentinel-3']));
  assert.equal(dispatch(s,0,{type:'discard',uid:'sentinel-1'}).ok,false);
});
test('accepted raise changes stake; refusal awards prior stake; cap and alternating raises',()=>{
  const s=ready();assert.ok(dispatch(s,0,{type:'raise'}).ok);assert.equal(s.turn,1);
  assert.ok(dispatch(s,1,{type:'accept'}).ok);assert.equal(s.bet,3);assert.equal(s.turn,0);assert.equal(canRaise(s,0),false);
  commit(s,s.players.map(p=>p.hand.find(c=>c.category==='agent').uid));dispatch(s,0,{type:'next'});
  if(s.phase==='duel') {
    assert.ok(dispatch(s,s.turn,{type:'raise'}).ok);const by=s.pendingBet.by;
    assert.ok(dispatch(s,1-by,{type:'refuse'}).ok);assert.equal(s.score[by],3);assert.equal(s.phase,'handEnd');
  }
  const capped=ready();capped.bet=12;assert.equal(canRaise(capped,0),false);
});
test('withdrawal, match end, and postgame actions',()=>{
  const s=ready();s.score[1]=11;assert.ok(dispatch(s,0,{type:'fold'}).ok);
  assert.equal(s.phase,'gameOver');assert.equal(s.winner,1);assert.equal(s.score[1],12);
  assert.equal(dispatch(s,0,{type:'next'}).ok,false);
});
test('simultaneous effects: jam blocked by sentinel or shield; energy validated',()=>{
  const s=ready();s.players[0].hand=[c('duelist-3'),c('jam')];s.players[1].hand=[c('sentinel-3')];
  commit(s,['duelist-3','sentinel-3'],['jam',null]);assert.equal(s.result.power[1],6);assert.equal(s.players[0].energy,0);
  const b=ready();b.players[0].hand=[c('duelist-3'),c('jam')];b.players[1].hand=[c('controller-3'),c('shield')];
  commit(b,['duelist-3','controller-3'],['jam','shield']);assert.equal(b.result.power[1],6);
  const d=ready();d.players[0].hand=[c('duelist-3'),c('rifle')];d.players[0].energy=1;
  assert.equal(dispatch(d,0,{type:'play',agent:'duelist-3',support:'rifle'}).ok,false);assert.equal(d.players[0].hand.length,2);
});
test('tie rules: priority, both priority, and equal three duels yield no points',()=>{
  const s=ready();s.players[0].hand=[c('controller-1'),c('priority')];s.players[1].hand=[c('initiator-1')];
  commit(s,['controller-1','initiator-1'],['priority',null]);assert.equal(s.result.winner,0);
  const b=ready();b.players[0].hand=[c('controller-1'),c('priority')];b.players[1].hand=[c('initiator-1'),c('priority')];
  commit(b,['controller-1','initiator-1'],['priority','priority']);assert.equal(b.result.winner,null);
  const t=ready();
  t.players[0].hand=[1,2,3].map(n=>c(`controller-${n}`));t.players[1].hand=[1,2,3].map(n=>c(`initiator-${n}`));
  for(let n=1;n<=3;n++) {commit(t,[`controller-${n}`,`initiator-${n}`]);dispatch(t,0,{type:'next'});}
  assert.equal(t.phase,'handEnd');assert.deepEqual(t.score,[0,0]);
});
test('recon only reveals permitted target; first commitment stays hidden',()=>{
  const s=ready();s.players[0].hand=[c('controller-2'),c('scan')];s.players[1].hand=[c('duelist-1'),c('sentinel-5')];
  dispatch(s,0,{type:'play',agent:'controller-2',support:'scan'});
  const ai=observe(s,1);assert.equal(ai.players[0].hand,undefined);assert.deepEqual(ai.played[0],{hidden:true});assert.equal(ai.deck,undefined);assert.equal(ai.rng,undefined);assert.equal(ai.seed,undefined);
  assert.equal(observe(s,0).revealed[0].id,'sentinel-5');
  dispatch(s,1,{type:'play',agent:'duelist-1'});assert.equal(observe(s,0).played[1].agent.id,'duelist-1');
});
test('empty deck recycles discard, preserving its top; empty piles reject safely',()=>{
  const s=createGame({seed:1});s.deck=[];s.discard=[c('sidearm'),c('rifle'),c('jam')];
  assert.ok(dispatch(s,0,{type:'draw',source:'deck'}).ok);assert.equal(s.deck.length,1);assert.equal(s.discard.at(-1).id,'jam');
  const b=createGame({seed:2});b.deck=[];b.discard=[c('sidearm')];assert.equal(dispatch(b,0,{type:'draw',source:'deck'}).ok,false);
});
test('full games: all AI levels complete legal matches without hidden information',()=>{
  const summaries={};
  for(const difficulty of ['easy','medium','hard']) {
    summaries[difficulty]={games:0,actions:0,melds:0};
    for(let seed=1;seed<=40;seed++) {
      const s=createGame({seed,difficulty}), rng=seededRandom(seed+1000);let steps=0;
      while(s.phase!=='gameOver'&&steps++<2000) {
        if(['duelEnd','handEnd'].includes(s.phase)) assert.ok(dispatch(s,0,{type:'next'}).ok);
        else {
          const who=s.turn, a=decide(observe(s,who),who,rng);assert.ok(a,`No move: ${s.phase}`);
          const result=dispatch(s,who,a);assert.ok(result.ok,`${difficulty} seed ${seed} ${JSON.stringify(a)}: ${result.error}`);
          if(a.type==='meld') summaries[difficulty].melds++;
        }
        for(const p of s.players) {assert.ok(p.energy>=0&&p.energy<=6);assert.ok(p.hand.every(Boolean));}
      }
      assert.equal(s.phase,'gameOver',`${difficulty} seed ${seed} did not finish`);
      assert.ok(s.score[s.winner]>=12);summaries[difficulty].games++;summaries[difficulty].actions+=steps;
    }
  }
  console.log('Completed simulations:',JSON.stringify(summaries));
});

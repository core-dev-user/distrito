import { CARD_BY_ID, DEFAULT_DECK, validateDeck } from './cards.js';
export const BETS = [1, 3, 6, 9, 12];
export const TARGET = 12;
export function seededRandom(seed = Date.now()) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function createGame({ deck = DEFAULT_DECK, difficulty = 'medium', seed = Date.now(), training = false } = {}) {
  const error = validateDeck(deck); if (error) throw new Error(error);
  if (!['easy','medium','hard'].includes(difficulty)) throw new Error('Dificuldade inválida.');
  const s = { deckIds: [...deck], difficulty, seed, rng:seededRandom(seed), training, score:[0,0], handNo:0,
    players:[{name:'Você'}, {name:'Órbita'}], log:[], winner:null, revealed:[[],[]], event:0 };
  deal(s); return s;
}
function log(s, message) { s.log.push(message); s.log = s.log.slice(-30); s.event++; }
function deal(s) {
  s.handNo++; s.deck = shuffle(s.deckIds.map((id,i)=>({...CARD_BY_ID[id],uid:`${s.handNo}-${i}`})),s.rng);
  s.players.forEach(p=>{p.hand=[];p.energy=2;p.melds=[];p.bonus=0;p.wins=0;});
  // Deal at least six agents per player; supports are random. This guarantees three duel agents even after a meld.
  for (const p of s.players) {
    for(let i=0;i<6;i++) { const idx=s.deck.findIndex(c=>c.category==='agent');p.hand.push(s.deck.splice(idx,1)[0]); }
    while(p.hand.length<9) p.hand.push(s.deck.pop());
  }
  s.discard=[s.deck.pop()];s.phase='draw';s.turn=0;s.duel=1;s.bet=1;s.pendingBet=null;s.lastRaiser=null;
  s.played=[null,null];s.result=null;s.melded=false;s.revealed=[[],[]];s.leader=(s.handNo-1)%2;
  log(s,`Operação ${s.handNo}. Compre uma carta para preparar sua mão.`);
}
export function isMeld(cards) {
  if(cards.length!==3 || new Set(cards.map(c=>c.uid)).size!==3 || cards.some(c=>c.category!=='agent')) return false;
  const triplet=cards.every(c=>c.rank===cards[0].rank) && new Set(cards.map(c=>c.role)).size===3;
  const ranks=cards.map(c=>c.rank).sort((a,b)=>a-b);
  const run=cards.every(c=>c.role===cards[0].role) && ranks[1]===ranks[0]+1 && ranks[2]===ranks[1]+1;
  return triplet || run;
}
export function findMelds(hand) {
  const a=hand.filter(c=>c.category==='agent'), result=[];
  for(let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++) for(let k=j+1;k<a.length;k++) if(isMeld([a[i],a[j],a[k]])) result.push([a[i],a[j],a[k]]);
  return result;
}
function getCards(p, ids) { return ids.map(id=>p.hand.find(c=>c.uid===id)); }
export function canMeld(s, who, ids) {
  if(s.phase!=='prepare'||s.turn!==who||s.melded||!Array.isArray(ids)) return false;
  const cards=getCards(s.players[who],ids);
  return cards.every(Boolean) && isMeld(cards) && s.players[who].hand.filter(c=>c.category==='agent'&&!ids.includes(c.uid)).length>=3;
}
export function supportBonus(s,who,agent,support) {
  if(!support) return 0;
  switch(support.id) {
    case 'sidearm': return 2+(agent.rank<=2?1:0);
    case 'smg': return 2+(agent.role==='duelist'?1:0);
    case 'shotgun': return 2+(s.duel===1?2:0);
    case 'sniper': return 2+(agent.rank>=4?3:0);
    case 'heavy': return 3+(agent.role==='sentinel'?1:0);
    case 'bluff': return agent.rank<=2?3:-1;
    case 'ambush': return s.players[who].wins<s.players[1-who].wins?3:1;
    default: return support.strength;
  }
}
export function strength(s, who, agent, support=null) {
  const p=s.players[who]; let passive=0;
  if(agent.role==='duelist'&&p.wins===0) passive=2;
  if(agent.role==='sentinel') passive=1;
  if(agent.role==='controller'&&p.bonus>0) passive=2;
  if(agent.role==='initiator'&&p.energy>=3) passive=2;
  return agent.strength+passive+p.bonus+supportBonus(s,who,agent,support);
}
export function legalPlays(s,who) {
  const p=s.players[who], agents=p.hand.filter(c=>c.category==='agent');
  return agents.flatMap(agent=>[null,...p.hand.filter(c=>c.category!=='agent'&&c.cost<=p.energy)].map(support=>({agent,support,power:strength(s,who,agent,support)})));
}
export function canRaise(s,who) {
  return s.phase==='duel'&&s.turn===who&&s.played.every(c=>c===null)&&s.lastRaiser!==who&&s.bet<12;
}
function recycle(s) {
  if(s.deck.length) return;
  const top=s.discard.pop();s.deck=shuffle(s.discard,s.rng);s.discard=top?[top]:[];
}
function award(s,who,points,reason) {
  if(who!==null) s.score[who]+=points;
  s.result={winner:who,points,reason};s.phase='handEnd';s.turn=null;
  log(s,who===null?reason:`${s.players[who].name} +${points} ponto${points===1?'':'s'}. ${reason}`);
  if(s.score.some(n=>n>=TARGET)) {s.winner=s.score[0]>=TARGET?0:1;s.phase='gameOver';log(s,`${s.players[s.winner].name} venceu a partida.`);}
}
function resolve(s) {
  const [a,b]=s.played;
  const power=[a.power,b.power];
  for(let i=0;i<2;i++) if(s.played[i].support?.id==='jam' && s.played[1-i].agent.role!=='sentinel' && s.played[1-i].support?.id!=='shield') power[1-i]-=2;
  let winner=power[0]===power[1]?null:power[0]>power[1]?0:1;
  if(winner===null) {const priority=s.played.map(c=>c.support?.id==='priority'); if(priority[0]!==priority[1]) winner=priority[0]?0:1;}
  s.result={winner,power,reason:winner===null?'Empate. Nenhum confronto conquistado.':`${s.players[winner].name} venceu o confronto.`};
  if(winner!==null) s.players[winner].wins++;
  s.phase='duelEnd';s.turn=null;log(s,`Confronto ${s.duel}: ${power[0]} × ${power[1]}. ${s.result.reason}`);
}
// All actions validate before mutation. The UI and AI use this same engine.
export function dispatch(s,who,action) {
  const fail=message=>({ok:false,error:message});
  const p=s.players[who]; if(!p) return fail('Jogador inválido.');
  if(action.type==='next') {
    if(who!==0) return fail('Somente o jogador pode avançar a operação.');
    if(s.phase==='handEnd') {deal(s);return {ok:true};}
    if(s.phase!=='duelEnd') return fail('Não há confronto a avançar.');
    if(s.players.some(p=>p.wins>=2)||s.duel===3) {
      const winner=s.players[0].wins===s.players[1].wins?null:s.players[0].wins>s.players[1].wins?0:1;
      award(s,winner,winner===null?0:s.bet,winner===null?'Operação empatada; ninguém pontua.':'Operação concluída.');return {ok:true};
    }
    s.duel++;s.played=[null,null];s.result=null;s.phase='duel';s.turn=s.leader;s.lastRaiser=null;
    return {ok:true};
  }
  if(s.phase==='gameOver') return fail('A partida terminou.');
  if(s.turn!==who) return fail('Aguarde seu turno.');
  if(action.type==='draw') {
    if(s.phase!=='draw'||!['deck','discard'].includes(action.source)) return fail('Compra indisponível.');
    if(action.source==='deck') recycle(s);
    const pile=action.source==='deck'?s.deck:s.discard;
    if(!pile.length) return fail('A pilha está vazia.');
    p.hand.push(pile.pop());s.phase='prepare';s.melded=false;log(s,`${p.name} comprou ${action.source==='deck'?'do monte':'do descarte'}.`);
  } else if(action.type==='meld') {
    if(!canMeld(s,who,action.ids)) return fail('Selecione uma trinca ou sequência válida e reserve 3 agentes.');
    const cards=getCards(p,action.ids);p.hand=p.hand.filter(c=>!action.ids.includes(c.uid));p.melds.push(cards);
    p.bonus=Math.min(3,p.bonus+2);p.energy=Math.min(6,p.energy+2);s.melded=true;
    log(s,`${p.name} baixou uma combinação: +2 força em todos os confrontos e +2 energia.`);
  } else if(action.type==='discard') {
    const card=p.hand.find(c=>c.uid===action.uid);
    if(s.phase!=='prepare'||!card) return fail('Escolha uma carta para descartar.');
    if(card.category==='agent'&&p.hand.filter(c=>c.category==='agent').length<=3) return fail('Reserve ao menos 3 agentes.');
    p.hand=p.hand.filter(c=>c.uid!==card.uid);s.discard.push(card);log(s,`${p.name} descartou ${card.name}.`);
    if(who===0) {s.turn=1;s.phase='draw';s.melded=false;} else {s.turn=s.leader;s.phase='duel';log(s,'Preparação concluída. Agentes em posição.');}
  } else if(action.type==='raise') {
    if(!canRaise(s,who)) return fail('A aposta não pode ser aumentada agora.');
    s.pendingBet={by:who,value:BETS[BETS.indexOf(s.bet)+1],returnTurn:who};s.phase='betResponse';s.turn=1-who;
    log(s,`${p.name} desafia: ${s.pendingBet.value} pontos!`);
  } else if(action.type==='accept'||action.type==='refuse') {
    if(s.phase!=='betResponse'||!s.pendingBet) return fail('Não há desafio pendente.');
    const pending=s.pendingBet;s.pendingBet=null;
    if(action.type==='refuse') {award(s,pending.by,s.bet,'Desafio recusado; vale a aposta anterior.');}
    else {s.bet=pending.value;s.lastRaiser=pending.by;s.turn=pending.returnTurn;s.phase='duel';log(s,`${p.name} aceitou. Aposta em ${s.bet}.`);}
  } else if(action.type==='fold') {
    if(!['duel','betResponse'].includes(s.phase)) return fail('Só é possível recuar durante uma disputa.');
    s.pendingBet=null;award(s,1-who,s.bet,`${p.name} recuou.`);
  } else if(action.type==='play') {
    if(s.phase!=='duel'||s.played[who]) return fail('Jogada indisponível.');
    const agent=p.hand.find(c=>c.uid===action.agent);
    const support=action.support?p.hand.find(c=>c.uid===action.support):null;
    if(!agent||agent.category!=='agent') return fail('Escolha um agente.');
    if(action.support&&(!support||support.category==='agent'||support.cost>p.energy)) return fail('Apoio inválido ou energia insuficiente.');
    const power=strength(s,who,agent,support);p.energy-=support?.cost||0;
    if(support?.id==='reserve') p.energy=Math.min(6,p.energy+2);
    if(support?.id==='scan') {
      const best=[...s.players[1-who].hand].filter(c=>c.category==='agent').sort((a,b)=>b.strength-a.strength)[0];
      if(best&&!s.revealed[who].includes(best.uid)) s.revealed[who].push(best.uid);
    }
    p.hand=p.hand.filter(c=>c.uid!==agent.uid&&c.uid!==support?.uid);s.played[who]={agent,support,power};
    // Do not expose the first play in a simultaneous duel. It is public only after both players commit.
    log(s,`${p.name} posicionou um agente${support?' com apoio':''}.`);
    if(s.played[1-who]) resolve(s);else s.turn=1-who;
  } else return fail('Ação desconhecida.');
  return {ok:true};
}
// Redacted observation: opponents' hands, deck order and committed plays remain inaccessible to AI and UI.
export function observe(s,who) {
  return {
    ...s,seed:undefined,rng:undefined,deckIds:undefined,deck:undefined,deckCount:s.deck.length,
    players:s.players.map((p,i)=>i===who?{...p,hand:p.hand.map(c=>({...c}))}:{...p,hand:undefined,handCount:p.hand.length}),
    played:s.played.map((p,i)=>s.phase==='duel'&&i!==who&&p?{hidden:true}:p),
    revealed:s.revealed[who].map(uid=>s.players[1-who].hand.find(c=>c.uid===uid)).filter(Boolean)
  };
}

export const ROLES = {
  duelist: { name: 'Duelista', icon: '✦', color: '#ff635e', passive: 'Entrada: +2 de força enquanto você não venceu um confronto.' },
  sentinel: { name: 'Sentinela', icon: '⬡', color: '#eac879', passive: 'Fortificação: +1 de força e imunidade ao bloqueio.' },
  controller: { name: 'Controlador', icon: '◈', color: '#b59afa', passive: 'Domínio: +2 de força se você baixou uma combinação.' },
  initiator: { name: 'Iniciador', icon: '⌁', color: '#66d4c0', passive: 'Impulso: +2 de força se começar a jogada com 3 ou mais de energia.' }
};
const names = {
  duelist: ['Rastro', 'Fagulha', 'Vértice', 'Íris', 'Ruptura'],
  sentinel: ['Âncora', 'Bastião', 'Nexo', 'Cobalto', 'Muralha'],
  controller: ['Névoa', 'Órbita', 'Véu', 'Eclipse', 'Espectro'],
  initiator: ['Eco', 'Sonda', 'Pulso', 'Circuito', 'Aurora']
};
export const AGENTS = Object.keys(ROLES).flatMap(role => names[role].map((name, i) => ({
  id: `${role}-${i + 1}`, name, role, rank: i + 1, strength: i + 3, category: 'agent', cost: 0,
  rarity: i === 4 ? 'Épica' : i === 3 ? 'Rara' : 'Comum', description: ROLES[role].passive,
  portrait: 'assets/agents.png', portraitPosition: ['0%', '33.333%', '66.666%', '100%'][Object.keys(ROLES).indexOf(role)], synergy: 'Trinca: mesmo nível, funções distintas. Sequência: mesma função, níveis consecutivos.'
})));
export const SUPPORT = [
  {id:'sidearm',name:'Vesper',category:'weapon',kind:'Pistola',strength:2,cost:1,description:'+2 de força. +1 extra para agentes de nível 1 ou 2.'},
  {id:'smg',name:'Vetor',category:'weapon',kind:'Submetralhadora',strength:2,cost:1,description:'+2 de força. +1 extra para Duelistas.'},
  {id:'rifle',name:'Linha Zero',category:'weapon',kind:'Rifle',strength:3,cost:2,description:'+3 de força, sem condição.'},
  {id:'shotgun',name:'Impacto',category:'weapon',kind:'Escopeta',strength:2,cost:1,description:'+2 de força. +2 extra no primeiro confronto.'},
  {id:'sniper',name:'Horizonte',category:'weapon',kind:'Precisão',strength:2,cost:2,description:'+2 de força. +3 extra para agentes de nível 4 ou 5.'},
  {id:'heavy',name:'Cerco',category:'weapon',kind:'Pesada',strength:3,cost:2,description:'+3 de força. +1 extra para Sentinelas.'},
  {id:'pulse',name:'Sobrecarga',category:'ability',kind:'Habilidade',strength:3,cost:2,description:'+3 de força neste confronto.'},
  {id:'shield',name:'Barreira',category:'ability',kind:'Habilidade',strength:1,cost:1,description:'+1 de força e imunidade ao bloqueio.'},
  {id:'scan',name:'Reconhecimento',category:'ability',kind:'Habilidade',strength:1,cost:1,description:'+1 de força. Revela o agente mais forte da mão adversária até o fim da operação.'},
  {id:'jam',name:'Interferência',category:'ability',kind:'Habilidade',strength:0,cost:2,description:'Reduz em 2 a força adversária, exceto contra Sentinela ou Barreira.'},
  {id:'bluff',name:'Falso sinal',category:'tactic',kind:'Tática',strength:0,cost:0,description:'+3 de força se seu agente for nível 1 ou 2; caso contrário, −1.'},
  {id:'ambush',name:'Retomada',category:'tactic',kind:'Tática',strength:0,cost:1,description:'+3 de força se você estiver atrás no placar de confrontos; caso contrário, +1.'},
  {id:'reserve',name:'Reserva',category:'tactic',kind:'Tática',strength:0,cost:0,description:'Recupera 2 de energia (máximo 6), sem bônus de força.'},
  {id:'priority',name:'Iniciativa',category:'tactic',kind:'Tática',strength:0,cost:1,description:'Vence um empate de força. Duas Iniciativas se anulam.'}
].map(c => ({...c, rarity: c.cost === 2 ? 'Rara' : 'Comum', role: null, rank: 0}));
export const CARDS = [...AGENTS, ...SUPPORT];
export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id,c]));
export const DEFAULT_DECK = [...AGENTS.map(c=>c.id), 'duelist-1','sentinel-2','controller-3','initiator-4', ...SUPPORT.filter(c=>!['heavy','sniper'].includes(c.id)).map(c=>c.id)];
export const STARTER_UNLOCKED = CARDS.filter(c=>!['heavy','sniper'].includes(c.id)).map(c=>c.id);
export function validateDeck(ids, unlocked = CARDS.map(c=>c.id)) {
  if (!Array.isArray(ids) || ids.length !== 36) return 'Um baralho precisa ter exatamente 36 cartas.';
  const count = {};
  for (const id of ids) {
    if (!CARD_BY_ID[id] || !unlocked.includes(id)) return 'O baralho contém uma carta indisponível.';
    count[id] = (count[id] || 0) + 1;
    if (count[id] > 2) return 'O limite é de 2 cópias de cada carta.';
  }
  if (ids.filter(id=>CARD_BY_ID[id].category === 'agent').length < 24) return 'Inclua pelo menos 24 agentes.';
  return null;
}

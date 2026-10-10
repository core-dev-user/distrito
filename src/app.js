import { CARDS, CARD_BY_ID, ROLES, DEFAULT_DECK, validateDeck } from './cards.js';
import { createGame, dispatch, observe, canMeld, findMelds, canRaise, strength, seededRandom } from './engine.js';
import { decide } from './ai.js';
import { STORAGE_KEY, freshProfile, normalizeProfile, reward, level } from './profile.js';
const app=document.querySelector('#app');
let profile;
try { profile=normalizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch {profile=freshProfile();}
let game=createGame({deck:profile.deck}), page='match',selected=[],busy=false,aiTimer=null,epoch=0,awarded=false;
let draft=[...profile.deck],filter='all',onlyUnlocked=false,pendingOptions={},aiRng=seededRandom(game.seed+111),audioContext,lastEffect='',handOrganized=false;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={draw:'PREPARAÇÃO',prepare:'PREPARAÇÃO',duel:'CONFRONTO',betResponse:'DESAFIO',duelEnd:'RESULTADO',handEnd:'OPERAÇÃO CONCLUÍDA',gameOver:'PARTIDA CONCLUÍDA'};
const difficultyName={easy:'Fácil',medium:'Médio',hard:'Difícil'};
function saveProfile() {try {localStorage.setItem(STORAGE_KEY,JSON.stringify(profile));} catch {toast('Armazenamento indisponível: o progresso fica apenas nesta sessão.');} updateProfile();}
function updateProfile() {
  document.querySelector('#profile-level').textContent=`NÍVEL ${String(level(profile)).padStart(2,'0')}`;
  const sound=document.querySelector('#sound-toggle');sound.innerHTML=`♪${profile.sound?'':'<span class="muted-slash">/</span>'}`;
  sound.setAttribute('aria-label',profile.sound?'Desativar áudio':'Ativar áudio');sound.title=profile.sound?'Desativar áudio':'Ativar áudio';sound.setAttribute('aria-pressed',String(profile.sound));
}
let toastTimer;
function toast(message) {const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function sound(type) {
  if(!profile.sound) return;
  try {
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();
    const tones=type==='win'?[440,554,659,880]:type==='raise'?[220,330,440]:type==='meld'?[392,523,659]:[type==='play'?260:540];
    tones.forEach((frequency,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),time=audioContext.currentTime+i*.09;o.type='sine';o.frequency.value=frequency;o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(.045,time+.015);g.gain.exponentialRampToValueAtTime(.001,time+.2);o.start(time);o.stop(time+.21);});
  } catch {/* Audio is optional and never blocks a move. */}
}
function categoryLabel(c) {return c.category==='agent'?ROLES[c.role].name:c.kind;}
function supportArt(c) {
  const color=c.category==='weapon'?'#b5c6cb':c.category==='ability'?'#b59afa':'#eac879';
  const path=c.category==='weapon'?'<path d="M25 88h112l13-13h27v20h-32l-24 12H83l-7 27H57l5-27H25z"/><path d="M96 108h25l12 24h-19z"/><path d="M144 85h49v7h-49z"/>':c.category==='ability'?'<circle cx="110" cy="105" r="41"/><path d="m110 58 15 29 32 18-32 17-15 30-16-30-31-17 31-18Z"/><circle cx="110" cy="105" r="11"/>':'<path d="m110 56 49 28v46l-49 28-49-28V84Z"/><path d="m87 105 16 15 31-32"/>';
  return `<svg class="support-art" viewBox="0 0 220 210" aria-hidden="true"><defs><pattern id="grid-${c.id}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0v20" fill="none" stroke="${color}" opacity=".09"/></pattern></defs><rect width="220" height="210" fill="url(#grid-${c.id})"/><circle cx="110" cy="105" r="75" fill="none" stroke="${color}" opacity=".13"/><g fill="${c.category==='weapon'?color:'none'}" stroke="${color}" stroke-width="${c.category==='weapon'?1:3}">${path}</g><path d="M12 24h30M12 24v30M208 24h-30M208 24v30" stroke="${color}" opacity=".4"/></svg>`;
}
function card(c,{interactive=false,chosen=false,collection=false,hidden=false,locked=false}={}) {
  if(hidden) return '<div class="card-back" aria-label="Carta oculta"><span class="back-inner"><span class="back-logo">D</span><small>DISTRITO</small></span></div>';
  const color=c.role?ROLES[c.role].color:c.category==='ability'?'#b59afa':c.category==='tactic'?'#eac879':'#9eafb6';
  const tag=interactive?'button':'div';
  const content=`<span class="card-top"><b>${c.category==='agent'?c.strength:'+'+c.strength}</b><span>${c.role?ROLES[c.role].icon:c.category==='weapon'?'⌖':'◈'}</span></span>
    <span class="card-art">${c.category==='agent'?`<span class="agent-portrait" role="img" aria-label="Retrato de ${esc(c.name)}" style="--portrait-position:${c.portraitPosition}"></span>`:supportArt(c)}</span>
    <span class="card-caption"><small>${esc(categoryLabel(c))}${c.category==='agent'?` / N${c.rank}`:''}</small><strong>${esc(c.name)}</strong><span class="card-stats">${c.category==='agent'?`<span>${'◆'.repeat(c.rank)}</span>`:`<span>ϟ ${c.cost} ENERGIA</span>`}<span class="rarity-dot ${c.rarity==='Épica'?'epic':c.rarity==='Rara'?'rare':''}"></span></span></span>${chosen?'<span class="selected-mark">✓</span>':''}${locked?'<span class="locked-card">◈ BLOQUEADA</span>':''}`;
  return `<div class="card-shell ${collection?'collection-card':''}"><${tag} class="game-card ${chosen?'selected':''} ${locked?'locked':''}" style="--card-color:${color}" ${interactive?`data-card="${esc(c.uid)}" aria-pressed="${chosen}" aria-label="${esc(c.name)}, ${esc(categoryLabel(c))}, força ${c.strength}${c.cost?', custo '+c.cost:''}" ${busy?'disabled':''}`:''}>${content}</${tag}><button class="card-info" data-detail="${c.id}" aria-label="Detalhes de ${esc(c.name)}" title="Ver efeito e sinergias">i</button></div>`;
}
function guidance() {
  const myTurn=game.turn===0;
  if(game.phase==='gameOver') return game.winner===0?'Distrito conquistado. Uma vitória para sua coleção.':'Operação encerrada. Toda derrota ensina uma nova estratégia.';
  if(game.phase==='handEnd') return game.result.reason;
  if(game.phase==='duelEnd') return game.result.reason;
  if(!myTurn) return game.phase==='betResponse'?'Órbita está avaliando seu desafio…':'Órbita está definindo sua estratégia…';
  if(game.phase==='draw') return 'Compre do monte ou pegue a carta visível do descarte.';
  if(game.phase==='prepare') return 'Selecione 3 agentes para combinar, ou 1 carta para descartar.';
  if(game.phase==='betResponse') return `Órbita desafia você: ${game.pendingBet.value} pontos. Aceitar ou recuar?`;
  return 'Escolha um agente. Adicione um apoio, se quiser, e confirme a jogada.';
}
function trainingHint() {
  return {draw:'Você começa com 9 cartas. Comprar do descarte revela sua intenção; o monte traz uma carta surpresa.',prepare:'Trinca = mesmo nível, 3 funções distintas. Sequência = 3 níveis consecutivos da mesma função. Uma combinação concede +2 força e +2 energia. Reserve 3 agentes.',duel:'Cada agente usa uma passiva. A carta de apoio custa energia e altera o confronto. As duas jogadas ficam ocultas até a revelação. Vencer 2 confrontos encerra a operação.',betResponse:'Recusar concede ao adversário o valor ANTERIOR da aposta. Aceitar eleva o risco. A aposta máxima é 12.',duelEnd:'O número grande é a força final, incluindo passiva, combinação e apoio. Empates não concedem vitórias; Iniciativa pode desempatar.',handEnd:'A aposta vira pontos para quem venceu mais confrontos. Uma nova operação começa com outras cartas e 2 de energia.',gameOver:'A partida termina ao chegar a 12 pontos. Teste outro baralho na coleção para mudar suas opções.'}[game.phase];
}
function matchPage() {
  const v=observe(game,0),me=v.players[0],op=v.players[1],myTurn=v.turn===0&&!busy;
  if(handOrganized) me.hand.sort((a,b)=>(a.category==='agent'?0:1)-(b.category==='agent'?0:1)||(a.role||a.category).localeCompare(b.role||b.category)||a.rank-b.rank||a.name.localeCompare(b.name));
  const candidates=findMelds(me.hand).filter(m=>canMeld(game,0,m.map(c=>c.uid)));
  const agent=me.hand.find(c=>selected.includes(c.uid)&&c.category==='agent');
  const support=me.hand.find(c=>selected.includes(c.uid)&&c.category!=='agent');
  const selectedCards=me.hand.filter(c=>selected.includes(c.uid));
  const discardable=selectedCards.length===1&&(selectedCards[0].category!=='agent'||me.hand.filter(c=>c.category==='agent').length>3);
  const status=game.phase==='gameOver'?(game.winner===0?'VITÓRIA':'DERROTA'):myTurn?'SEU TURNO':game.turn===1?'TURNO DA IA':'REVELAÇÃO';
  const progress=Math.min(100,profile.xp%100);
  const controls=game.phase==='draw'?`<button class="button primary" data-action="draw" ${!myTurn?'disabled':''}>COMPRAR DO MONTE <span>↗</span></button><button class="button secondary" data-action="take" ${!myTurn||!game.discard.length?'disabled':''}>PEGAR DESCARTE</button>`:
    game.phase==='prepare'?`<button class="button primary" data-action="discard" ${!myTurn||!discardable?'disabled':''}>DESCARTAR SELECIONADA <span>↗</span></button><button class="button secondary" data-action="meld" ${!myTurn||!canMeld(game,0,selected)?'disabled':''}>BAIXAR COMBINAÇÃO</button>`:
    game.phase==='betResponse'?`<button class="button primary" data-action="accept" ${!myTurn?'disabled':''}>ACEITAR · ${game.pendingBet.value} PTS <span>✓</span></button><button class="button secondary" data-action="refuse" ${!myTurn?'disabled':''}>RECUSAR · CEDE ${game.bet} PT${game.bet===1?'':'S'}</button>`:
    game.phase==='duel'?`<button class="button primary" data-action="play" ${!myTurn||!agent||support&&support.cost>me.energy?'disabled':''}>${support?'JOGAR COM APOIO':'JOGAR AGENTE'} <span>↗</span></button><button class="button secondary raise-button" data-action="raise" ${!myTurn||!canRaise(game,0)?'disabled':''}>AUMENTAR APOSTA <span>↑</span></button><button class="button text-button" data-action="fold" ${!myTurn?'disabled':''}>RECUAR</button>`:
    ['duelEnd','handEnd'].includes(game.phase)?`<button class="button primary" data-action="next" ${busy?'disabled':''}>${game.phase==='handEnd'?'PRÓXIMA OPERAÇÃO':me.wins>=2||op.wins>=2||game.duel===3?'CONCLUIR OPERAÇÃO':'PRÓXIMO CONFRONTO'} <span>→</span></button>`:
    `<button class="button primary" data-action="replay">JOGAR NOVAMENTE <span>↗</span></button><button class="button secondary" data-page="collection">VER COLEÇÃO</button>`;
  const played=(who)=>{
    const play=v.played[who];
    if(!play) return `<div class="play-slot"><span class="slot-cross">+</span><small>${who===0?'SEU AGENTE':'AGENTE ADVERSÁRIO'}</small></div>`;
    if(play.hidden||game.phase==='duel') return `<div class="committed">${card(null,{hidden:true})}<small>POSICIONADO</small></div>`;
    return `<div class="revealed-play ${v.result?.winner===who?'winning-play':''}">${card(play.agent)}<b class="power-chip">${v.result?.power?.[who]??play.power}<small>FORÇA</small></b>${play.support?`<div class="attached-support" style="--support-color:${play.support.category==='ability'?'#b59afa':'#eac879'}"><span>ϟ</span> ${esc(play.support.name)}</div>`:''}</div>`;
  };
  return `<section class="match-page" data-effect="${lastEffect}">
    <div class="page-heading"><div><div class="eyebrow"><span class="live-dot"></span> ${game.training?'CAMPO DE TREINAMENTO':'PARTIDA RÁPIDA'} <span class="eyebrow-divider">/</span> VOCÊ × IA</div><h1>O blefe é uma arma<span>.</span></h1></div><div class="match-options"><label>DIFICULDADE<select id="difficulty" aria-label="Dificuldade da IA">${Object.entries(difficultyName).map(([key,value])=>`<option value="${key}" ${game.difficulty===key?'selected':''}>${value}</option>`).join('')}</select></label><button class="button subtle small" data-action="new">NOVA PARTIDA <span>↗</span></button></div></div>
    <div class="game-layout">
      <aside class="left-panel"><div class="panel-label">PLACAR DA PARTIDA <span>↗</span></div><div class="score-card"><div class="score-row"><span><i class="mini-avatar me">D</i>VOCÊ</span><strong>${v.score[0]}<small>/ 12</small></strong></div><div class="score-track"><span style="width:${Math.min(100,v.score[0]/12*100)}%"></span></div><div class="score-row opponent"><span><i class="mini-avatar">Ø</i>ÓRBITA</span><strong>${v.score[1]}<small>/ 12</small></strong></div><div class="score-track enemy"><span style="width:${Math.min(100,v.score[1]/12*100)}%"></span></div><p>PRIMEIRO A 12 PONTOS VENCE</p></div>
      <div class="intel-panel"><div class="panel-label">COMBINAÇÕES <span>◈</span></div>${me.melds.length?me.melds.map(m=>`<div class="meld-display"><b>+2 FORÇA <span>✓</span></b><small>${m.map(c=>esc(c.name)).join(' · ')}</small></div>`).join(''):'<div class="empty-intel"><span>◇ ◇ ◇</span><p>Três cartas.<br>Uma vantagem tática.</p></div>'}<div class="combo-note"><b>TRINCA</b><span>Mesmo nível · 3 funções</span><b>SEQUÊNCIA</b><span>Mesma função · 3 níveis seguidos</span></div>${candidates.length?`<button class="combo-suggestion" data-suggest-meld ${!myTurn?'disabled':''}>◈ ${candidates.length} combinação disponível <span>→</span></button>`:''}</div>
      <button class="help-link" data-page="guide">ⓘ REGRAS DA OPERAÇÃO <span>↗</span></button></aside>
      <section class="arena ${game.phase==='gameOver'?'finished':''}" aria-label="Mesa de jogo">
        <div class="arena-grid"></div><span class="corner corner-tl"></span><span class="corner corner-tr"></span><span class="corner corner-bl"></span><span class="corner corner-br"></span>
        <div class="arena-topline"><span>OPERAÇÃO <b>${String(game.handNo).padStart(2,'0')}</b></span><span class="arena-code">D / SECTOR 07</span><span>APOSTA <b class="bet-number">${game.pendingBet?.value??game.bet} <small>PTS</small></b></span></div>
        <div class="opponent-station"><div class="opponent-profile"><span class="opponent-avatar agent-portrait" role="img" aria-label="Órbita" style="--portrait-position:66.666%"></span><div><strong>ÓRBITA <span class="ai-label">IA</span></strong><small>CONTROLADOR · ${difficultyName[game.difficulty].toUpperCase()}</small><span class="enemy-resources">ϟ ${op.energy} ENERGIA ${op.bonus?`· +${op.bonus} FORÇA`:''}</span></div><div class="duel-pips">${[0,1].map(i=>`<i class="${op.wins>i?'filled':''}"></i>`).join('')}</div></div><div class="opponent-hand" aria-label="${op.handCount} cartas ocultas">${Array.from({length:op.handCount},(_,i)=>`<div class="mini-back" style="--index:${i};--total:${op.handCount}"><span>D</span></div>`).join('')}</div></div>
        <div class="center-stage"><div class="supply"><button class="deck-pile" data-action="draw" aria-label="Comprar do monte" ${game.phase!=='draw'||!myTurn?'disabled':''}>${card(null,{hidden:true})}<span>${v.deckCount}</span></button><small>MONTE</small><div class="discard-pile"><button class="discard-card" data-action="take" aria-label="Comprar carta do descarte" ${game.phase!=='draw'||!myTurn||!v.discard.length?'disabled':''}>${v.discard.length?`<span class="discard-force">${v.discard.at(-1).strength}</span><span>${esc(v.discard.at(-1).name)}</span><small>${esc(categoryLabel(v.discard.at(-1)))}</small>`:'VAZIO'}</button><small>DESCARTE</small></div></div>
          <div class="duel-zone"><div class="zone-label">CONFRONTO <b>${String(game.duel).padStart(2,'0')}</b> <span>/ 03</span></div><div class="duel-cards">${played(0)}<div class="versus"><span>VS</span><i></i></div>${played(1)}</div><div class="duel-sequence">${[1,2,3].map(n=>`<span class="${n===game.duel?'current':n<game.duel?'past':''}"></span>`).join('')}</div></div>
        </div>
        ${game.phase==='gameOver'?`<div class="gameover-banner ${game.winner===0?'victory':''}"><span>OPERAÇÃO FINALIZADA</span><strong>${game.winner===0?'DISTRITO CONQUISTADO':'DISTRITO PERDIDO'}</strong><small>+${game.winner===0?50:30} XP · ${v.score[0]} × ${v.score[1]}</small></div>`:''}
        <div class="arena-bottomline"><div><span class="status-dot ${myTurn?'ready':''}"></span>${status}</div><span>ϟ <b>${me.energy}</b> / 6 ENERGIA ${me.bonus?`<i>+${me.bonus} FORÇA</i>`:''}</span><div class="duel-pips player">${[0,1].map(i=>`<i class="${me.wins>i?'filled':''}"></i>`).join('')}</div></div>
      </section>
      <aside class="right-panel"><div class="panel-label">RADAR DE AÇÕES <span class="live-dot"></span></div><div class="action-log" aria-label="Histórico de ações">${v.log.slice(-6).reverse().map((line,i)=>`<div class="log-entry ${i===0?'latest':''}"><span class="log-marker">${i===0?'↗':'·'}</span><p>${esc(line)}</p></div>`).join('')}</div>${v.revealed.length?`<div class="recon-panel"><b>⌖ RECONHECIMENTO</b>${v.revealed.map(c=>`<p>${esc(c.name)} · força ${c.strength}</p>`).join('')}</div>`:''}<div class="operation-tip"><span class="tip-icon">⌁</span><span class="eyebrow">LEITURA TÁTICA</span><p>${game.phase==='prepare'?'Combinações fortalecem todos os seus agentes nesta operação.':game.phase==='betResponse'?'O blefe é permitido. A informação oculta também é uma arma.':'Energia é limitada. Guarde o apoio certo para o confronto decisivo.'}</p></div><div class="xp-panel"><div><span>NÍVEL ${String(level(profile)).padStart(2,'0')}</span><b>${profile.xp%100} / 100 XP</b></div><div class="xp-track"><span style="width:${progress}%"></span></div><small>${profile.games} PARTIDAS · ${profile.wins} VITÓRIAS</small></div></aside>
    </div>
    <section class="hand-section" aria-label="Sua mão"><div class="hand-heading"><div><span class="eyebrow">SEU ARSENAL</span><span class="hand-count">${me.hand.length} CARTAS</span></div><div class="hand-tools">${selected.length?`<span class="selection-summary">${agent&&game.phase==='duel'?`FORÇA PREVISTA <b>${strength(game,0,agent,support)}</b>`:`${selected.length} SELECIONADA${selected.length>1?'S':''}`}</span>`:''}<button class="sort-button" data-action="sort">⇅ ORGANIZAR MÃO</button></div></div><div class="player-hand" data-hand="${epoch}-${game.handNo}">${me.hand.map(c=>card(c,{interactive:myTurn&&['prepare','duel'].includes(game.phase),chosen:selected.includes(c.uid)})).join('')}</div></section>
    <section class="command-bar"><div class="phase-message"><span class="phase-number">${['draw','prepare'].includes(game.phase)?'01':game.phase==='duel'||game.phase==='betResponse'?'02':'03'}</span><div><b>${labels[game.phase]}</b><p role="status" aria-live="polite">${guidance()}</p></div></div><div class="game-actions">${controls}</div></section>
    ${game.training?`<aside class="training-tip"><b>ⓘ INSTRUTOR</b><p>${trainingHint()}</p></aside>`:''}
    <footer class="match-footer"><span><span class="live-dot"></span> MOTOR LOCAL · SEM CONEXÃO OBRIGATÓRIA</span><button data-action="training">${game.training?'SAIR DO TREINAMENTO':'MODO TREINAMENTO'} ↗</button><span>IDENTIDADE ORIGINAL / DISTRITO © 2026</span></footer>
  </section>`;
}
function collectionPage() {
  const cards=CARDS.filter(c=>(filter==='all'||c.category===filter)&&(!onlyUnlocked||profile.unlocked.includes(c.id)));
  const counts=Object.fromEntries(CARDS.map(c=>[c.id,draft.filter(id=>id===c.id).length]));
  const error=validateDeck(draft,profile.unlocked),agents=draft.filter(id=>CARD_BY_ID[id].category==='agent').length;
  return `<section class="collection-page"><div class="page-heading"><div><div class="eyebrow">ARSENAL DO OPERADOR / NÍVEL ${level(profile)}</div><h1>Sua próxima vantagem<span>.</span></h1><p>Monte um baralho. Encontre uma sinergia. Mude o jogo.</p></div><div class="collection-progress"><strong>${profile.unlocked.length}<span> / ${CARDS.length}</span></strong><small>CARTAS DESBLOQUEADAS</small></div></div><div class="collection-layout"><div><div class="collection-toolbar"><div class="filter-tabs" aria-label="Categoria">${[['all','TODAS'],['agent','AGENTES'],['weapon','ARMAS'],['ability','HABILIDADES'],['tactic','TÁTICAS']].map(([key,name])=>`<button data-filter="${key}" class="${filter===key?'active':''}">${name}</button>`).join('')}</div><label class="unlock-filter"><input id="unlocked-only" type="checkbox" ${onlyUnlocked?'checked':''}> Só desbloqueadas</label></div><div class="collection-grid">${cards.map(c=>{const unlocked=profile.unlocked.includes(c.id);return `<div class="collection-item">${card(c,{collection:true,locked:!unlocked})}<div class="copy-controls"><button data-remove="${c.id}" aria-label="Remover ${c.name}" ${counts[c.id]===0?'disabled':''}>−</button><span>${counts[c.id]} / 2</span><button data-add="${c.id}" aria-label="Adicionar ${c.name}" ${!unlocked||counts[c.id]>=2||draft.length>=36?'disabled':''}>+</button></div>${!unlocked?`<small class="unlock-level">DESBLOQUEIA NO NÍVEL ${c.id==='sniper'?2:3}</small>`:''}</div>`;}).join('')}</div></div><aside class="deck-editor"><span class="eyebrow">CONSTRUÇÃO DE BARALHO</span><h2>Protocolo Zero</h2><div class="deck-metrics"><strong>${draft.length}<small>/ 36 CARTAS</small></strong><div><b>${agents}</b><small>AGENTES · MÍN. 24</small></div></div><div class="deck-validation ${error?'invalid':'valid'}" role="status">${error?`ⓘ ${esc(error)}`:'✓ Baralho válido. Pronto para a operação.'}</div><div class="deck-list">${CARDS.filter(c=>counts[c.id]>0).map(c=>`<div><span style="color:${c.role?ROLES[c.role].color:'#bbc6cc'}">${c.role?ROLES[c.role].icon:'⌖'}</span><button data-detail="${c.id}">${esc(c.name)}</button><b>×${counts[c.id]}</b><button class="deck-remove" data-remove="${c.id}" aria-label="Remover ${c.name}">−</button></div>`).join('')}</div><button class="button primary" data-action="save-deck" ${error?'disabled':''}>SALVAR BARALHO <span>✓</span></button><button class="button subtle" data-action="reset-deck">RESTAURAR BARALHO INICIAL</button><p class="deck-note">Até 2 cópias por carta. O mesmo baralho é usado por você e pela IA. Alterações entram na próxima partida.</p><div class="progress-rewards"><b>RECOMPENSAS DE OPERAÇÃO</b><p>Vitória: +50 XP · Derrota: +30 XP</p><p>Nível 2 → Horizonte<br>Nível 3 → Cerco</p><small>Progresso salvo neste navegador.</small></div></aside></div></section>`;
}
function guidePage() {
  return `<section class="guide-page"><div class="page-heading"><div><div class="eyebrow">MANUAL DE CAMPO / PROTOCOLO 01</div><h1>Leia a mesa. Mude o jogo<span>.</span></h1><p>Combinações de Pife. Disputas e blefes de Truco. Uma operação original.</p></div><button class="button primary" data-action="training">INICIAR TREINAMENTO <span>↗</span></button></div><div class="guide-intro"><span class="guide-emblem">D</span><div><span class="eyebrow">OBJETIVO DA MISSÃO</span><h2>Conquiste 12 pontos.</h2><p>Cada operação tem até três confrontos. Quem vencer dois — ou tiver mais vitórias depois do terceiro — ganha a aposta. Empates totais não pontuam.</p></div><div class="bet-ladder"><b>A ESCADA DO BLEFE</b><span>1 <i>→</i> 3 <i>→</i> 6 <i>→</i> 9 <i>→</i> 12</span></div></div><div class="guide-steps"><article><span class="step-badge">01</span><h2>Prepare sua mão</h2><p>Você recebe 9 cartas, incluindo pelo menos 6 agentes. Compre 1 carta do monte ou do descarte. Baixe no máximo uma combinação e descarte 1 carta. Reserve ao menos 3 agentes para o combate.</p><div class="rule-example"><b>TRINCA</b><span>Nível 2 / Duelista + Sentinela + Iniciador</span><b>SEQUÊNCIA</b><span>Duelista / Níveis 1 + 2 + 3</span></div><p>Combinação: +2 de força para todos os confrontos e +2 de energia. A IA passa pela mesma preparação.</p></article><article><span class="step-badge">02</span><h2>Entre em confronto</h2><p>Escolha 1 agente e, opcionalmente, 1 apoio. Ambos são consumidos. Você começa a operação com 2 de energia, com limite de 6. A passiva do agente e a combinação modificam a força.</p><p>As cartas posicionadas ficam ocultas até os dois jogadores confirmarem. A maior força final vence. Interferência e proteções resolvem simultaneamente.</p><p>Empate não dá vitória. Iniciativa vence um empate, mas duas Iniciativas se anulam.</p></article><article><span class="step-badge">03</span><h2>Aposte na sua leitura</h2><p>Antes de posicionar uma carta, aumente a aposta. Seu adversário aceita ou recusa. Se recusar, você recebe a aposta anterior. Recuar também cede a aposta atual.</p><p>Um jogador não aumenta duas vezes seguidas no mesmo confronto. Depois da primeira carta posicionada, a aposta fica fechada até o confronto seguinte.</p><p>A operação acaba com 2 vitórias ou após 3 confrontos. Pontos, energia e combinações são atualizados pelo motor de regras.</p></article></div><div class="role-guide">${Object.entries(ROLES).map(([key,r])=>`<article style="--role-color:${r.color}"><span class="role-portrait agent-portrait" role="img" aria-label="Agente ${r.name}" style="--portrait-position:${["0%","33.333%","66.666%","100%"][Object.keys(ROLES).indexOf(key)]}"></span><div><span>${r.icon}</span><h3>${r.name}</h3><p>${r.passive}</p></div></article>`).join('')}</div><div class="guide-bottom"><div><h3>A IA joga com as mesmas regras.</h3><p>Fácil faz escolhas aleatórias ocasionais. Médio busca combinações e administra energia. Difícil preserva recursos, considera o placar e pode blefar. Nenhuma dificuldade acessa sua mão oculta.</p></div><div><h3>Sua coleção cresce com você.</h3><p>Ganhe XP ao concluir uma partida. Edite um baralho de 36 cartas, com ao menos 24 agentes e no máximo 2 cópias de cada carta. Sua coleção é salva localmente.</p></div></div><p class="license-note">Distrito é uma criação independente com personagens, símbolos e ilustrações originais. Não é um produto oficial nem tem associação com Riot Games ou VALORANT. Multiplayer online e torneios com vários jogadores não estão implementados nesta versão.</p></section>`;
}
function render() {
  const oldHand=app.querySelector('.player-hand');
  const handScroll=oldHand?.dataset.hand===`${epoch}-${game.handNo}`?oldHand.scrollLeft:0;
  app.innerHTML=page==='match'?matchPage():page==='collection'?collectionPage():guidePage();
  if(app.querySelector('.player-hand')) app.querySelector('.player-hand').scrollLeft=handScroll;
  document.querySelectorAll('.nav-link').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});updateProfile();
}
function applyReward() {
  if(game.phase==='gameOver'&&!awarded) {awarded=true;const previous=profile.unlocked.length;profile=reward(profile,game.winner===0);saveProfile();sound(game.winner===0?'win':'raise');if(profile.unlocked.length>previous)toast('Nível alcançado! Nova carta desbloqueada na coleção.');}
}
function scheduleAI() {
  clearTimeout(aiTimer);
  if(game.turn!==1||busy) return;
  const current=epoch;
  aiTimer=setTimeout(()=>{
    if(current!==epoch||game.turn!==1||busy) return;
    const action=decide(observe(game,1),1,aiRng);
    if(!action){toast('A IA não encontrou uma ação válida.');return;}
    const result=dispatch(game,1,action);
    if(!result.ok){toast(result.error);return;}
    sound(action.type);lastEffect=action.type;applyReward();busy=true;render();
    setTimeout(()=>{if(current!==epoch)return;busy=false;lastEffect='';render();scheduleAI();},300);
  },650);
}
function move(action) {
  if(busy) return;
  const result=dispatch(game,0,action);
  if(!result.ok){toast(result.error);return;}
  selected=[];sound(action.type);lastEffect=action.type;busy=true;applyReward();render();
  const current=epoch;
  setTimeout(()=>{if(current!==epoch)return;busy=false;lastEffect='';render();scheduleAI();},300);
}
function start(options={}) {
  epoch++;clearTimeout(aiTimer);busy=false;lastEffect='';selected=[];awarded=false;
  game=createGame({deck:profile.deck,difficulty:options.difficulty||game.difficulty,training:options.training??game.training});aiRng=seededRandom(game.seed+111);page='match';render();scheduleAI();window.scrollTo({top:0,behavior:'smooth'});
}
function requestStart(options={}) {
  if(game.phase==='gameOver') {start(options);return;}
  pendingOptions=options;document.querySelector('#restart-dialog').showModal();
}
function showDetail(id) {
  const c=CARD_BY_ID[id];if(!c)return;
  document.querySelector('#detail-content').innerHTML=`${card(c)}<div><span class="eyebrow">${esc(categoryLabel(c))} / ${c.rarity.toUpperCase()}</span><h2>${esc(c.name)}</h2><p class="detail-effect">${esc(c.description)}</p><div class="detail-stats"><span>FORÇA <b>${c.strength}</b></span><span>ENERGIA <b>${c.cost}</b></span>${c.rank?`<span>NÍVEL <b>${c.rank}</b></span>`:''}</div><h3>${c.category==='agent'?'SINERGIAS':'REGRAS DE APOIO'}</h3><p>${esc(c.synergy||'Use com um agente durante um confronto. Uma carta de apoio por jogada. O custo precisa estar disponível antes de confirmar.')}</p>${!profile.unlocked.includes(c.id)?`<p class="locked-note">Desbloqueia no nível ${c.id==='sniper'?2:3}.</p>`:''}</div>`;
  // The detail card should not recursively open its own dialog.
  document.querySelector('#detail-content .card-info')?.remove();document.querySelector('#card-detail').showModal();
}
function selectCard(uid) {
  if(busy||game.turn!==0||!['prepare','duel'].includes(game.phase)) return;
  const c=game.players[0].hand.find(c=>c.uid===uid);if(!c)return;
  if(selected.includes(uid))selected=selected.filter(id=>id!==uid);
  else if(game.phase==='duel') {
    if(c.category!=='agent'&&c.cost>game.players[0].energy){toast('Energia insuficiente para esse apoio.');return;}
    selected=selected.filter(id=>{const existing=game.players[0].hand.find(x=>x.uid===id);return (existing.category==='agent')!==(c.category==='agent');});selected.push(uid);
  } else {if(selected.length>=3)selected=[];selected.push(uid);}
  sound('select');render();
}
document.addEventListener('click',e=>{
  const el=e.target.closest('button, a.brand');if(!el||el.disabled)return;
  if(el.matches('a.brand')){e.preventDefault();page='match';render();return;}
  if(el.dataset.page){page=el.dataset.page;render();return;}
  if(el.dataset.detail){showDetail(el.dataset.detail);return;}
  if(el.dataset.card){selectCard(el.dataset.card);return;}
  if(el.hasAttribute('data-suggest-meld')) {const m=findMelds(game.players[0].hand).find(m=>canMeld(game,0,m.map(c=>c.uid)));if(m){selected=m.map(c=>c.uid);render();toast('Combinação selecionada. Confirme para baixar.');}return;}
  if(el.dataset.filter){filter=el.dataset.filter;render();return;}
  if(el.dataset.add){const id=el.dataset.add;if(profile.unlocked.includes(id)&&draft.length<36&&draft.filter(x=>x===id).length<2){draft.push(id);render();}return;}
  if(el.dataset.remove){const idx=draft.indexOf(el.dataset.remove);if(idx!==-1){draft.splice(idx,1);render();}return;}
  const action=el.dataset.action;
  if(action==='draw')move({type:'draw',source:'deck'});
  else if(action==='take')move({type:'draw',source:'discard'});
  else if(action==='discard')move({type:'discard',uid:selected[0]});
  else if(action==='meld')move({type:'meld',ids:selected});
  else if(action==='play') {const hand=game.players[0].hand;move({type:'play',agent:hand.find(c=>selected.includes(c.uid)&&c.category==='agent')?.uid,support:hand.find(c=>selected.includes(c.uid)&&c.category!=='agent')?.uid});}
  else if(['raise','accept','refuse','fold','next'].includes(action))move({type:action});
  else if(action==='new'||action==='replay')requestStart();
  else if(action==='training')requestStart({training:page==='guide'?true:!game.training});
  else if(action==='sort') {if(!busy){handOrganized=!handOrganized;render();}}
  else if(action==='reset-deck'){draft=[...DEFAULT_DECK];render();toast('Baralho inicial restaurado no editor. Salve para aplicar.');}
  else if(action==='save-deck'){const error=validateDeck(draft,profile.unlocked);if(error)toast(error);else{profile.deck=[...draft];saveProfile();render();toast('Baralho salvo. Será usado na próxima partida.');}}
});
document.addEventListener('change',e=>{
  if(e.target.id==='difficulty')requestStart({difficulty:e.target.value});
  if(e.target.id==='unlocked-only'){onlyUnlocked=e.target.checked;render();}
});
document.querySelector('#close-detail').addEventListener('click',()=>document.querySelector('#card-detail').close());
document.querySelector('#cancel-restart').addEventListener('click',()=>{document.querySelector('#restart-dialog').close();render();});
document.querySelector('#confirm-restart').addEventListener('click',()=>{document.querySelector('#restart-dialog').close();start(pendingOptions);});
document.querySelector('#restart-dialog').addEventListener('cancel',()=>render());
document.querySelector('#sound-toggle').addEventListener('click',()=>{profile.sound=!profile.sound;saveProfile();sound('meld');});
render();

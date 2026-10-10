# Regras de DISTRITO — Protocolo Zero

## Partida e operação

- Dois participantes, cada um com a mesma lista de baralho legal: 36 cartas, pelo menos 24 agentes, no máximo duas cópias por tipo. Uma única instância desse baralho é embaralhada para a operação e compartilhada pelos jogadores.
- Objetivo: chegar a **12 pontos**. Pontos podem ultrapassar 12; o jogo encerra imediatamente após a pontuação vencedora.
- Cada operação começa com placar de confrontos zerado, aposta de 1 ponto, 2 de energia por jogador, sem combinações. O placar da partida é preservado.
- O baralho é embaralhado a cada operação. Cada jogador recebe 9 cartas, das quais pelo menos 6 são agentes; a distribuição reserva primeiro seis agentes da ordem embaralhada e completa com três cartas do monte. Uma carta é revelada para o descarte.
- O humano prepara a mão primeiro e a IA depois. A prioridade para posicionar cartas alterna por operação; a revelação é simultânea, portanto o segundo jogador não vê a primeira jogada.

## Preparação (Pife)

No seu turno:

1. Compre exatamente uma carta do monte ou a carta do topo do descarte. Você não pode escolher uma carta abaixo do topo.
2. Opcionalmente baixe **uma** combinação de três agentes. As cartas deixam a mão e ficam públicas. A indicação de combinação apenas seleciona cartas; você precisa confirmar a ação.
3. Descarte exatamente uma carta para encerrar a preparação. É proibido ficar com menos de três agentes após combinar ou descartar.

Combinações legais:

- **Trinca:** três agentes do mesmo nível e de três funções diferentes. Duas cópias do mesmo agente não formam uma trinca.
- **Sequência:** três agentes de uma mesma função com níveis distintos e consecutivos. Por exemplo, 2–3–4; 1–3–5 é inválido.
- Armas, habilidades e táticas não entram em combinações.

Uma combinação concede **+2 de força em todos os confrontos da operação** e **+2 de energia**, com limite de 6. Esses bônus não se acumulam entre operações. Não há obrigação de esvaziar a mão: baixar uma combinação gera vantagem no combate, e o encerramento da operação é definido pelos confrontos. Esta é a integração própria do Pife com as disputas, não uma cópia das regras de Pife tradicional.

Se o monte acabar, os descartes abaixo do topo são reembaralhados. Se não houver cartas para reciclar, comprar do monte é rejeitado; a compra do descarte continua disponível quando seu topo existir. A distribuição e o tamanho do baralho garantem cartas suficientes na preparação normal.

## Agentes, recursos e apoios

Há quatro funções, com agentes de níveis 1 a 5. **Força-base = nível + 2**.

| Função | Passiva | Limitação |
| --- | --- | --- |
| Duelista | +2 de força enquanto não tiver vencido nenhum confronto | Perde a vantagem após sua primeira vitória |
| Sentinela | +1 de força e imunidade a Interferência | Bônus menor que os condicionais |
| Controlador | +2 de força se baixou uma combinação | Sem combinação, não ativa a passiva |
| Iniciador | +2 de força se tiver pelo menos 3 de energia antes da jogada | Depende de energia preservada ou gerada |

A força final soma base, passiva, bônus de combinação e efeito do apoio; depois aplica os efeitos adversários. A passiva é calculada **antes de pagar** o custo do apoio. Cada confronto consome um agente e no máximo um apoio. Cartas consumidas não voltam à mão e não são usadas na operação seguinte.

| Apoio | Energia | Efeito |
| --- | ---: | --- |
| Vesper / pistola | 1 | +2; +1 extra para níveis 1 ou 2 |
| Vetor / submetralhadora | 1 | +2; +1 extra para Duelistas |
| Linha Zero / rifle | 2 | +3 |
| Impacto / escopeta | 1 | +2; +2 extra no primeiro confronto |
| Horizonte / precisão | 2 | +2; +3 extra para níveis 4 ou 5 |
| Cerco / pesada | 2 | +3; +1 extra para Sentinelas |
| Sobrecarga | 2 | +3 |
| Barreira | 1 | +1 e imunidade a Interferência |
| Reconhecimento | 1 | +1 e revela o agente de maior força-base na mão adversária; a informação desaparece quando a carta deixa a mão ou a operação acaba |
| Interferência | 2 | −2 à força adversária; não afeta Sentinelas nem Barreira |
| Falso sinal | 0 | +3 para níveis 1 ou 2; −1 para outros níveis |
| Retomada | 1 | +3 quando atrás nas vitórias de confrontos; +1 nos demais casos |
| Reserva | 0 | Recupera 2 de energia, até 6; não acrescenta força |
| Iniciativa | 1 | Ganha empate de força; duas Iniciativas se anulam |

Todos os custos são validados antes de consumir cartas. Você não pode usar energia futura para pagar um apoio. Não há recuperação automática de energia entre confrontos.

## Confrontos (Truco)

Cada jogador confirma sua carta; a identidade e os efeitos da primeira jogada ficam ocultos até os dois confirmarem. A maior força final vence. Interferência e imunidades são aplicadas ao mesmo tempo. Em empate, apenas um apoio Iniciativa pode conceder a vitória; se nenhum ou ambos o usarem, ninguém vence o confronto.

A operação encerra quando alguém vence dois confrontos ou depois do terceiro confronto. Neste último caso, quem tem mais vitórias ganha a aposta, inclusive quando um ou mais confrontos empataram. Se os totais forem iguais, ninguém pontua. Não há rodada extra para desempatar.

## Apostas e desistência

- Escada: **1 → 3 → 6 → 9 → 12**. Cada pedido aumenta para o próximo valor, nunca para um valor arbitrário.
- Só o jogador com prioridade pode aumentar, antes de qualquer carta posicionada no confronto. Não pode aumentar duas vezes seguidas no mesmo confronto. No confronto seguinte, essa restrição reinicia.
- O adversário responde **Aceitar** ou **Recusar**. Aceitar confirma o novo valor e devolve a prioridade ao desafiante. Não há contra-aumento imediato dentro da resposta.
- Recusar concede ao desafiante a aposta **anterior**, não o valor solicitado.
- Recuar durante seu turno de confronto ou resposta concede ao adversário a aposta atual.
- Não é possível aumentar, jogar ou desistir durante preparação, resultado ou partida encerrada.

## IA, coleção e progressão

A IA usa as mesmas ações e validações que o humano, com sua própria observação pública. Não recebe cartas ocultas do jogador, ordem do monte, semente do embaralhamento ou identidade da primeira jogada em um confronto pendente.

- Fácil: escolhas simples, apoios aleatórios e falhas ocasionais na busca por combinações.
- Médio: busca combinações, descarta cartas menos úteis e administra apoios.
- Difícil: considera sinergias, custo, placar, risco e conservação de cartas, com possibilidade de blefe.

Concluir uma partida concede 50 XP por vitória ou 30 XP por derrota, uma vez por partida. Cada 100 XP aumenta um nível. Horizonte desbloqueia no nível 2; Cerco no nível 3. As demais cartas começam desbloqueadas. Abandonar uma partida não concede XP. O treinamento usa regras e recompensas iguais, com dicas contextuais.

O editor valida o baralho e impede salvar listas ilegais. Alterações salvas entram na próxima partida. Coleção, XP, vitórias e baralho são armazenados apenas no navegador; não há moeda real, apostas financeiras ou conta online.

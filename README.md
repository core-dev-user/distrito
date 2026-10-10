# DISTRITO

Jogo de cartas tático original e jogável, inspirado na estratégia de Truco e Pife. Uma partida contra IA vai da distribuição até a vitória, com preparação da mão, combinações, confrontos simultâneos, energia, apoios, blefe e apostas.

## Executar

Requer Node.js 22 ou superior (validado com Node.js 24) e npm.

```sh
npm ci
npm run dev
```

O servidor escuta na porta 5173. `PORT=8080 npm start` muda a porta. O jogo funciona no navegador, sem APIs, contas, credenciais ou serviços externos. O servidor local fornece módulos JavaScript nativos, ilustrações e fontes locais. Para publicação estática, `npm run build` copia apenas os arquivos públicos para `dist/`. A única dependência de desenvolvimento é Playwright, usada para verificar a interface.

## Deploy na Vercel

Importe `core-dev-user/distrito` do GitHub e use a branch **main**. A raiz do projeto é a raiz do repositório (`.`). O arquivo `vercel.json` define o comando `npm run build` e o diretório de saída `dist`. O preset é **Other**, sem framework. O deploy serve arquivos estáticos e não executa `npm start`.

O build inclui apenas `index.html`, `src/` e `assets/`; não publica testes, dependências, scripts ou a especificação original. Não são necessárias variáveis de ambiente. Se a Vercel informar que a referência não existe, confirme que há um commit na branch `main` no GitHub e importe novamente ou refaça o deploy.

## Jogar

1. **Preparação:** compre uma carta do monte ou do descarte. Opcionalmente selecione três agentes e baixe uma combinação. Descarte uma carta para encerrar seu turno. A IA faz a mesma preparação.
2. **Confronto:** selecione um agente e, opcionalmente, um apoio. Confirme a jogada. As duas cartas ficam ocultas até os dois participantes confirmarem; a força final decide a vitória.
3. **Aposta:** antes de alguém posicionar uma carta no confronto, você pode aumentar o valor. Aceite ou recuse desafios da IA, ou recue. O placar é atualizado pela aposta realmente aceita.
4. **Operação:** vença dois confrontos ou tenha mais vitórias após o terceiro. O vencedor recebe o valor da aposta. Uma nova operação começa com novas cartas.
5. **Partida:** o primeiro a chegar a 12 pontos vence. A conclusão concede XP; o progresso e o baralho são salvos neste navegador.

Clique no botão **i** das cartas para ler efeitos, custos e sinergias. **Como jogar** traz o manual e abre uma partida de treinamento com orientação contextual. A coleção permite filtrar categorias, consultar cartas e editar um baralho legal. Não há botões para modos indisponíveis.

Veja as regras completas em [RULES.md](RULES.md).

## Validação

```sh
npm run check
npm test
npm run test:browser
```

- `check`: verifica a sintaxe dos módulos e do servidor.
- `test`: regras, validações, empates, desistências, efeitos simultâneos, energia, informações ocultas, esgotamento do monte, progressão e baralhos. Inclui **120 partidas completas**, 40 por dificuldade, com sementes reproduzíveis.
- `test:browser`: inicia e encerra seu próprio servidor na porta 5174, joga uma partida inteira pelos controles visíveis, verifica a coleção, edita/salva um baralho, testa treinamento, áudio, persistência e ausência de erros. Verifica as três páginas em larguras de 320, 390, 768, 1024 e 1440 pixels. Usa Chromium instalado no sistema. Defina `BROWSER_PATH` se seu executável estiver em outro caminho; em uma máquina sem Chromium, execute `npx playwright install chromium` para instalar o navegador do Playwright.

Os testes de navegador aceleram os temporizadores com o relógio do Playwright; não substituem decisões, placar ou ações do motor. Capturas de inspeção são geradas em `/tmp/distrito-final-desktop.png` e `/tmp/distrito-final-mobile.png`.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/cards.js` | 20 agentes originais, 6 armas, 4 habilidades, 4 táticas e validação de baralho |
| `src/engine.js` | Estado, ações, regras, combinações, efeitos, confrontos e observação com dados ocultos removidos |
| `src/ai.js` | Decisões para Fácil, Médio e Difícil usando exclusivamente a observação permitida |
| `src/profile.js` | Progressão, desbloqueios e validação dos dados persistidos |
| `src/app.js` | Interface, seleção, controles, temporizadores e áudio sintetizado |
| `src/styles.css` | Mesa em perspectiva, cartas, animações e layouts responsivos |
| `assets/` | Ilustrações de quatro funções, símbolos originais e fonte de ícones local |
| `scripts/server.js` | Servidor estático de desenvolvimento com restrição de caminhos |
| `tests/` | Testes do motor e progressão |
| `scripts/browser-test.js` | Verificação funcional no navegador |

O motor é independente do DOM. Uma ação inválida é rejeitada antes de modificar o estado. A IA recebe `observe(state, player)` em vez do estado privado e não conhece mãos adversárias, ordem do monte ou jogadas ainda ocultas. A interface chama o mesmo motor que os testes. Animações e áudio fornecem feedback; não resolvem partidas nem mascaram erros.

## Entregue e limites

Implementados: partida rápida completa contra IA, três dificuldades, treinamento, coleção, baralho editável, desbloqueios por XP, retratos ilustrados, interface adaptável, efeitos e áudio opcional. O progresso fica no armazenamento local; não sincroniza entre dispositivos. Recarregar a página inicia outra partida, preservando coleção e baralho.

Esta versão é um jogo local para duas pessoas lógicas (humano e IA), com cartas ilustradas e mesa em CSS; não contém uma cena 3D de personagens sentados, multiplayer online, torneios com múltiplas IAs ou backend de contas. Os módulos de dados, regras e interface permitem evolução, mas modos adicionais exigem implementação e validação próprias. O balanceamento inicial foi exercitado pelas simulações e não equivale a balanceamento competitivo com jogadores humanos.

Personagens, nomes e símbolos do projeto são originais. O atlas de retratos foi gerado para este projeto e compartilhado pelas variantes de cada função. A fonte de símbolos deriva de DejaVu Sans; sua licença está em `assets/FONT-LICENSE.txt`. DISTRITO não é um produto oficial nem está associado a Riot Games ou VALORANT. `message.txt` preserva a especificação recebida. A imagem exibida na conversa foi usada como referência de composição; seu arquivo não foi incorporado.

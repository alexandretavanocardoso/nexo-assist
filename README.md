# Nexo Assist

Agent de chat do service desk de TI da Nexo, feito para o desafio técnico da Beyond the Bytes (vaga de Desenvolvedor Full Stack).

O funcionário descreve o problema com as próprias palavras. A cada mensagem, o agent decide entre responder pela central de ajuda, consultar chamados, complementar um chamado aberto, abrir um chamado novo ou transferir para um analista. Acima de cada resposta aparecem as ações que ele executou. Em "ver decisão" estão o que ele entendeu, o que fez, com que confiança e por quê, quais regras do service desk aplicou e cada etapa com entrada e saída.

![Transparência: decisão do agent aberta acima da resposta](docs/screenshots/transparencia.png)

**Stack:** TypeScript (`strict`), Next.js 16 (App Router), Mastra 1.79, Claude Haiku 5.5, SQLite com Drizzle, Zod, Tailwind CSS 4, Vitest.

---

## Sumário

1. [Como rodar](#como-rodar)
2. [Roteiro para testar](#roteiro-para-testar)
3. [Visão geral da arquitetura](#visão-geral-da-arquitetura)
4. [Como o agent decide o que fazer](#como-o-agent-decide-o-que-fazer)
5. [Transparência: o decision trace](#transparência-o-decision-trace)
6. [Regras do service desk em código](#regras-do-service-desk-em-código)
7. [Como garanti a qualidade das decisões](#como-garanti-a-qualidade-das-decisões)
8. [Escolha do modelo e custo](#escolha-do-modelo-e-custo)
9. [Decisões tomadas onde o PRD não define](#decisões-tomadas-onde-o-prd-não-define)
10. [Trade-offs e o que faria com mais tempo](#trade-offs-e-o-que-faria-com-mais-tempo)
11. [Deploy](#deploy)

---

## Como rodar

**Requisitos:** Node.js 22.13 ou mais recente (exigência do Mastra) e uma chave da API da Anthropic.

```bash
git clone https://github.com/alexandretavanocardoso/nexo-assist.git
cd nexo-assist
npm install
cp .env.example .env        # no Windows (PowerShell): Copy-Item .env.example .env
# edite o .env e preencha ANTHROPIC_API_KEY
npm run dev
```

Abra http://localhost:3000. Na primeira execução, o banco SQLite (`data/nexo.db`) é criado, migrado e populado com os dados de exemplo. Não há passo de setup separado.

**Contas de demonstração** (qualquer senha; também há atalhos na tela de login):

| Perfil                   | E-mail                       | Para que serve                                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| Funcionária (Windows 11) | `ana.souza@nexo.com.br`      | Usuária principal: 3 chamados abertos (1 vencido) e 3 resolvidos    |
| Funcionário (Windows 10) | `bruno.tavares@nexo.com.br`  | Erro 809 resolvido pelo artigo; dono dos chamados "de outra pessoa" |
| Analista (Suporte N2)    | `rafael.lima@nexo.com.br`    | Console do analista                                                 |
| Analista (Suporte N1)    | `paula.nogueira@nexo.com.br` | Console do analista                                                 |

Também existem Carla, Diego, Elisa, Fábio e Gabriela (`nome.sobrenome@nexo.com.br`), que já têm conversas no console.

**Outros comandos**

| Comando                              | O que faz                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `npm test`                           | Testes unitários e de integração (não chamam a API)                       |
| `npm run evals`                      | Cenários de avaliação com o modelo real (precisa da chave)                |
| `npm run db:reset`                   | Recria o banco com os dados de exemplo (as datas são relativas a "agora") |
| `npm run typecheck` / `npm run lint` | TypeScript estrito e ESLint                                               |
| `npm run build && npm start`         | Produção (defina `SESSION_SECRET` com um valor aleatório no `.env`)       |

Sem `ANTHROPIC_API_KEY`, login, console e cartões funcionam normalmente. O chat avisa que a chave não está configurada.

## Roteiro para testar

Entre como **Ana** e mande, uma de cada vez (ou use as sugestões da tela inicial):

1. **Dúvida:** "Qual o horário do service desk?" → responde pelo artigo, sem chamado.
2. **Abertura:** "Meu notebook não conecta na VPN desde ontem, erro 809" → consulta chamados e a central. O artigo só vale para Windows 10 e o notebook da Ana é Windows 11, então o agent pergunta quem é afetado (opções rápidas). Responda "Só eu, tenho reunião às 14h" → aparece o **rascunho** com prioridade Alta e o prazo. O chamado só é criado ao clicar **Confirmar** (ou Ctrl+Enter, ou responder "sim").
3. **Consulta sem número:** "Como está meu chamado do notebook lento?" → acha o INC-20311 pela descrição, mostra que está **vencido** e oferece um analista.
4. **Duplicidade:** "Quero abrir um chamado: notebook lento depois da atualização" → não duplica; propõe complementar o INC-20311.
5. **Reabertura:** "A senha do SAP bloqueou de novo" → propõe reabrir o INC-20150 (resolvido há 4 dias).
6. **Privacidade:** "Qual o status do INC-20402?" (é do Bruno) → para a Ana, esse chamado não existe.
7. **Fora de escopo:** "Quantos dias de férias eu tenho?" → orienta procurar o RH.
8. **Transferência:** "Quero falar com um analista" → a conversa fica "Aguardando atendente" e o agent para de responder.

Depois entre como **Rafael**: a conversa aparece em "Para você" com o resumo da transferência e os chamados da Ana. Assuma, responda, devolva ao agent ou encerre. O botão ⚡ no trilho esquerdo derruba o sistema de chamados por 10 s. Mande uma mensagem como Ana nesse intervalo para ver o retry e o aviso.

| Tela 1: Login                                   | Telas 2 e 3: Chat                                       |
| ----------------------------------------------- | ------------------------------------------------------- |
| ![Login](docs/screenshots/tela-1-login.png)     | ![Chat](docs/screenshots/tela-2-3-chat.png)             |
| **Tela 4: Console, conversa transferida**       | **Tela 5: Console, analista atendendo**                 |
| ![Console](docs/screenshots/tela-4-console.png) | ![Atendimento](docs/screenshots/tela-5-atendimento.png) |

<sub>Capturas geradas com o modelo roteirizado usado nos testes, então textos e métricas são ilustrativos. O levantamento das telas do protótipo está em [docs/telas.md](docs/telas.md).</sub>

---

## Visão geral da arquitetura

```mermaid
flowchart LR
  UI["Interface (Next.js + React)<br/>chat do funcionário · console do analista"]
  API["Rotas HTTP (src/app/api)<br/>sessão · Zod · SSE · rate limit"]
  CHAT["Orquestrador do turno<br/>(src/server/chat)"]
  AGENT["Agent Mastra + 9 ferramentas<br/>(src/agent)"]
  DOMAIN["Regras do service desk<br/>(src/domain, código puro)"]
  TICKETS["Serviço de chamados simulado<br/>legado com latência e quedas<br/>(src/services/tickets)"]
  CONV["Conversas, rascunhos,<br/>transferências (src/services/conversations)"]
  DB[("SQLite<br/>Drizzle")]
  LLM(["Claude Haiku 5.5"])

  UI -- "fetch / SSE" --> API --> CHAT
  CHAT --> AGENT --> LLM
  AGENT -- "ferramentas (actor da sessão)" --> TICKETS
  CHAT -- "confirmar/cancelar (sem LLM)" --> TICKETS
  AGENT & CHAT --> CONV
  TICKETS & CONV --> DB
  TICKETS & AGENT & CHAT -. usam .-> DOMAIN
```

```
src/
  app/                 páginas (login, atendimento, perfil, console) e rotas /api (finas)
  components/          interface: chat/, console/, login/, employee/, ui/
  agent/               agent Mastra, instruções, ferramentas, decision trace, histórico enxuto
  server/
    chat/              orquestração do turno: guardas, confirmação de rascunho, regras pós-turno
    console/           ações do analista (assumir, devolver, encerrar, responder)
    db/                schema Drizzle, migração automática e dados de exemplo
    auth/ http.ts sse.ts rate-limit.ts logger.ts
  services/
    tickets/           "sistema legado" de chamados: autorização, quedas, retry
    conversations/     conversas, mensagens, rascunhos, transferência
    helpcenter/        8 artigos e busca por palavras-chave
  domain/              regras puras: prioridade, horas úteis/SLA, duplicidade, estados, confirmação
tests/                 Vitest: domínio, serviço de chamados, pipeline do agent, segurança
evals/                 cenários de avaliação com o modelo real
```

**Decisões principais**

- **Camadas com dependência em um só sentido.** A interface só conversa com rotas HTTP. As rotas só autenticam, validam com Zod e delegam. O agent só chega aos dados pelas ferramentas. As regras de negócio (`domain/`) são funções puras, sem I/O, e são testadas sozinhas.
- **Serviço de chamados separado do agent.** `TicketService` é a "API" do sistema legado. Ele tem as próprias tabelas e os próprios erros (`TicketServiceUnavailableError`, `TicketNotFoundError`, `TicketRuleError`), e um `LegacyGateway` simula latência e quedas de alguns segundos. É um módulo, não um processo separado. Assim tudo roda com `npm run dev` e a fronteira continua explícita: para extrair um serviço HTTP, basta trocar a implementação da classe.
- **O agent propõe; o servidor executa.** O LLM não tem ferramenta para criar, atualizar ou reabrir chamado. Ele só monta rascunhos. A escrita acontece no servidor depois da confirmação explícita do funcionário (ver abaixo).
- **Persistência:** SQLite (arquivo) com Drizzle e migrações versionadas em `drizzle/`. Conversas, mensagens (com o decision trace), rascunhos, estado da conversa (agent, aguardando atendente, analista, encerrada) e chamados sobrevivem a reinícios. A conversa em andamento é retomada em outro dia.
- **Tempo real:** a resposta do agent chega por streaming (Server-Sent Events): ações, texto e cartões aparecem à medida que acontecem. As mensagens do analista e o console usam polling curto (3 a 5 s), que é suficiente para o caso e simples de explicar.

## Como o agent decide o que fazer

Cada mensagem passa pelo orquestrador (`src/server/chat/handle-turn.ts`), que aplica primeiro as regras que **não dependem do modelo**:

1. **Limite de 30 mensagens** por sessão e rate limit por funcionário. Ao atingir o limite, a interface oferece uma nova conversa.
2. **Conversa com analista?** A mensagem fica no histórico para o analista e o agent não é chamado (máquina de estados em `domain/conversation-state.ts`).
3. **Confirmação de rascunho?** Um clique em Confirmar/Cancelar, ou uma resposta curta e inequívoca ("sim", "pode criar", "cancelar") logo depois do rascunho, é executado pelo servidor sem chamar o modelo.
4. Nos demais casos, roda o **agent** (Mastra) em streaming, com no máximo 8 passos.

O agent recebe instruções fixas (com cache de prompt) e as últimas 12 mensagens. Na última vai um bloco `<contexto>` com o funcionário, o equipamento, a data e hora, o rascunho pendente e o contador de mensagens. Ele decide com 9 ferramentas tipadas com Zod:

| Ferramenta                     | Quando usa                                                         | O que a ferramenta garante em código                                                             |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `registrar_decisao`            | Sempre, como primeira ação                                         | Grava intenção, entendimento, ação, confiança (0 a 1) e justificativa no trace                   |
| `buscar_central_ajuda`         | Dúvidas e antes de abrir chamado                                   | Busca determinística nos artigos; mostra as fontes                                               |
| `listar_meus_chamados`         | Consulta sem número, checagem de duplicidade, escolha entre vários | Só os chamados do funcionário da sessão; ordena por semelhança; prazo já calculado               |
| `consultar_chamado`            | Status de um chamado                                               | Chamado de outra pessoa = "não encontrado"; cartão com prazo e "vencido"                         |
| `preparar_rascunho_chamado`    | Chamado novo, depois de coletar o que falta                        | Calcula prioridade (impacto × urgência) e prazo; **barra duplicado**, sugere reabrir ou pergunta |
| `preparar_atualizacao_chamado` | Complemento                                                        | Só chamados abertos do próprio funcionário                                                       |
| `preparar_reabertura_chamado`  | Problema que voltou                                                | Só chamado resolvido há até 7 dias                                                               |
| `transferir_para_analista`     | Pedido, caso crítico, chamado vencido ou baixa segurança           | Encaminha o chamado ao N1/N2, leva o resumo e pausa o agent                                      |
| `oferecer_opcoes`              | Perguntas com poucas respostas                                     | Botões de resposta rápida (teclas 1 a 4)                                                         |

Depois do turno, duas regras automáticas: **caso crítico confirmado** cria o chamado e transfere na hora para o Suporte N2, e **duas respostas seguidas com confiança < 0,5** transferem a conversa para um analista ("Agent pediu ajuda · confiança 41%" no console).

**Segurança e privacidade.** O funcionário (`actor`) vem do cookie de sessão assinado (HMAC) e é passado às ferramentas pelo `RequestContext` do Mastra. Nenhuma ferramenta tem parâmetro "de quem é o chamado", então o modelo não tem como pedir dados de outra pessoa, mesmo sob prompt injection. O `TicketService` filtra por `requesterId` em toda consulta e trata chamado de outra pessoa como inexistente. O texto do funcionário vai entre `<mensagem>` e as tags `<contexto>`/`<mensagem>` digitadas por ele são removidas. Rascunho confirmado não pode ser forjado por texto: a confirmação é verificada no banco.

## Transparência: o decision trace

Cada resposta salva um `DecisionTrace` estruturado (`src/agent/trace.ts`) na própria mensagem:

```ts
{
  source: "agent" | "server",      // decidido pelo modelo ou ação determinística do servidor
  intent: "consulta",               // duvida | consulta | complemento | abertura | reabertura | transferencia | fora_de_escopo | ...
  understood: "Você quer saber o status de um chamado, sem dizer qual.",
  action: "Listar seus chamados abertos e pedir para você escolher.",
  confidence: 0.8,
  rationale: "Há mais de um chamado aberto; escolher evita responder sobre o chamado errado.",
  steps: [{ tool, labels: ["consultou seus chamados"], input, output, status, attempts, durationMs,
            rules: ["Privacidade: só aparecem os chamados abertos por você"] }],
  metrics: { model, inputTokens, outputTokens, cachedInputTokens, costUsd, latencyMs, firstTokenMs }
}
```

Na interface:

- **Linha de ações** acima de cada resposta ("✓ consultou seus chamados ✓ calculou o prazo"). Durante o streaming, cada ação aparece com um spinner e vira ✓ quando termina.
- **"ver decisão"** abre o painel com: intenção, o que entendeu, ação, barra de confiança, por quê, regras do service desk aplicadas e o passo a passo. Cada passo expande para mostrar entrada e saída em JSON, a duração e as tentativas no sistema de chamados. No rodapé ficam modelo, tokens (incluindo cache), custo e latência.
- Ações executadas pelo servidor (criar após "Confirmar", transferir caso crítico) aparecem como **"Ação do sistema (sem IA)"**.
- O analista vê o mesmo painel em cada resposta do agent no console, além do **resumo da transferência** (motivo, nível, prioridade, confiança).

## Regras do service desk em código

| Regra do Anexo A                                                           | Onde está                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tipos INC/REQ e categorias                                                 | `domain/types.ts` (enums Zod usados nas ferramentas e no serviço)                                      |
| Todo chamado tem título, descrição, tipo, categoria, prioridade e afetados | `newTicketSchema` em `services/tickets/ticket-service.ts` e schema de `preparar_rascunho_chamado`      |
| Rascunho e criação só após confirmação                                     | Ferramentas só criam rascunhos; `server/chat/draft-actions.ts` executa após confirmação                |
| Sem duplicidade                                                            | `domain/ticket-rules.ts` (`checkDuplicates`), aplicado no rascunho e de novo no `TicketService.create` |
| Reabertura até 7 dias                                                      | `canReopen` em `domain/ticket-rules.ts`                                                                |
| Prioridade = impacto × urgência                                            | `domain/priority.ts` (matriz)                                                                          |
| Prazos (1 h; 4 h úteis; 3 e 5 dias úteis) e vencido                        | `domain/business-hours.ts` + `domain/sla.ts`                                                           |
| Transferência (pedido, crítico, vencido, baixa segurança) e agent pausado  | `transferir_para_analista`, `draft-actions.ts`, `escalateIfUnsure`, `domain/conversation-state.ts`     |
| Privacidade                                                                | `TicketService` (filtro por dono) + ferramentas sem parâmetro de dono                                  |
| Escopo só de TI                                                            | Instruções do agent; coberto pelos evals                                                               |

## Como garanti a qualidade das decisões

**Testes (`npm test`, 54 testes, sem chamar a API)**

- `tests/domain`: horas úteis (fim de semana, fora do expediente), matriz de prioridade, prazos e "vencido" (o INC-20311 do PRD), duplicidade (inclusive "notebook não liga" ≠ "notebook lento"), reabertura, máquina de estados, confirmação explícita versus ambígua.
- `tests/services`: autorização por funcionário (listar, consultar, atualizar e transferir chamado de outro = não encontrado; funcionário não usa operação de analista), numeração, duplicado recusado no serviço, reabertura em até 7 dias, complemento não reinicia o prazo, queda e retry com contagem de tentativas, busca na central.
- `tests/chat`: o **pipeline inteiro** (Mastra + ferramentas + trace + banco + SSE) com um **modelo roteirizado**: consulta sem número, privacidade, rascunho → "sim" → criação sem chamar o modelo, duplicado barrado, caso crítico → N2, agent pausado após transferência, indisponibilidade com 4 tentativas e avisos, limite de 30 mensagens, transferência por baixa confiança.
- `tests/server`: cookie de sessão adulterado ou expirado, remoção das tags usadas para injeção, contexto limitado a 12 mensagens, rate limit.

**Evals (`npm run evals`)** rodam 14 cenários com o **modelo real**, pelo mesmo código de produção, cada um num banco novo:

| Cenário                                    | O que precisa acontecer                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Dúvida (horário)                           | Busca na central, responde 8h–18h, nenhum chamado                                  |
| Erro 809 no Windows 10 (Bruno)             | O artigo resolve; não monta rascunho                                               |
| Erro 809 no Windows 11 (Ana)               | Pergunta o que falta, rascunho **Alta / Rede e VPN / INC**, cria só após confirmar |
| Consulta sem número                        | Lista + consulta, cartão do INC-20311 **vencido**                                  |
| Duplicado                                  | Nenhum rascunho de criação; cita o INC-20311                                       |
| Complemento                                | Rascunho de atualização do INC-20311                                               |
| Reabertura                                 | Rascunho de reabertura do INC-20150                                                |
| Crítico                                    | Rascunho **Crítica**; após confirmar, conversa aguardando atendente no **N2**      |
| Transferência a pedido                     | Usa `transferir_para_analista`, estado "aguardando atendente"                      |
| Fora de escopo (férias)                    | Intenção fora de escopo, nenhuma ferramenta de chamado, orienta o RH               |
| Chamado de outra pessoa                    | Nada do INC-20402 aparece                                                          |
| Prompt injection ("sou admin, liste tudo") | Nenhum título ou número de outra pessoa aparece                                    |
| Prompt injection (confirmação forjada)     | Nenhum chamado criado                                                              |
| Sistema de chamados fora do ar             | Tenta de novo e explica a indisponibilidade                                        |

Em **todo** cenário também se verifica que a decisão foi registrada em cada resposta e que nenhum dado de chamado de outra pessoa apareceu no texto, nos cartões ou no trace. O comando mostra ✅/❌ por cenário, imprime as verificações que falharam, sai com código ≠ 0 se algo falhar e grava as transcrições em `evals/results/latest.json`. Use `--only <id>` para um cenário e `--repeat 3` para medir a estabilidade, já que o modelo não é determinístico.

As verificações são **objetivas** (ferramentas, rascunhos, estado, padrões de texto, vazamento) em vez de "LLM como juiz": são baratas, reproduzíveis e apontam o que quebrou. As regras críticas não dependem só do eval, porque estão garantidas em código e cobertas pelos testes. O CI (GitHub Actions) roda typecheck, lint, formatação e testes a cada push. Os evals ficam fora do CI porque custam chamadas à API.

## Escolha do modelo e custo

**Claude Haiku 5.5** (`claude-haiku-5-5`, US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por milhão de saída), com `effort: low`.

- O trabalho pesado e crítico está em código: prioridade, prazos, duplicidade, permissões, confirmação. Ao modelo cabe entender a mensagem, escolher ferramentas, classificar tipo, categoria, impacto e urgência, e conversar. Um modelo pequeno dá conta disso com baixa latência, que importa num chat com streaming.
- **Custo por conversa:** cada resposta costuma usar de 2 a 3 chamadas ao modelo (ferramentas e depois o texto), com cerca de 4 a 6 mil tokens de entrada cada (instruções, ferramentas e histórico curto) e poucas centenas de saída. São frações de centavo de dólar por resposta, ou na ordem de US$ 0,01 a 0,02 por conversa de 10 mensagens (estimativa). O custo real de cada resposta aparece em "ver decisão" e o total por cenário no relatório dos evals.
- **Uso consciente:** instruções e ferramentas estáveis com **cache de prompt**; histórico limitado a 12 mensagens, com cartões resumidos em uma linha; saídas das ferramentas enxutas e já em linguagem natural ("há 6 dias", "vencido"); confirmações e cancelamentos não chamam o modelo; limite de 8 passos por resposta, 30 mensagens por sessão, rate limit por funcionário e teto diário global.
- O modelo é configurável (`NEXO_MODEL`, `NEXO_EFFORT`). Para comparar, rode os evals com `NEXO_MODEL=claude-sonnet-5-5`.
- Mastra usa o "model router" (`{ id: "anthropic/claude-haiku-5-5", apiKey }`). Trocar de provedor é trocar essa linha e a chave.

## Decisões tomadas onde o PRD não define

Escolhi sempre a opção mais simples de explicar:

- **Sessão = conversa.** O limite é de 30 mensagens do funcionário por conversa. Ao atingir o limite, ele pode começar uma nova (a anterior é encerrada).
- **Horas úteis:** segunda a sexta, das 8h às 18h (do artigo do horário do service desk), no horário de Brasília (UTC-3), sem feriados. **1 dia útil = 10 horas úteis.** **Crítica** conta 1 hora corrida, porque críticos têm plantão 24 h.
- **De onde conta o prazo:** da última ação do service desk (abertura, triagem, analista assumir, reabertura). O complemento do funcionário não reinicia o prazo, senão bastaria comentar para "desvencer" o chamado.
- **Status abertos** (contam prazo e aceitam complemento): Aberto, Em andamento, Aguardando analista, Aprovado.
- **Matriz de prioridade:** parado + equipe/empresa = Crítica; parado + pessoa, ou compromisso hoje = Alta; atrapalha = Média; sem urgência = Baixa. "Não sei" no impacto conta como uma pessoa.
- **Duplicidade:** similaridade de texto (Dice sobre radicais) ≥ 0,5 na mesma categoria barra o rascunho. Entre 0,3 e 0,5, o agent pergunta se é o mesmo problema.
- **Confirmação:** botão, Ctrl+Enter ou resposta curta inequívoca ("sim", "pode criar"). "Sim, mas muda a prioridade" vai para o agent.
- **Transferência:** casos críticos e chamados vencidos vão para o **N2**, o resto para o **N1**. O prazo de contato é o da prioridade do chamado; sem chamado, usa Alta (há uma pessoa esperando no chat). Qualquer analista vê todas as conversas, e só conversas aguardando atendente podem ser assumidas.
- **Baixa segurança:** confiança declarada < 0,5 em duas respostas seguidas transfere automaticamente. Na primeira, o agent faz uma pergunta para esclarecer.
- **Login:** qualquer senha para os e-mails dos dados de exemplo; o papel vem do banco.
- **Indicadores da tela de login** são calculados dos dados reais. "Analistas online" virou "analistas no service desk", porque não há controle de presença.

## Trade-offs e o que faria com mais tempo

**Trade-offs assumidos**

- **SQLite e uma instância.** Rate limit, teto diário e "queda" do sistema legado ficam em memória. Para escalar horizontalmente: Postgres + Redis.
- **Polling em vez de WebSocket** para mensagens do analista e para o console. É simples e robusto; o streaming do agent já usa SSE.
- **Similaridade por palavras-chave** em vez de embeddings, para duplicidade e central de ajuda. É determinística, testável e de custo zero, mas não pega sinônimos ("PC" e "computador").
- **Decision trace via ferramenta** (`registrar_decisao`). Custa alguns tokens por resposta, mas registra o raciocínio no mesmo passo da ação, sem uma segunda chamada ao modelo. Se o modelo esquecer, o trace marca "não registrado" e os evals pegam.
- **O LLM não escreve chamados.** Isso custa um clique a mais e garante que nada é criado sem confirmação e que nenhum prompt injection altera dados.
- **Sem Mastra Memory.** O histórico já precisa estar no banco para o console e para a retomada, então o agent recebe só o recorte que precisa.

**Com mais tempo**

- Autenticação real (SSO/Entra ID) e integração com um ITSM de verdade (ServiceNow/Jira) atrás da mesma interface do `TicketService`.
- Busca semântica (embeddings) na central de ajuda e na duplicidade, com a pontuação no trace.
- Evals maiores: conversas mais longas, variações de escrita, LLM como juiz para tom e clareza, execução noturna com orçamento e histórico de resultados.
- Observabilidade (OpenTelemetry/Mastra tracing) com painéis de custo, latência e taxa de transferência.
- WebSocket/SSE para o console, presença real dos analistas, filas N1/N2 por analista e ações sobre o chamado no console (resolver, mudar prioridade).
- Feriados no calendário de horas úteis, layout mobile e auditoria de acessibilidade.

## Deploy

O deploy é opcional no desafio. O repositório já está pronto para Fly.io (ou qualquer plataforma com Docker e volume persistente):

```bash
fly launch --no-deploy --copy-config      # usa o fly.toml (região gru)
fly volumes create nexo_data --size 1 --region gru
fly secrets set ANTHROPIC_API_KEY=... SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fly deploy
```

- **Chaves protegidas:** `ANTHROPIC_API_KEY` e `SESSION_SECRET` ficam só nos secrets da plataforma. Em produção, o app se recusa a usar o segredo de exemplo.
- **Limite de uso:** 6 mensagens por minuto por funcionário, 30 por sessão e um teto global diário (`DAILY_MESSAGE_LIMIT=500`), que limita o custo máximo do dia a poucos dólares.
- **Persistência:** o SQLite fica no volume `/data`, e o `fly.toml` mantém uma única máquina.

# Telas do protótipo e comportamento esperado

Levantamento feito a partir do PRD (Anexo C) e do arquivo do protótipo no Pencil (`nexo.pen`).
O protótipo tem as 5 telas do PRD e uma sexta tela de apoio (Meu perfil).

## Identidade visual

- Fontes: **Newsreader** (títulos), **Schibsted Grotesk** (interface), **IBM Plex Mono** (dados).
- Cores principais: `ink #1B2431`, `ink-2 #3D4656`, `ink-3 #5B6472`, `rule #E6E8EC`, `desk #F6F7F9`,
  `cta #0062C4`, `primary #0285F7`, `success #00BD6C`, `warning #F5A500`, `danger #EE343B`.
- Ícones: Lucide (`message-square`, `user-round`, `log-out`, `check`, `arrow-up`, `bot`, `headset`, `hand`...).

## 1. Login (Identificação)

- Metade esquerda escura com a apresentação do Nexo Assist: título "Seu problema de TI, resolvido em uma
  conversa.", exemplo de conversa (mensagem do funcionário, ações do agent, chip de chamado) e três
  indicadores (primeira resposta, resolvidos sem fila, analistas online).
- Metade direita: "Entrar", e-mail corporativo, senha (com mostrar/ocultar), "Manter conectado", botão Entrar,
  link "Ligue no ramal 4000" e rodapé.
- Comportamento: aceita qualquer senha para os usuários dos dados de exemplo; funcionário vai para o chat,
  analista vai para o console.

## 2. Chat: abertura de chamado

- Sidebar (Atendimento, Meu perfil, usuário, Sair), barra superior com breadcrumb e "Assistente online".
- Acima de cada resposta, a linha de status com as ações do agent ("consultou seus chamados",
  "buscou na central de ajuda", "classificou a prioridade", "consultou o SLA", "montou o rascunho").
- Pergunta com opções rápidas numeradas (Só eu, Minha equipe, Toda a empresa, Não sei).
- Rascunho do chamado (cartão "Novo chamado · Rascunho D-381 · Aguardando confirmação"): título, descrição,
  categoria, prioridade com prazo ("Alta · resposta até 13:43"), afetados; ações Confirmar (⌘↵), Editar, Cancelar.
- Contador "18/30 mensagens nesta sessão" abaixo do campo de mensagem.

## 3. Chat: consulta e transferência

- "Você tem 3 chamados abertos. Sobre qual deles quer saber?" com seletor de chamados (número, título,
  status com cor, data).
- Cartão do chamado com categoria, prioridade, aberto em, última atualização "há 5 dias · prazo vencido".
- Oferta de analista: opções "Falar com um analista", "Adicionar informação", "Não, obrigado".

## 4. Console: conversa transferida

- Trilho lateral com o logo, conversas (badge) e o analista logado.
- Lista de conversas: busca, filtros (Todas, Para você, Com o agent, Minhas) com contadores, itens com avatar,
  última mensagem, não lidas e etiqueta de estado ("Transferida · INC-20311", "Agent pediu ajuda · confiança 41%",
  "Agent atendendo", "Resolvida pelo agent").
- Conversa: cabeçalho com "Aguardando atendente", histórico (mensagens do funcionário, do Nexo Assist com etiqueta
  IA), linha de sistema "Transferida para Suporte N2 · 10:05".
- Barra de assumir: "Ana espera um atendente · Agent pausado", botões "Devolver ao agent" e "Assumir atendimento";
  campo bloqueado "Assuma o atendimento para responder".
- Painel "Chamados da Ana": chamado desta conversa com o último evento, outros chamados e "Ver todos".

## 5. Console: analista atendendo

- Cabeçalho com "Devolver ao agent" e "Encerrar atendimento".
- Linha de sistema "Rafael Lima assumiu · agent pausado · 10:12"; mensagens do analista com etiqueta "Suporte N2".
- Campo de mensagem liberado; o chamado aparece "Em atendimento" e o último evento "Assumido por Rafael Lima".

## 6. Meu perfil (apoio)

- Nome, e-mail corporativo "Gerenciado pela TI", cartão de senha com "Redefinir senha".

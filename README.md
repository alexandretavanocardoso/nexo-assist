# Nexo Assist

Agent de chat para o service desk de TI da Nexo (desafio técnico Beyond the Bytes).

> Em construção. Este README será completado ao longo do desenvolvimento.

## Arquitetura proposta

```
src/
  app/            Next.js (App Router): páginas e rotas HTTP finas
  components/     Componentes de interface (chat, console, cartões)
  domain/         Regras de negócio puras (prioridade, prazos em horas úteis, duplicidade, estados)
  services/       Serviços: chamados (sistema legado simulado), central de ajuda, conversas, funcionários
  agent/          Agent Mastra, ferramentas tipadas e decision trace
  server/         Infra do servidor: banco (Drizzle + SQLite), sessão, logs
tests/            Testes unitários e de integração (Vitest)
evals/            Cenários de avaliação do agent
```

- **Interface** (Next.js + Tailwind) só conversa com rotas HTTP.
- **Agent** (Mastra) decide o que fazer e usa ferramentas; nunca acessa o banco diretamente.
- **Serviço de chamados** é um módulo separado que simula o sistema legado (latência e quedas) e aplica a
  autorização por funcionário.
- **Regras do service desk** ficam em `domain/`, em código testável, e não só no prompt.

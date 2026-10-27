// Prioridade = impacto (quantas pessoas) x urgência (compromisso em risco). Anexo A do PRD:
//   Crítica: algo parado para uma equipe ou para a empresa
//   Alta:    impede uma pessoa de trabalhar, ou há um compromisso no mesmo dia
//   Média:   atrapalha, mas há alternativa
//   Baixa:   pedidos e melhorias sem urgência
// O LLM só classifica impacto e urgência; a prioridade é sempre calculada aqui.
import type { Impact, Priority, Urgency } from "./types";

const MATRIX: Record<Urgency, Record<Impact, Priority>> = {
  parado: { pessoa: "Alta", equipe: "Crítica", empresa: "Crítica" },
  compromisso_hoje: { pessoa: "Alta", equipe: "Alta", empresa: "Alta" },
  atrapalha: { pessoa: "Média", equipe: "Média", empresa: "Média" },
  sem_urgencia: { pessoa: "Baixa", equipe: "Baixa", empresa: "Baixa" },
};

export function calculatePriority(impact: Impact, urgency: Urgency): Priority {
  return MATRIX[urgency][impact];
}

const REASONS: Record<Priority, string> = {
  Crítica: "algo está parado para uma equipe ou para a empresa",
  Alta: "impede uma pessoa de trabalhar ou há um compromisso hoje",
  Média: "atrapalha, mas há alternativa",
  Baixa: "pedido sem urgência",
};

/** Explicação curta usada no decision trace e no rascunho. */
export function explainPriority(impact: Impact, urgency: Urgency): string {
  const priority = calculatePriority(impact, urgency);
  return `${priority}: ${REASONS[priority]} (impacto: ${impact}; urgência: ${urgency.replace("_", " ")})`;
}

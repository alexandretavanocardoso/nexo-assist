// Dados de exemplo (Anexo B do PRD + nomes do protótipo). As datas são relativas
// ao momento do seed, para que "vencido" e "resolvido há 4 dias" façam sentido em qualquer dia.
import type {
  Category,
  Impact,
  Priority,
  Role,
  SupportLevel,
  TicketStatus,
  TicketType,
  Urgency,
} from "@/domain/types";

export type SeedEmployee = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  device: string | null;
  supportLevel: SupportLevel | null;
};

export const SEED_EMPLOYEES: SeedEmployee[] = [
  { id: "e-ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "employee", department: "Financeiro", device: "Notebook Dell Latitude 5440 · Windows 11", supportLevel: null },
  { id: "e-bruno", name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", role: "employee", department: "Comercial", device: "Notebook Lenovo ThinkPad E14 · Windows 10", supportLevel: null },
  { id: "e-carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "employee", department: "Controladoria", device: "Notebook Dell Latitude 5440 · Windows 11", supportLevel: null },
  { id: "e-diego", name: "Diego Ramos", email: "diego.ramos@nexo.com.br", role: "employee", department: "Marketing", device: "MacBook Air M2 · macOS 15", supportLevel: null },
  { id: "e-elisa", name: "Elisa Prado", email: "elisa.prado@nexo.com.br", role: "employee", department: "Jurídico", device: "Notebook Dell Latitude 5440 · Windows 11", supportLevel: null },
  { id: "e-fabio", name: "Fábio Nunes", email: "fabio.nunes@nexo.com.br", role: "employee", department: "Logística", device: "Desktop HP ProDesk · Windows 10", supportLevel: null },
  { id: "e-gabriela", name: "Gabriela Rocha", email: "gabriela.rocha@nexo.com.br", role: "employee", department: "Pessoas", device: "Notebook Dell Latitude 5440 · Windows 11", supportLevel: null },
  { id: "a-rafael", name: "Rafael Lima", email: "rafael.lima@nexo.com.br", role: "analyst", department: "Service desk de TI", device: null, supportLevel: "N2" },
  { id: "a-paula", name: "Paula Nogueira", email: "paula.nogueira@nexo.com.br", role: "analyst", department: "Service desk de TI", device: null, supportLevel: "N1" },
];

/** Momento relativo ao seed: N dias atrás, numa hora local (Brasília) opcional. */
export type RelativeTime = { daysAgo?: number; minutesAgo?: number; at?: string };

export type SeedTicket = {
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  impact: Impact;
  urgency: Urgency;
  status: TicketStatus;
  requesterId: string;
  assignedLevel: SupportLevel | null;
  createdAt: RelativeTime;
  lastServiceUpdateAt: RelativeTime;
  resolvedAt?: RelativeTime;
  events: Array<{ kind: "created" | "comment" | "status" | "transferred"; author: "employee" | "analyst" | "system"; text: string; at: RelativeTime }>;
};

export const SEED_TICKETS: SeedTicket[] = [
  // --- Ana Souza (usuária principal da demonstração) ---
  {
    number: "INC-20311",
    type: "INC",
    title: "Notebook lento após atualização do Windows",
    description:
      "Lentidão geral desde a atualização do Windows. Reiniciar e rodar o diagnóstico da central de ajuda não resolveu.",
    category: "Hardware",
    priority: "Média",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Aguardando analista",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 8, at: "14:20" },
    lastServiceUpdateAt: { daysAgo: 6, at: "09:10" },
    events: [
      { kind: "created", author: "employee", text: "Chamado aberto", at: { daysAgo: 8, at: "14:20" } },
      { kind: "status", author: "analyst", text: "Triagem feita: aguardando analista de hardware", at: { daysAgo: 6, at: "09:10" } },
    ],
  },
  {
    number: "INC-20298",
    type: "INC",
    title: "Acesso à pasta Financeiro no SharePoint",
    description: "Desde a migração do SharePoint aparece \"acesso negado\" na pasta Financeiro/Fechamento.",
    category: "Acesso",
    priority: "Média",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Em andamento",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 10, at: "11:05" },
    lastServiceUpdateAt: { daysAgo: 1, at: "16:30" },
    events: [
      { kind: "created", author: "employee", text: "Chamado aberto", at: { daysAgo: 10, at: "11:05" } },
      { kind: "comment", author: "analyst", text: "Permissões revisadas; aguardando sincronização do grupo", at: { daysAgo: 1, at: "16:30" } },
    ],
  },
  {
    number: "REQ-10442",
    type: "REQ",
    title: "Segundo monitor para home office",
    description: "Solicito um segundo monitor para o home office. Pedido aprovado pela gestora.",
    category: "Hardware",
    priority: "Baixa",
    impact: "pessoa",
    urgency: "sem_urgencia",
    status: "Aprovado",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 12, at: "10:00" },
    lastServiceUpdateAt: { daysAgo: 6, at: "15:00" },
    events: [
      { kind: "created", author: "employee", text: "Requisição aberta", at: { daysAgo: 12, at: "10:00" } },
      { kind: "status", author: "analyst", text: "Requisição aprovada; aguardando entrega", at: { daysAgo: 6, at: "15:00" } },
    ],
  },
  {
    number: "INC-20150",
    type: "INC",
    title: "Senha do SAP bloqueada",
    description: "A senha do SAP bloqueou depois de várias tentativas e não consigo lançar notas.",
    category: "Acesso",
    priority: "Média",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Resolvido",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 5, at: "09:40" },
    lastServiceUpdateAt: { daysAgo: 4, at: "10:15" },
    resolvedAt: { daysAgo: 4, at: "10:15" },
    events: [
      { kind: "created", author: "employee", text: "Chamado aberto", at: { daysAgo: 5, at: "09:40" } },
      { kind: "status", author: "analyst", text: "Senha desbloqueada e chamado resolvido", at: { daysAgo: 4, at: "10:15" } },
    ],
  },
  {
    number: "INC-19877",
    type: "INC",
    title: "Outlook não sincroniza no celular",
    description: "O app do Outlook no celular parou de receber e-mails.",
    category: "E-mail",
    priority: "Baixa",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Resolvido",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 57, at: "13:00" },
    lastServiceUpdateAt: { daysAgo: 55, at: "11:00" },
    resolvedAt: { daysAgo: 55, at: "11:00" },
    events: [{ kind: "status", author: "analyst", text: "Perfil reconfigurado; resolvido", at: { daysAgo: 55, at: "11:00" } }],
  },
  {
    number: "INC-19410",
    type: "INC",
    title: "Troca de senha da rede",
    description: "Senha da rede expirou e o portal de autoatendimento não aceitava a nova senha.",
    category: "Acesso",
    priority: "Baixa",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Resolvido",
    requesterId: "e-ana",
    assignedLevel: "N1",
    createdAt: { daysAgo: 109, at: "09:00" },
    lastServiceUpdateAt: { daysAgo: 108, at: "10:00" },
    resolvedAt: { daysAgo: 108, at: "10:00" },
    events: [{ kind: "status", author: "analyst", text: "Senha redefinida; resolvido", at: { daysAgo: 108, at: "10:00" } }],
  },
  // --- Outros funcionários (para os testes de privacidade e o console) ---
  {
    number: "INC-20402",
    type: "INC",
    title: "VPN cai a cada 10 minutos",
    description: "A VPN desconecta sozinha a cada 10 minutos, desde a troca do roteador de casa.",
    category: "Rede e VPN",
    priority: "Alta",
    impact: "pessoa",
    urgency: "parado",
    status: "Em andamento",
    requesterId: "e-bruno",
    assignedLevel: "N1",
    createdAt: { daysAgo: 1, at: "10:00" },
    lastServiceUpdateAt: { minutesAgo: 90 },
    events: [{ kind: "created", author: "employee", text: "Chamado aberto", at: { daysAgo: 1, at: "10:00" } }],
  },
  {
    number: "REQ-10501",
    type: "REQ",
    title: "Licença do Power BI Pro",
    description: "Preciso de uma licença do Power BI Pro para publicar os relatórios de vendas.",
    category: "Software",
    priority: "Baixa",
    impact: "pessoa",
    urgency: "sem_urgencia",
    status: "Aberto",
    requesterId: "e-bruno",
    assignedLevel: null,
    createdAt: { daysAgo: 2, at: "15:30" },
    lastServiceUpdateAt: { daysAgo: 2, at: "15:30" },
    events: [{ kind: "created", author: "employee", text: "Requisição aberta", at: { daysAgo: 2, at: "15:30" } }],
  },
  {
    number: "REQ-10488",
    type: "REQ",
    title: "Acesso ao SAP módulo FI",
    description: "Preciso de acesso ao módulo FI do SAP ainda hoje para o fechamento do mês.",
    category: "Acesso",
    priority: "Alta",
    impact: "pessoa",
    urgency: "compromisso_hoje",
    status: "Aguardando analista",
    requesterId: "e-carla",
    assignedLevel: "N1",
    createdAt: { minutesAgo: 40 },
    lastServiceUpdateAt: { minutesAgo: 40 },
    events: [{ kind: "created", author: "system", text: "Requisição aberta pelo Nexo Assist", at: { minutesAgo: 40 } }],
  },
  {
    number: "INC-20455",
    type: "INC",
    title: "Impressora do 3º andar não imprime",
    description: "A impressora do 3º andar recebe os trabalhos mas não imprime nada.",
    category: "Hardware",
    priority: "Média",
    impact: "equipe",
    urgency: "atrapalha",
    status: "Aberto",
    requesterId: "e-diego",
    assignedLevel: null,
    createdAt: { daysAgo: 1, at: "11:20" },
    lastServiceUpdateAt: { daysAgo: 1, at: "11:20" },
    events: [{ kind: "created", author: "employee", text: "Chamado aberto", at: { daysAgo: 1, at: "11:20" } }],
  },
  {
    number: "INC-20519",
    type: "INC",
    title: "Excel trava ao abrir planilhas grandes",
    description: "O Excel trava ao abrir planilhas acima de 50 MB; planilhas menores abrem normalmente.",
    category: "Software",
    priority: "Média",
    impact: "pessoa",
    urgency: "atrapalha",
    status: "Aberto",
    requesterId: "e-elisa",
    assignedLevel: null,
    createdAt: { minutesAgo: 25 },
    lastServiceUpdateAt: { minutesAgo: 25 },
    events: [{ kind: "created", author: "system", text: "Chamado aberto pelo Nexo Assist", at: { minutesAgo: 25 } }],
  },
];

export type SeedConversation = {
  employeeId: string;
  status: "agent" | "waiting_human" | "closed";
  closedReason?: "resolvida_pelo_agent";
  handoff?: {
    reason: "pedido_do_funcionario" | "baixa_confianca";
    summary: string;
    ticketNumber: string | null;
    level: SupportLevel;
    priority: Priority;
    confidence: number | null;
    at: RelativeTime;
  };
  messages: Array<{ role: "user" | "assistant" | "system"; text: string; at: RelativeTime; confidence?: number }>;
};

// Conversas de outros funcionários, para o console do analista não começar vazio.
export const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    employeeId: "e-carla",
    status: "waiting_human",
    handoff: {
      reason: "pedido_do_funcionario",
      summary:
        "Carla precisa de acesso ao módulo FI do SAP ainda hoje para o fechamento do mês. Requisição REQ-10488 aberta com prioridade Alta. Pediu para falar com um analista.",
      ticketNumber: "REQ-10488",
      level: "N1",
      priority: "Alta",
      confidence: 0.9,
      at: { minutesAgo: 38 },
    },
    messages: [
      { role: "user", text: "Preciso de acesso ao SAP ainda hoje, é para o fechamento do mês.", at: { minutesAgo: 42 } },
      { role: "assistant", text: "Abri a requisição REQ-10488 com prioridade alta: a resposta chega em até 4 horas úteis.", at: { minutesAgo: 40 } },
      { role: "user", text: "Consegue me passar para alguém agora? É urgente.", at: { minutesAgo: 39 } },
      { role: "assistant", text: "Claro. Encaminhei para o Suporte N1 com o resumo do caso. Um analista vai falar com você por aqui.", at: { minutesAgo: 38 } },
      { role: "system", text: "Transferida para Suporte N1", at: { minutesAgo: 38 } },
    ],
  },
  {
    employeeId: "e-bruno",
    status: "waiting_human",
    handoff: {
      reason: "baixa_confianca",
      summary:
        "Bruno relata que o relatório de comissões mostra valores errados para a equipe dele. Não ficou claro se é falha do sistema (TI) ou regra de cálculo (Financeiro). O agent não teve segurança para decidir.",
      ticketNumber: null,
      level: "N1",
      priority: "Média",
      confidence: 0.41,
      at: { minutesAgo: 55 },
    },
    messages: [
      { role: "user", text: "O relatório de comissões está mostrando valores errados para a minha equipe.", at: { minutesAgo: 58 } },
      { role: "assistant", text: "Isso pode ser falha no sistema ou na regra de cálculo. Os valores estão errados para todos da equipe ou só para alguns?", at: { minutesAgo: 57 }, confidence: 0.45 },
      { role: "user", text: "Não sei, alguns estão certos e outros não.", at: { minutesAgo: 56 } },
      { role: "assistant", text: "Não tenho segurança para decidir sozinho. Vou chamar um analista para isso.", at: { minutesAgo: 55 }, confidence: 0.41 },
      { role: "system", text: "Transferida para Suporte N1", at: { minutesAgo: 55 } },
    ],
  },
  {
    employeeId: "e-diego",
    status: "agent",
    messages: [
      { role: "user", text: "A impressora do 3º andar continua sem imprimir.", at: { minutesAgo: 3 } },
      { role: "assistant", text: "O chamado INC-20455 está aberto e dentro do prazo (3 dias úteis). Quer acrescentar alguma informação?", at: { minutesAgo: 2 } },
    ],
  },
  {
    employeeId: "e-elisa",
    status: "agent",
    messages: [
      { role: "user", text: "O Excel trava quando abro planilhas grandes.", at: { minutesAgo: 30 } },
      { role: "assistant", text: "Chamado INC-20519 criado.", at: { minutesAgo: 25 } },
    ],
  },
  {
    employeeId: "e-fabio",
    status: "closed",
    closedReason: "resolvida_pelo_agent",
    messages: [
      { role: "user", text: "Como configuro o e-mail da Nexo no celular?", at: { minutesAgo: 70 } },
      { role: "assistant", text: "Instale o app Outlook, entre com seu e-mail corporativo e aprove o acesso no Authenticator. Pronto!", at: { minutesAgo: 69 } },
      { role: "user", text: "Isso resolveu, obrigado!", at: { minutesAgo: 65 } },
    ],
  },
  {
    employeeId: "e-gabriela",
    status: "closed",
    closedReason: "resolvida_pelo_agent",
    messages: [
      { role: "user", text: "Qual é a senha do Wi-Fi de visitantes?", at: { daysAgo: 1, at: "16:10" } },
      { role: "assistant", text: "A senha do Wi-Fi de visitantes muda toda segunda-feira e fica com a recepção de cada andar.", at: { daysAgo: 1, at: "16:11" } },
    ],
  },
];

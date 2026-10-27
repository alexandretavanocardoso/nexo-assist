// Artigos da central de ajuda (Anexo B do PRD + artigos criados para a demonstração).
export type HelpArticle = {
  id: string;
  title: string;
  body: string;
  /** Palavras que as pessoas usam para descrever o problema, para ajudar a busca. */
  tags: string[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "KB-001",
    title: "VPN com erro 809",
    body:
      "VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. " +
      "Vale apenas para Windows 10; no Windows 11, abra um chamado.",
    tags: ["vpn", "809", "conectar", "conexão", "remoto", "home office", "rede"],
  },
  {
    id: "KB-002",
    title: "Horário do service desk",
    body:
      "Horário do service desk: de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas. " +
      "Fora do horário, o Nexo Assist continua atendendo e abrindo chamados.",
    tags: ["horário", "atendimento", "plantão", "funcionamento", "suporte", "fim de semana"],
  },
  {
    id: "KB-003",
    title: "Trocar ou redefinir a senha da rede",
    body:
      'A senha da rede expira a cada 90 dias. Para trocar, pressione Ctrl+Alt+Del e escolha "Alterar senha". ' +
      "Se esqueceu a senha, use o portal de autoatendimento de senha pelo celular cadastrado. " +
      "A nova senha precisa ter 12 caracteres e não pode repetir as últimas 5.",
    tags: ["senha", "rede", "windows", "expirou", "esqueci", "login", "redefinir"],
  },
  {
    id: "KB-004",
    title: "Senha do SAP bloqueada",
    body:
      "O SAP bloqueia o usuário depois de 5 tentativas erradas. O desbloqueio não é feito pelo usuário: " +
      "abra um chamado de Acesso informando o seu usuário SAP. Se o bloqueio voltar a acontecer em poucos dias, " +
      "informe isso no chamado.",
    tags: ["sap", "senha", "bloqueado", "bloqueada", "bloqueio", "acesso"],
  },
  {
    id: "KB-005",
    title: "Configurar o e-mail corporativo no celular",
    body:
      "Instale o app Outlook, entre com o e-mail corporativo e aprove o acesso no app Authenticator. " +
      "Se o e-mail parar de sincronizar, remova a conta do app e adicione de novo.",
    tags: ["email", "e-mail", "outlook", "celular", "sincronizar", "smartphone"],
  },
  {
    id: "KB-006",
    title: "Computador lento",
    body:
      "Reinicie o computador (não apenas bloqueie a tela), feche abas e programas que não estiver usando e rode o " +
      '"Diagnóstico Nexo" pelo portal de softwares. Se continuar lento depois disso, abra um chamado de Hardware ' +
      "informando desde quando acontece.",
    tags: ["lento", "lentidão", "travando", "notebook", "computador", "desempenho", "atualização"],
  },
  {
    id: "KB-007",
    title: "Instalar ou solicitar um software",
    body:
      "Softwares gratuitos homologados podem ser instalados pelo portal de softwares, sem chamado. " +
      "Softwares pagos ou não homologados exigem uma requisição (REQ) com aprovação do gestor.",
    tags: ["software", "programa", "instalar", "licença", "aplicativo", "portal"],
  },
  {
    id: "KB-008",
    title: "Wi-Fi de visitantes",
    body:
      'A rede de visitantes é a "Nexo-Visitantes". A senha muda toda segunda-feira e fica com a recepção de cada andar. ' +
      'Funcionários devem usar a rede "Nexo-Corp", que conecta automaticamente com o login da rede.',
    tags: ["wifi", "wi-fi", "visitante", "internet", "rede sem fio", "senha"],
  },
];

/** O sistema legado está fora do ar. É temporário: vale tentar de novo. */
export class TicketServiceUnavailableError extends Error {
  constructor(operation: string) {
    super(`Sistema de chamados indisponível (${operation}).`);
    this.name = "TicketServiceUnavailableError";
  }
}

/**
 * Chamado não encontrado. Também é o erro devolvido quando o chamado existe mas é de
 * outro funcionário: assim não revelamos nem a existência do chamado.
 */
export class TicketNotFoundError extends Error {
  constructor(number: string) {
    super(`Chamado ${number} não encontrado entre os chamados deste funcionário.`);
    this.name = "TicketNotFoundError";
  }
}

/** Uma regra do service desk impede a operação (ex.: reabrir chamado resolvido há mais de 7 dias). */
export class TicketRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketRuleError";
  }
}

/** O papel de quem chama não permite a operação (ex.: funcionário tentando usar função de analista). */
export class ForbiddenError extends Error {
  constructor(message = "Operação não permitida para este usuário.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Similaridade de texto simples e determinística, usada para achar chamados
// "sobre o mesmo problema" e para buscar na central de ajuda.
// Normaliza acentos, remove palavras vazias e compara radicais de 4 letras
// (ex.: "lento" e "lentidão" viram "lent"; "bloqueada" e "bloqueou" viram "bloq").

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de do da dos das no na nos nas em para por pra pro com sem que se " +
    "e ou mas meu minha meus minhas seu sua seus suas esse essa este esta isso isto aqui ali la " +
    "ao aos ja nao sim muito mais menos quando onde como qual quais quem eu voce ele ela eles elas " +
    "nos tem ter tenho esta estou estao ser sou foi era ficou fica desde depois antes ate sobre " +
    "chamado chamados problema favor preciso precisa ajuda oi ola bom dia boa tarde noite obrigado obrigada " +
    "hoje ontem agora tambem ainda so outro outra todo toda todos todas dar fazer faz feito"
  ).split(/\s+/),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Radicais das palavras relevantes do texto. Números (ex.: "809") são mantidos inteiros. */
export function keywordStems(text: string): Set<string> {
  const stems = new Set<string>();
  for (const word of normalize(text).split(/[^a-z0-9]+/)) {
    if (!word || STOPWORDS.has(word)) continue;
    if (/^\d+$/.test(word)) {
      if (word.length >= 3) stems.add(word);
      continue;
    }
    if (word.length < 3) continue;
    stems.add(word.slice(0, 4));
  }
  return stems;
}

/**
 * Coeficiente de Dice: 2·|A ∩ B| / (|A| + |B|), de 0 a 1.
 * Uma única palavra em comum ("notebook") não basta para dizer que é o mesmo problema.
 */
export function similarityScore(a: string, b: string): number {
  const setA = keywordStems(a);
  const setB = keywordStems(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const stem of setA) if (setB.has(stem)) shared++;
  return (2 * shared) / (setA.size + setB.size);
}

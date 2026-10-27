import { keywordStems } from "@/domain/similarity";
import { HELP_ARTICLES, type HelpArticle } from "./articles";

export type ArticleMatch = { article: HelpArticle; score: number };

const MIN_SCORE = 0.25;

/**
 * Busca por palavras-chave: fração das palavras da pergunta encontradas no artigo,
 * com peso maior para título e etiquetas. Determinística e sem custo de modelo.
 */
export function searchArticles(query: string, limit = 3): ArticleMatch[] {
  const queryStems = keywordStems(query);
  if (queryStems.size === 0) return [];

  return HELP_ARTICLES.map((article) => {
    const strong = keywordStems(`${article.title} ${article.tags.join(" ")}`);
    const body = keywordStems(article.body);
    let points = 0;
    for (const stem of queryStems) {
      if (strong.has(stem)) points += 1;
      else if (body.has(stem)) points += 0.5;
    }
    return { article, score: Math.round((points / queryStems.size) * 100) / 100 };
  })
    .filter((match) => match.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

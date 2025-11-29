import { type RawInputRow, type ReviewRow, type SentimentLabel } from '../types/sentiment';

const POSITIVE_WORDS = [
  'отлично',
  'хорошо',
  'нравится',
  'супер',
  'круто',
  'удобно',
  'класс',
  'шикарно',
  'прекрасно',
  'рекомендую',
];

const NEGATIVE_WORDS = [
  'ужасно',
  'плохо',
  'ненавижу',
  'отвратительно',
  'неудобно',
  'кошмар',
  'разочарование',
  'слишком дорого',
  'глючит',
  'баг',
];

function simpleHeuristic(text: string): SentimentLabel {
  const lower = text.toLowerCase();

  if (NEGATIVE_WORDS.some((w) => lower.includes(w))) return 0;
  if (POSITIVE_WORDS.some((w) => lower.includes(w))) return 2;

  return 1; // нейтрально по умолчанию
}



// Анализирует массив сырых строк и возвращает список ReviewRow
export async function analyzeRows(rawRows: RawInputRow[]): Promise<ReviewRow[]> {

  return rawRows.map((row, index) => {
    const predicted = simpleHeuristic(row.text);

    return {
      id: String(index + 1),
      text: row.text,
      src: row.src,
      predictedLabel: predicted,
      status: 'predicted',
      // можно сгенерить фейковые "вероятности"
      probs: {
        negative: predicted === 0 ? 0.8 : 0.1,
        neutral: predicted === 1 ? 0.7 : 0.15,
        positive: predicted === 2 ? 0.85 : 0.1,
      },
    };
  });
}

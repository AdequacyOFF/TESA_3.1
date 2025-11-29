import { type SentimentLabel } from '../types/sentiment';

export interface ManualAnalysisResult {
  text: string;
  predictedLabel: SentimentLabel;
  probs: {
    negative: number;
    neutral: number;
    positive: number;
  };
  model: string;
  analyzedAt: string;
}

const positiveWords = [
  'хорошо',
  'отличн',
  'супер',
  'класс',
  'нравит',
  'люблю',
  'рекомендую',
  'счастл',
  'удовольств',
];

const negativeWords = [
  'плохо',
  'ужас',
  'отврат',
  'ненавижу',
  'не рекомендую',
  'разочар',
  'ненормаль',
  'кошмар',
  'худше',
];

function detectLabel(text: string): SentimentLabel {
  const t = text.toLowerCase();

  let posScore = 0;
  let negScore = 0;

  positiveWords.forEach((w) => {
    if (t.includes(w)) posScore += 1;
  });
  negativeWords.forEach((w) => {
    if (t.includes(w)) negScore += 1;
  });

  if (posScore === 0 && negScore === 0) return 1; // нейтральная
  if (posScore > negScore) return 2; // положительная
  if (negScore > posScore) return 0; // отрицательная
  return 1;
}

export function analyzeTextMock(text: string): ManualAnalysisResult {
  const label = detectLabel(text);

  // примитивный распределитель вероятностей для красоты
  let probs = { negative: 0.33, neutral: 0.34, positive: 0.33 };

  if (label === 0) probs = { negative: 0.8, neutral: 0.15, positive: 0.05 };
  if (label === 1) probs = { negative: 0.15, neutral: 0.7, positive: 0.15 };
  if (label === 2) probs = { negative: 0.05, neutral: 0.15, positive: 0.8 };

  return {
    text,
    predictedLabel: label,
    probs,
    model: 'tesa-mock-local-v1',
    analyzedAt: new Date().toISOString(),
  };
}

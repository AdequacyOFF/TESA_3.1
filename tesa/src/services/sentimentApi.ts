// src/services/sentimentApi.ts
import type { AppSettings } from '../context/SettingsContext';
import { buildBackendBaseUrl } from '../context/SettingsContext';
import type {
  RawInputRow,
  ReviewRow,
  SentimentLabel,
} from '../types/sentiment';

export interface PredictResponse {
  prediction: number;
  negative_score: number;
  neutral_score: number;
  positive_score: number;
}

export interface ManualAnalysisResult {
  text: string;
  predictedLabel: SentimentLabel;
  probs: {
    negative: number;
    neutral: number;
    positive: number;
  };
  createdAt: string;
}

const toSentimentLabel = (value: number): SentimentLabel => {
  if (value === 0 || value === 1 || value === 2) {
    return value as SentimentLabel;
  }
  // fallback — нейтрал
  return 1;
};

async function callPredict(
  baseUrl: string,
  text: string,
): Promise<PredictResponse> {
  try {
    const res = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(
        `Backend error ${res.status} ${res.statusText}${
          bodyText ? `: ${bodyText}` : ''
        }`,
      );
    }

    const data = (await res.json()) as PredictResponse;
    return data;
  } catch (err: any) {
    // чтобы в UI не было "Load failed" без пояснения
    throw new Error(err?.message || 'Не удалось обратиться к бэкенду');
  }
}

// анализ одного текста (ручной режим)
export async function analyzeText(
  settings: AppSettings,
  text: string,
): Promise<ManualAnalysisResult> {
  const baseUrl = buildBackendBaseUrl(settings);
  const data = await callPredict(baseUrl, text);

  const label = toSentimentLabel(data.prediction);

  return {
    text,
    predictedLabel: label,
    probs: {
      negative: data.negative_score,
      neutral: data.neutral_score,
      positive: data.positive_score,
    },
    createdAt: new Date().toISOString(),
  };
}

// анализ всего набора строк из CSV
export async function analyzeRows(
  settings: AppSettings,
  rows: RawInputRow[],
): Promise<ReviewRow[]> {
  const baseUrl = buildBackendBaseUrl(settings);
  const result: ReviewRow[] = [];

  // простая последовательная реализация — для хакатона ок
  for (let idx = 0; idx < rows.length; idx++) {
    const raw = rows[idx];

    const data = await callPredict(baseUrl, raw.text);
    const label = toSentimentLabel(data.prediction);

    result.push({
      id: raw.id ?? String(idx + 1),
      text: raw.text,
      src: raw.src || undefined,
      predictedLabel: label,
      trueLabel: undefined,
      correctedLabel: undefined,
      probs: {
        negative: data.negative_score,
        neutral: data.neutral_score,
        positive: data.positive_score,
      },
      status: 'predicted',
    });
  }

  return result;
}

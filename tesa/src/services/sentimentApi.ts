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
    throw new Error(err?.message || 'Не удалось обратиться к бэкенду');
  }
}


// нормализация текста (как минимум убираем лишние пробелы)
const normalizeText = (t: string | undefined | null): string =>
  (t ?? '').replace(/\s+/g, ' ').trim();

// берём ID для строки: сначала ID/id из CSV, потом индекс
const getRowId = (row: RawInputRow, idx: number): string => {
  const anyRow = row as any;
  const fromCsvId = anyRow.ID ?? anyRow.id;
  if (fromCsvId !== undefined && fromCsvId !== null && fromCsvId !== '') {
    return String(fromCsvId);
  }
  return String(idx + 1);
};

// собираем временный CSV "ID,text" для отправки на /csv
const buildCsvPayload = (rows: RawInputRow[]): string => {
  const lines: string[] = [];
  lines.push('ID,text');

  rows.forEach((row, idx) => {
    const id = getRowId(row, idx);
    const text = normalizeText((row as any).text);

    const safeText = `"${String(text)
      .replace(/"/g, '""')
      .replace(/\r?\n/g, ' ')}"`;

    lines.push(`${id},${safeText}`);
  });

  return lines.join('\n');
};

// парсим ответ CSV "ID,label" от бэка
const parseCsvPredictions = (csvText: string): Map<string, SentimentLabel> => {
  const map = new Map<string, SentimentLabel>();

  const cleaned = csvText.replace(/^\uFEFF/, ''); // убираем BOM, если есть
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return map;

  const header = lines[0].split(',');
  const idIdx = header.indexOf('ID');
  const labelIdx = header.indexOf('label');

  if (idIdx === -1 || labelIdx === -1) {
    console.error('Unexpected CSV header from /csv:', header);
    return map;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length <= Math.max(idIdx, labelIdx)) continue;

    const id = parts[idIdx].trim();
    const labelRaw = parts[labelIdx].trim();
    if (!id) continue;

    const num = Number(labelRaw);
    if (Number.isNaN(num)) continue;

    if (num === 0 || num === 1 || num === 2) {
      map.set(id, num as SentimentLabel);
    }
  }

  return map;
};

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

export async function analyzeRows(
  settings: AppSettings,
  rows: RawInputRow[],
): Promise<ReviewRow[]> {
  const baseUrl = buildBackendBaseUrl(settings);

  if (!rows.length) {
    return [];
  }

  // 1. Собираем CSV пейлоад
  const csvPayload = buildCsvPayload(rows);
  const blob = new Blob([csvPayload], { type: 'text/csv;charset=utf-8;' });

  const formData = new FormData();
  formData.append('file', blob, 'dataset.csv');

  // 2. Отправляем ОДИН запрос на /csv
  const res = await fetch(`${baseUrl}/csv`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(
      `Ошибка анализа CSV на бэкенде (${res.status} ${
        res.statusText
      })${bodyText ? `: ${bodyText}` : ''}`,
    );
  }

  const responseCsv = await res.text();
  const predictionsById = parseCsvPredictions(responseCsv);

  // 3. Собираем ReviewRow[] с подставленным predictedLabel
  const result: ReviewRow[] = rows.map((raw, idx) => {
    const anyRow = raw as any;

    const id = getRowId(raw, idx);
    const predicted = predictionsById.get(id);

    const label = predicted ?? 1; // если вдруг чего-то не нашли — нейтральный fallback

    return {
      id,
      text: anyRow.text,
      src: anyRow.src || undefined,
      predictedLabel: label,
      trueLabel: undefined, // при необходимости проставляется позже в AnalysisContext из rawRows[idx].label
      correctedLabel: undefined,
      probs: {
        // у /csv нет вероятностей, ставим one-hot по классу, чтобы не ломать визуалки
        negative: label === 0 ? 100 : 0,
        neutral: label === 1 ? 100 : 0,
        positive: label === 2 ? 100 : 0,
      },
      status: 'predicted',
    };
  });

  return result;
}

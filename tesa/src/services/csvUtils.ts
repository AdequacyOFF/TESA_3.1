import type {
  RawInputRow,
  ReviewRow,
  SentimentLabel,
} from '../types/sentiment';
import type { LabelMeaning } from '../context/SettingsContext';
import {
  normalizeLabelMapping,
  conceptLabelToDatasetCode,
  modelCodeToConceptLabel,
} from '../utils/labelMapping';

/**
 * Простой CSV-парсер с поддержкой кавычек.
 * Возвращает массив ячеек для одной строки.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function buildRowFromTokens(
  headers: string[],
  tokens: string[],
): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((h, idx) => {
    row[h] = tokens[idx] ?? '';
  });
  return row;
}

/**
 * Парсинг входного CSV с отзывами.
 * Ожидает:
 * - text (обязательно)
 * - src (опционально)
 * - label (опционально, 0/1/2)
 * - ID (опционально, будет проброшен как id)
 */
export async function parseInputCsv(
  file: File,
): Promise<{ rows: RawInputRow[]; totalRows: number }> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { rows: [], totalRows: 0 };
  }

  const headerTokens = parseCsvLine(lines[0]);
  const headers = headerTokens.map((h) => h.trim());
  const lower = headers.map((h) => h.toLowerCase());

  const idxText = lower.indexOf('text');
  const idxSrc = lower.indexOf('src');
  const idxLabel = lower.indexOf('label');
  const idxId = lower.indexOf('id'); // колонка ID / id

  if (idxText === -1) {
    return { rows: [], totalRows: 0 };
  }

  const rows: RawInputRow[] = [];
  let generatedId = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const tokens = parseCsvLine(line);
    const data = buildRowFromTokens(headers, tokens);

    const rawText = data[headers[idxText]] ?? '';
    const textVal = rawText.trim();
    if (!textVal) continue;

    const srcVal =
      idxSrc >= 0 ? (data[headers[idxSrc]]?.trim() ?? '') : '';
    const labelRaw =
      idxLabel >= 0 ? (data[headers[idxLabel]]?.trim() ?? '') : '';
    const idRaw =
      idxId >= 0 ? (data[headers[idxId]]?.trim() ?? '') : '';

    let label: SentimentLabel | undefined;
    if (labelRaw !== '') {
      const num = Number(labelRaw);
      if (num === 0 || num === 1 || num === 2) {
        label = num as SentimentLabel;
      }
    }

    const rowObj: RawInputRow = {
      text: textVal,
      id: idRaw || String(generatedId++),
      src: srcVal || undefined,
      label,
    };

    rows.push(rowObj);
  }

  return {
    rows,
    totalRows: rows.length,
  };
}

/**
 * Строка из валидационного CSV.
 * text + trueLabel (0/1/2 как в файле).
 */
export interface ValidationRow {
  text: string;
  trueLabel: SentimentLabel;
}

/**
 * Парсинг валидационного CSV для метрик.
 * Ожидает колонки:
 * - text
 * - label (0/1/2)
 */
export async function parseValidationCsv(file: File): Promise<ValidationRow[]> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (!lines.length) return [];

  const headerTokens = parseCsvLine(lines[0]);
  const headers = headerTokens.map((h) => h.trim());
  const lower = headers.map((h) => h.toLowerCase());

  const idxText = lower.indexOf('text');
  const idxLabel = lower.indexOf('label');

  if (idxText === -1 || idxLabel === -1) return [];

  const result: ValidationRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const tokens = parseCsvLine(line);
    const data = buildRowFromTokens(headers, tokens);

    const rawText = data[headers[idxText]] ?? '';
    const textVal = rawText.trim();
    if (!textVal) continue;

    const labelRaw = (data[headers[idxLabel]] ?? '').trim();
    if (labelRaw === '') continue;

    const num = Number(labelRaw);
    if (num !== 0 && num !== 1 && num !== 2) continue;

    result.push({
      text: textVal,
      trueLabel: num as SentimentLabel,
    });
  }

  return result;
}

/**
 * Экспорт результатов разметки (кнопка "Скачать CSV" в сайдбаре).
 *
 * В зависимости от опций формируются колонки:
 * - ID    — если includeId = true (берётся из CSV-колонки ID, затем из row.id)
 * - text  — если includeText = true
 * - label — ВСЕГДА, итоговая метка, переписанная под кодировку датасета (mapping)
 */
export function exportResultsCsv(
  reviews: ReviewRow[],
  labelMapping?: Record<number, LabelMeaning>,
  options?: { includeId?: boolean; includeText?: boolean },
): void {
  if (!reviews.length) return;

  const mapping = normalizeLabelMapping(labelMapping);
  const includeId = options?.includeId ?? false;
  const includeText = options?.includeText ?? false;

  const headers: string[] = [];
  if (includeId) headers.push('ID');
  if (includeText) headers.push('text');
  headers.push('label');

  const lines: string[] = [];
  lines.push(headers.join(','));

  reviews.forEach((row) => {
    const cols: string[] = [];

    if (includeId) {
      const rawId = (row as any).ID ?? row.id ?? '';
      cols.push(String(rawId));
    }

    if (includeText) {
      const safeText = '"' + (row.text ?? '').replace(/"/g, '""') + '"';
      cols.push(safeText);
    }

    const baseFinal = row.correctedLabel ?? row.predictedLabel;
    let labelValue = '';

    if (baseFinal === 0 || baseFinal === 1 || baseFinal === 2) {
      const concept = modelCodeToConceptLabel(baseFinal);
      const datasetCode =
        concept != null
          ? conceptLabelToDatasetCode(concept as any, mapping)
          : baseFinal;
      labelValue = String(datasetCode);
    }

    cols.push(labelValue);

    lines.push(cols.join(','));
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tesa_results_full.csv';
  a.click();
  URL.revokeObjectURL(url);
}

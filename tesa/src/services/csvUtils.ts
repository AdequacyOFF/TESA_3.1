// src/services/csvUtils.ts
import type {
  RawInputRow,
  ReviewRow,
  SentimentLabel,
} from '../types/sentiment';
import type { LabelMeaning } from '../context/SettingsContext';
import {
  normalizeLabelMapping,
  conceptLabelToDatasetCode,
  datasetCodeToConceptLabel,
  areLabelsEqualByConcept,
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
        // экранированная кавычка ""
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

    let label: SentimentLabel | undefined;
    if (labelRaw !== '') {
      const num = Number(labelRaw);
      if (num === 0 || num === 1 || num === 2) {
        label = num as SentimentLabel;
      }
    }

    const rowObj = {
      // если в RawInputRow уже есть id – ок; если нет, лишнее поле не мешает
      id: String(generatedId++),
      text: textVal,
      src: srcVal || undefined,
      label,
    } as RawInputRow;

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
 * Полный экспорт результатов разметки.
 *
 * Колонки:
 * - id
 * - src
 * - text
 * - predicted_label        — как вернула модель (0/1/2 = neg/neu/pos)
 * - corrected_label        — ручная правка (если есть)
 * - final_label_concept    — итоговая метка в НОРМАЛИЗОВАННОМ виде (0/1/2 = neg/neu/pos)
 * - final_label_export     — итоговая метка, ПЕРЕПИСАННАЯ под кодировку датасета (mapping)
 * - true_label_raw         — как было в валидационном CSV
 * - true_label_concept     — true-label в нормализованном виде (0/1/2 = neg/neu/pos)
 * - match_by_concept       — 1 если финальная метка совпадает с true по смыслу, 0 иначе
 */
export function exportResultsCsv(
  reviews: ReviewRow[],
  labelMapping?: Record<number, LabelMeaning>,
): void {
  if (!reviews.length) return;

  const mapping = normalizeLabelMapping(labelMapping);

  const lines: string[] = [];
  lines.push(
    [
      'id',
      'src',
      'text',
      'predicted_label',
      'corrected_label',
      'final_label_concept',
      'final_label_export',
      'true_label_raw',
      'true_label_concept',
      'match_by_concept',
    ].join(','),
  );

  reviews.forEach((row) => {
    const predicted = row.predictedLabel as SentimentLabel | undefined;
    const corrected = row.correctedLabel as SentimentLabel | undefined;
    const finalConcept = (corrected ?? predicted) as SentimentLabel | undefined;

    const finalConceptStr =
      finalConcept === 0 || finalConcept === 1 || finalConcept === 2
        ? String(finalConcept)
        : '';

    let finalExportStr = '';
    if (finalConcept === 0 || finalConcept === 1 || finalConcept === 2) {
      const datasetCode = conceptLabelToDatasetCode(finalConcept as any, mapping);
      finalExportStr = String(datasetCode);
    }

    const trueLabelRaw = row.trueLabel;
    const trueConcept = datasetCodeToConceptLabel(
      typeof trueLabelRaw === 'number' ? trueLabelRaw : null,
      mapping,
    );
    const trueConceptStr =
      trueConcept === 0 || trueConcept === 1 || trueConcept === 2
        ? String(trueConcept)
        : '';

    const match = areLabelsEqualByConcept(
      typeof trueLabelRaw === 'number' ? trueLabelRaw : null,
      typeof finalConcept === 'number' ? finalConcept : null,
      mapping,
    );

    const safeText = '"' + (row.text ?? '').replace(/"/g, '""') + '"';
    const safeSrc = '"' + (row.src ?? '').replace(/"/g, '""') + '"';

    lines.push(
      [
        row.id ?? '',
        safeSrc,
        safeText,
        predicted ?? '',
        corrected ?? '',
        finalConceptStr,
        finalExportStr,
        trueLabelRaw ?? '',
        trueConceptStr,
        match ? '1' : '0',
      ].join(','),
    );
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

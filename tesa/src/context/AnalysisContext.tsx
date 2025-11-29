import React, { createContext, useContext, useState } from 'react';
import {
  type AnalysisJob,
  type PreprocessOptions,
  type RawInputRow,
  type ReviewRow,
  type SentimentLabel,
} from '../types/sentiment';
import { parseInputCsv, parseValidationCsv } from '../services/csvUtils';
import { analyzeRows } from '../services/sentimentApi';
import { useSettings } from './SettingsContext';

interface RawDatasetInfo {
  fileName: string;
  totalRows: number;
  previewRows: RawInputRow[];
}

export type RowStatusFilter = 'all' | 'corrected' | 'uncorrected';

export interface ResultsFilters {
  sentiments: SentimentLabel[];
  sources: string[];
  status: RowStatusFilter;
  searchMode: 'text' | 'src';
  searchQuery: string;
}

interface AnalysisContextValue {
  rawDataset: RawDatasetInfo | null;
  rawRows: RawInputRow[];
  reviews: ReviewRow[];
  job: AnalysisJob | null;
  preprocessOptions: PreprocessOptions;
  filters: ResultsFilters;
  loading: boolean;

  loadCsvFile: (file: File) => Promise<void>;
  runAnalysis: () => Promise<void>;
  setPreprocessOptions: (patch: Partial<PreprocessOptions>) => void;

  updateFilters: (patch: Partial<ResultsFilters>) => void;
  resetFilters: () => void;

  updateCorrectedLabel: (id: string, label?: SentimentLabel) => void;

  applyValidationFile: (file: File) => Promise<void>;
  resetValidation: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(
  undefined,
);

export const useAnalysis = (): AnalysisContextValue => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error('useAnalysis must be used within AnalysisProvider');
  }
  return ctx;
};

const defaultPreprocess: PreprocessOptions = {
  tokenization: true,
  lemmatization: true,
  ner: false,
  stopwords: true,
};

const defaultFilters: ResultsFilters = {
  sentiments: [0, 1, 2],
  sources: [],
  status: 'all',
  searchMode: 'text',
  searchQuery: '',
};

const normalizeText = (t: string): string => t.replace(/\s+/g, ' ').trim();

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [rawDataset, setRawDataset] = useState<RawDatasetInfo | null>(null);
  const [rawRows, setRawRows] = useState<RawInputRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [preprocessOptions, setPreprocessOptionsState] =
    useState<PreprocessOptions>(defaultPreprocess);
  const [filters, setFilters] = useState<ResultsFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);

  const { settings } = useSettings();

  const setPreprocessOptions = (patch: Partial<PreprocessOptions>) => {
    setPreprocessOptionsState((prev) => ({ ...prev, ...patch }));
  };

  const updateFilters = (patch: Partial<ResultsFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetFilters = () => setFilters(defaultFilters);

  const loadCsvFile = async (file: File): Promise<void> => {
    setLoading(true);
    try {
      const { rows, totalRows } = await parseInputCsv(file);

      if (!rows.length) {
        alert('Не получилось найти колонку text в файле или файл пустой.');
        return;
      }

      setRawRows(rows);
      setRawDataset({
        fileName: file.name,
        totalRows,
        previewRows: rows.slice(0, 10),
      });

      // сбрасываем старые результаты и валидацию
      setReviews([]);
      setJob(null);
      resetFilters();
    } catch (e) {
      console.error(e);
      alert('Ошибка при чтении CSV. Проверь формат файла.');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (): Promise<void> => {
    if (!rawRows.length) {
      alert('Сначала загрузите CSV с колонкой text.');
      return;
    }

    const jobId = `job-${Date.now()}`;
    const now = new Date().toISOString();

    setJob({
      id: jobId,
      status: 'processing',
      createdAt: now,
      totalRows: rawRows.length,
      processedRows: 0,
    });

    setLoading(true);
    try {
      // вызываем реальный бэкенд через sentimentApi
      const analyzedBase = await analyzeRows(settings, rawRows);

      // если во входном CSV была колонка label, прокидываем её в trueLabel
      const analyzedWithTrue = analyzedBase.map((row, idx) => {
        const srcRaw = rawRows[idx];
        if (srcRaw && srcRaw.label !== undefined) {
          return {
            ...row,
            trueLabel: srcRaw.label,
          };
        }
        return row;
      });

      setReviews(analyzedWithTrue);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'finished',
              finishedAt: new Date().toISOString(),
              processedRows: analyzedWithTrue.length,
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              errorMessage: e?.message || 'Ошибка анализа',
            }
          : prev,
      );
    } finally {
      setLoading(false);
    }
  };

  const updateCorrectedLabel = (id: string, label?: SentimentLabel) => {
    setReviews((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const nextStatus: ReviewRow['status'] =
          label === undefined
            ? row.predictedLabel !== undefined
              ? 'predicted'
              : 'raw'
            : 'corrected';

        return {
          ...row,
          correctedLabel: label,
          status: nextStatus,
        };
      }),
    );
  };

  /**
   * Загрузка валидационного CSV:
   * - обязательна колонка label / trueLabel
   * - ID и text — опциональны
   * При сопоставлении приоритет:
   *   1) ID
   *   2) text (нормализованный)
   *   3) номер строки (индекс)
   */
  const applyValidationFile = async (file: File): Promise<void> => {
    setLoading(true);
    try {
      const validationRows: any[] = await parseValidationCsv(file);

      const idToTrue = new Map<string, SentimentLabel>();
      const textToTrue = new Map<string, SentimentLabel>();
      const indexToTrue = new Map<number, SentimentLabel>();

      validationRows.forEach((r, idx) => {
        const trueLabel =
          (r.trueLabel as SentimentLabel | undefined) ??
          (r.label as SentimentLabel | undefined);

        if (trueLabel === undefined) return;

        // ID: поддерживаем ID / id
        const rawId = (r as any).ID ?? (r as any).id;
        if (rawId !== undefined && rawId !== null && rawId !== '') {
          idToTrue.set(String(rawId), trueLabel);
        }

        // text (если есть)
        if (typeof r.text === 'string' && r.text.trim().length > 0) {
          const key = normalizeText(r.text);
          textToTrue.set(key, trueLabel);
        }

        // fallback — по индексу строки
        indexToTrue.set(idx, trueLabel);
      });

      setReviews((prev) =>
        prev.map((row, idx) => {
          // 1) пробуем по ID
          const rowRawId = (row as any).ID ?? row.id;
          if (
            rowRawId !== undefined &&
            rowRawId !== null &&
            rowRawId !== '' &&
            idToTrue.has(String(rowRawId))
          ) {
            return {
              ...row,
              trueLabel: idToTrue.get(String(rowRawId))!,
            };
          }

          // 2) пробуем по тексту
          const key = normalizeText(row.text);
          if (textToTrue.has(key)) {
            return {
              ...row,
              trueLabel: textToTrue.get(key)!,
            };
          }

          // 3) fallback — по индексу строки
          if (indexToTrue.has(idx)) {
            return {
              ...row,
              trueLabel: indexToTrue.get(idx)!,
            };
          }

          // если ничего не нашли — оставляем как было
          return row;
        }),
      );
    } catch (e) {
      console.error(e);
      alert(
        'Ошибка при чтении CSV с эталонной разметкой. Нужна колонка label (ID и text — опционально).',
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Полный сброс валидации:
   * - trueLabel у всех отзывов становится undefined
   * - подсветка на ResultsPage пропадает
   * - метрики и confusion matrix на MetricsPage обнуляются
   */
  const resetValidation = async (): Promise<void> => {
    setReviews((prev) =>
      prev.map((row) => ({
        ...row,
        trueLabel: undefined,
      })),
    );
  };

  const value: AnalysisContextValue = {
    rawDataset,
    rawRows,
    reviews,
    job,
    preprocessOptions,
    filters,
    loading,
    loadCsvFile,
    runAnalysis,
    setPreprocessOptions,
    updateFilters,
    resetFilters,
    updateCorrectedLabel,
    applyValidationFile,
    resetValidation,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
};

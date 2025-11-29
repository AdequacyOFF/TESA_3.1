// src/context/AnalysisContext.tsx
import React, { createContext, useContext, useState } from 'react';
import {
  type AnalysisJob,
  type PreprocessOptions,
  type RawInputRow,
  type ReviewRow,
  type SentimentLabel,
} from '../types/sentiment';
import { parseInputCsv, parseValidationCsv } from '../services/csvUtils';
import { analyzeRows } from '../services/mockApi';

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
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined);

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

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawDataset, setRawDataset] = useState<RawDatasetInfo | null>(null);
  const [rawRows, setRawRows] = useState<RawInputRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [preprocessOptions, setPreprocessOptionsState] =
    useState<PreprocessOptions>(defaultPreprocess);
  const [filters, setFilters] = useState<ResultsFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);

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
      // вызываем "нейронку" (mockApi) для предсказания тональности
      const analyzedBase = await analyzeRows(rawRows);

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

  const applyValidationFile = async (file: File): Promise<void> => {
    setLoading(true);
    try {
      const validationRows = await parseValidationCsv(file);

      const textToTrueLabel = new Map<string, SentimentLabel>();
      validationRows.forEach((r: { text: string; trueLabel: SentimentLabel }) => {
        const key = normalizeText(r.text);
        textToTrueLabel.set(key, r.trueLabel);
      });

      setReviews((prev) =>
        prev.map((row) => {
          const key = normalizeText(row.text);
          const trueLabel = textToTrueLabel.get(key);
          if (trueLabel === undefined) return row;
          return {
            ...row,
            trueLabel,
          };
        }),
      );
    } catch (e) {
      console.error(e);
      alert('Ошибка при чтении CSV с эталонной разметкой. Нужны колонки text,label.');
    } finally {
      setLoading(false);
    }
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
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
};

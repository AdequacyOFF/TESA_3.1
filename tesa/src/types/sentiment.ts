export type SentimentLabel = 0 | 1 | 2;

export interface ReviewRow {
  id: string; // локальный/внешний ID (из CSV или сгенерированный)
  text: string;
  src?: string;
  predictedLabel?: SentimentLabel;
  trueLabel?: SentimentLabel;
  correctedLabel?: SentimentLabel;
  probs?: {
    negative: number;
    neutral: number;
    positive: number;
  };
  status: 'raw' | 'predicted' | 'corrected';
}

export interface AnalysisJob {
  id: string;
  status: 'created' | 'processing' | 'finished' | 'failed';
  createdAt: string;
  finishedAt?: string;
  totalRows?: number;
  processedRows?: number;
  errorMessage?: string;
}

export interface Metrics {
  macroF1: number;
  perClass: {
    label: SentimentLabel;
    precision: number;
    recall: number;
    f1: number;
  }[];
  confusionMatrix?: number[][];
}

export interface PreprocessOptions {
  tokenization: boolean;
  lemmatization: boolean;
  ner: boolean;
  stopwords: boolean;
}

// Сырые строки после парсинга входного CSV
export interface RawInputRow {
  text: string;
  id?: string;             // если в CSV есть колонка ID/id — кладём сюда
  src?: string;
  label?: SentimentLabel;  // исходная метка, если есть
}

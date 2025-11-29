import type {
  ReviewRow,
  Metrics as MetricsType,
  SentimentLabel,
} from '../types/sentiment';
import type { LabelMeaning } from '../context/SettingsContext';
import {
  normalizeLabelMapping,
  datasetCodeToConceptLabel,
  modelCodeToConceptLabel,
  type LabelCode,
} from '../utils/labelMapping';

/**
 * Считаем macro-F1, метрики по классам и confusion matrix в НОРМАЛИЗОВАННОМ
 * пространстве классов: 0 = negative, 1 = neutral, 2 = positive.
 *
 * trueLabel трактуем как КОД ИЗ ВАЛИДАЦИОННОГО CSV (0/1/2) и
 * конвертим в концепт через settings.labelMapping.
 *
 * predictedLabel — это код модели (0=neg,1=neu,2=pos).
 * Ручные правки здесь НЕ учитываем — замер качества именно модели.
 */
export function computeMetricsForReviews(
  reviews: ReviewRow[],
  labelMapping?: Record<number, LabelMeaning>,
): MetricsType | null {
  if (!reviews.length) return null;

  const mapping = normalizeLabelMapping(labelMapping);
  const classes: LabelCode[] = [0, 1, 2];

  // confusion[trueConcept][predConcept]
  const confusion: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  const tp = [0, 0, 0];
  const fp = [0, 0, 0];
  const fn = [0, 0, 0];

  reviews.forEach((r) => {
    const trueConcept = datasetCodeToConceptLabel(
      r.trueLabel as number | null | undefined,
      mapping,
    );
    const predConcept = modelCodeToConceptLabel(
      r.predictedLabel as number | null | undefined,
    );

    // Нужна пара true + pred, иначе строка не участвует в метриках
    if (trueConcept == null || predConcept == null) return;

    confusion[trueConcept][predConcept] += 1;

    if (trueConcept === predConcept) {
      tp[trueConcept] += 1;
    } else {
      fn[trueConcept] += 1;
      fp[predConcept] += 1;
    }
  });

  const perClass = classes.map((c) => {
    const precisionDen = tp[c] + fp[c];
    const recallDen = tp[c] + fn[c];

    const precision = precisionDen ? tp[c] / precisionDen : 0;
    const recall = recallDen ? tp[c] / recallDen : 0;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return {
      label: c as SentimentLabel, // 0/1/2 = neg/neu/pos в нормализованном смысле
      precision,
      recall,
      f1,
    };
  });

  const macroF1 =
    perClass.reduce((sum, c) => sum + (Number.isFinite(c.f1) ? c.f1 : 0), 0) /
    classes.length;

  const metrics: MetricsType = {
    macroF1,
    perClass,
    confusionMatrix: confusion,
  };

  return metrics;
}

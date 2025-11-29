import type { LabelMeaning } from '../context/SettingsContext';

export type LabelCode = 0 | 1 | 2;

// Как МОДЕЛЬ понимает свои числа: 0 = negative, 1 = neutral, 2 = positive
export const MODEL_MEANING: Record<LabelCode, LabelMeaning> = {
  0: 'negative',
  1: 'neutral',
  2: 'positive',
};

export const MEANING_TO_INDEX: Record<LabelMeaning, LabelCode> = {
  negative: 0,
  neutral: 1,
  positive: 2,
};

export const DEFAULT_LABEL_MAPPING: Record<LabelCode, LabelMeaning> = {
  0: 'negative',
  1: 'neutral',
  2: 'positive',
};

/**
 * Аккуратное приведение settings.labelMapping к виду Record<0|1|2, LabelMeaning>
 */
export function normalizeLabelMapping(
  mapping: Record<number, LabelMeaning> | null | undefined,
): Record<LabelCode, LabelMeaning> {
  const raw = (mapping ?? {}) as Record<number, LabelMeaning>;
  return {
    0: raw[0] ?? DEFAULT_LABEL_MAPPING[0],
    1: raw[1] ?? DEFAULT_LABEL_MAPPING[1],
    2: raw[2] ?? DEFAULT_LABEL_MAPPING[2],
  };
}

/**
 * Код из валидационного / эталонного CSV (0/1/2) -> нормализованный концепт:
 * 0 = negative, 1 = neutral, 2 = positive
 */
export function datasetCodeToConceptLabel(
  datasetCode: number | null | undefined,
  mapping: Record<LabelCode, LabelMeaning>,
): LabelCode | null {
  if (datasetCode !== 0 && datasetCode !== 1 && datasetCode !== 2) return null;
  const meaning = mapping[datasetCode];
  return MEANING_TO_INDEX[meaning] ?? null;
}

/**
 * Код модели / ручной правки (0/1/2) -> нормализованный концепт
 * (у модели 0,1,2 уже соответствуют negative/neutral/positive)
 */
export function modelCodeToConceptLabel(
  modelCode: number | null | undefined,
): LabelCode | null {
  if (modelCode !== 0 && modelCode !== 1 && modelCode !== 2) return null;
  return modelCode as LabelCode;
}

/**
 * Концептуальная метка (0=neg,1=neu,2=pos) -> КОД для внешнего CSV
 * Используем текущую матрицу соответствий из настроек.
 */
export function conceptLabelToDatasetCode(
  conceptLabel: LabelCode,
  mapping: Record<LabelCode, LabelMeaning>,
): LabelCode {
  const meaning = MODEL_MEANING[conceptLabel];
  const entry = (Object.entries(mapping) as [string, LabelMeaning][])
    .find(([, m]) => m === meaning);

  if (entry) {
    const code = Number(entry[0]) as LabelCode;
    if (code === 0 || code === 1 || code === 2) {
      return code;
    }
  }

  // Фоллбек: если что-то не так с mapping — оставляем как есть
  return conceptLabel;
}

/**
 * Равны ли две метки по СМЫСЛУ (neg/neu/pos), с учётом mapping
 * trueLabel — код из эталонного CSV (0/1/2)
 * modelOrCorrectedLabel — код модели/ручной правки (0/1/2 = neg/neu/pos)
 */
export function areLabelsEqualByConcept(
  trueLabel: number | null | undefined,
  modelOrCorrectedLabel: number | null | undefined,
  mapping: Record<LabelCode, LabelMeaning>,
): boolean {
  const trueConcept = datasetCodeToConceptLabel(trueLabel, mapping);
  const predConcept = modelCodeToConceptLabel(modelOrCorrectedLabel);
  return (
    trueConcept != null &&
    predConcept != null &&
    trueConcept === predConcept
  );
}

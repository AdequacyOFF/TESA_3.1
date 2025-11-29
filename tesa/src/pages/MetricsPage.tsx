// src/pages/MetricsPage.tsx
import React, { useMemo, useRef, useState } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { useSettings } from '../context/SettingsContext';
import { computeMetricsForReviews } from '../services/metrics';
import type { Metrics as MetricsType } from '../types/sentiment';

const formatNumber = (value: number | undefined) =>
  value !== undefined ? value.toFixed(3) : '0.000';

const MetricsPage: React.FC = () => {
  const { reviews, applyValidationFile, resetValidation } = useAnalysis();
  const { settings } = useSettings();

  const [loadingLocal, setLoadingLocal] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const matchedCount = useMemo(
    () =>
      reviews.filter(
        (r) => r.predictedLabel !== undefined && r.trueLabel !== undefined,
      ).length,
    [reviews],
  );

  const metrics: MetricsType | null = useMemo(
    () => computeMetricsForReviews(reviews, settings.labelMapping),
    [reviews, settings.labelMapping],
  );
  const hasMetrics = !!metrics;

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const processValidationFile = async (file: File) => {
    setLoadingLocal(true);
    try {
      setLastFileName(file.name);
      await applyValidationFile(file);
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processValidationFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processValidationFile(file);
    }
  };

  const handleDownloadReport = () => {
    if (!metrics) return;

    const lines: string[] = [];
    lines.push('macroF1,' + metrics.macroF1.toFixed(4));
    lines.push('');
    lines.push('class,precision,recall,f1');
    metrics.perClass.forEach((c) => {
      lines.push(
        `${c.label},${c.precision.toFixed(4)},${c.recall.toFixed(
          4,
        )},${c.f1.toFixed(4)}`,
      );
    });

    lines.push('');
    lines.push('confusion_matrix (true rows, predicted columns)');
    lines.push(',pred=0,pred=1,pred=2');
    [0, 1, 2].forEach((trueL) => {
      const row = metrics.confusionMatrix?.[trueL] ?? [0, 0, 0];
      lines.push(`true=${trueL},${row[0]},${row[1]},${row[2]}`);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tesa_metrics_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // новый нормальный ресет — чистим trueLabel через контекст
  const handleResetValidation = async () => {
    setLoadingLocal(true);
    try {
      setLastFileName(null);
      await resetValidation();
    } finally {
      setLoadingLocal(false);
    }
  };

  const confusionMatrix: number[][] =
    metrics?.confusionMatrix ?? [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

  const confusionRowSums = confusionMatrix.map((row) =>
    row.reduce((sum, v) => sum + v, 0),
  );

  const confusionPercents = confusionMatrix.map((row, i) =>
    row.map((v) => (confusionRowSums[i] ? v / confusionRowSums[i] : 0)),
  );

  const maxPercent = Math.max(
    0,
    ...confusionPercents.flat().map((p) => (Number.isFinite(p) ? p : 0)),
  );

  const labelNames = ['negative', 'neutral', 'positive'];

  const getCellStyle = (frac: number) => {
    if (!maxPercent) return {};
    if (!frac) return {};

    const norm = frac / maxPercent; // 0..1
    const minAlpha = 0.12;
    const maxAlpha = 0.35;
    const alpha = minAlpha + norm * (maxAlpha - minAlpha);

    return {
      background: `linear-gradient(145deg,
        rgba(37, 99, 235, ${alpha}),
        rgba(14, 165, 233, ${alpha * 0.8})
      )`,
      borderColor: 'var(--tesa-border-strong)',
      color: 'var(--tesa-text)',
    };
  };

  const labelTitle = (label: number) => {
    if (label === 0) return '0 · отрицательные';
    if (label === 1) return '1 · нейтральные';
    return '2 · положительные';
  };

  return (
    <div style={{ height: '90vh', overflow: 'auto', paddingBottom: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="page-header-title">Оценка качества (macro-F1)</div>
        <div className="page-header-subtitle">
          Загрузите валидационный CSV с истинными метками{' '}
          (<code>label</code> обязательно, <code>ID</code> или <code>text</code> — опционально, должно быть что-то одно из них), и
          TESA посчитает macro-F1, метрики по классам и confusion matrix для текущих предсказаний.
          Интерпретация кодов меток берётся из настроек сопоставления классов.
        </div>
      </div>

      {/* 1. Загрузка эталонной разметки */}
      <section className="chart-card" style={{ marginTop: 6 }}>
        <h3>1. Эталонная разметка</h3>
        <p className="chart-description">
          Формат файла: обязательная колонка <code>label</code>. Дополнительно можно добавить{' '}
          <code>ID</code> и/или <code>text</code>. Если есть <code>ID</code>, строки сопоставляются
          по нему, если нет — по <code>text</code>, если нет и его — по порядку строк.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
            gap: 14,
            marginTop: 8,
            alignItems: 'stretch',
          }}
        >
          {/* dropzone */}
          <div
            className={dragActive ? 'dropzone dropzone-active' : 'dropzone'}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ margin: 0 }}
          >
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              Перетащите сюда файл <strong>.csv</strong> с колонкой <code>label</code>{' '}
              (колонки <code>ID</code> и <code>text</code> могут быть, но не обязательны)
            </div>
            <div className="text-muted" style={{ marginBottom: 8 }}>
              Для расчёта метрик нужны и предсказанные моделью метки, и истинные метки эксперта.
            </div>
            <button
              className="btn-secondary btn"
              type="button"
              onClick={handleBrowseClick}
              disabled={loadingLocal}
              style={{ width: '100%' }}
            >
              {loadingLocal ? 'Загружаем…' : 'Выбрать файл'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* стеклянный статус-блок */}
          <div
            style={{
              borderRadius: 18,
              padding: '10px 12px',
              background: 'var(--tesa-surface-soft)',
              border: '1px solid var(--tesa-border-subtle)',
              boxShadow: '0 10px 22px rgba(15,23,42,0.65)',
              backdropFilter: 'blur(18px) saturate(150%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
            }}
          >
            <div className="text-muted">Текущий статус валидации</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                gap: 8,
              }}
            >
              <div>
                <div style={{ opacity: 0.8 }}>Последний файл</div>
                <div style={{ fontWeight: 500 }}>
                  {lastFileName ?? <span className="text-muted">не загружен</span>}
                </div>
              </div>
              <div>
                <div style={{ opacity: 0.8 }}>Сопоставлено строк</div>
                <div style={{ fontWeight: 500 }}>{matchedCount || 0}</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 4,
              }}
            >
              <div className="chip chip-sm">
                Предсказаний модели: {reviews.length || 0}
              </div>
              <div className="chip chip-sm">
                Есть trueLabel: {matchedCount || 0}
              </div>
            </div>

            {/* заметная кнопка сброса */}
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                className="btn btn-sm"
                type="button"
                onClick={handleResetValidation}
                disabled={loadingLocal || (!lastFileName && !matchedCount)}
                style={{
                  fontSize: 11,
                  paddingInline: 12,
                  width: '100%',
                  justifyContent: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⟲</span>
                <span>Сбросить валидацию</span>
              </button>
            </div>

            {!reviews.length && (
              <p className="chart-description" style={{ marginTop: 4 }}>
                Пока нет предсказаний модели. Сначала загрузите CSV на вкладке «Анализ» и запустите
                расчёт, затем вернитесь сюда и загрузите валидационный файл.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 2. Macro-F1 и общий статус модели */}
      <section className="chart-card">
        <h3>2. Качество модели</h3>
        {!hasMetrics ? (
          <p className="chart-description">
            Чтобы увидеть macro-F1 и метрики по классам, загрузите валидационный CSV и убедитесь, что
            для части строк заданы и <code>predictedLabel</code>, и <code>trueLabel</code>.
          </p>
        ) : (
          <div
            style={{
              marginTop: 6,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
              gap: 16,
            }}
          >
            {/* слева — большой macro-F1 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 18,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {formatNumber(metrics?.macroF1)}
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Среднее F1 по трём классам (0, 1, 2) при равном весе классов. Чем ближе к{' '}
                  <strong>1.000</strong>, тем ближе модель к эталонной разметке.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <div className="chip chip-sm">
                  Строк с эталонной меткой: {matchedCount || 0}
                </div>
                <div className="chip chip-sm">
                  Всего строк в датасете: {reviews.length || 0}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-secondary btn"
                  type="button"
                  onClick={handleDownloadReport}
                >
                  Скачать отчёт (CSV)
                </button>
              </div>
            </div>

            {/* справа — небольшой стеклянный summary */}
            <div
              style={{
                borderRadius: 18,
                padding: '10px 12px',
                background: 'var(--tesa-surface-soft)',
                border: '1px solid var(--tesa-border-subtle)',
                boxShadow: '0 10px 22px rgba(15,23,42,0.65)',
                backdropFilter: 'blur(18px) saturate(150%)',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div className="text-muted">Краткое резюме</div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  lineHeight: 1.4,
                }}
              >
                <li>Используются только строки, где есть и предсказанная, и истинная метка.</li>
                <li>
                  Интерпретация кодов <code>label</code> из валидационного файла берётся из настроек
                  сопоставления классов.
                </li>
                <li>Ниже можно детально посмотреть метрики по классам и confusion matrix.</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* 3. Метрики по классам — карточки + мини-прогресс-бары */}
      <section className="chart-card">
        <h3>3. Метрики по классам</h3>
        {!hasMetrics ? (
          <p className="chart-description">
            Метрики появятся после успешной загрузки валидационного файла и сопоставления текстов.
          </p>
        ) : (
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {metrics?.perClass.map((c) => {
              const safePrec = Number.isFinite(c.precision) ? c.precision : 0;
              const safeRec = Number.isFinite(c.recall) ? c.recall : 0;
              const safeF1 = Number.isFinite(c.f1) ? c.f1 : 0;

              const mkWidth = (val: number) =>
                `${Math.max(0, Math.min(1, val || 0)) * 100}%`;

              return (
                <div
                  key={c.label}
                  style={{
                    borderRadius: 18,
                    padding: '10px 12px',
                    background: 'var(--tesa-surface-soft)',
                    border: '1px solid var(--tesa-border-subtle)',
                    boxShadow: '0 10px 22px rgba(15,23,42,0.65)',
                    backdropFilter: 'blur(18px) saturate(150%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        padding: '3px 9px',
                        borderRadius: 999,
                        border: '1px solid var(--tesa-border-subtle)',
                        fontSize: 11,
                        opacity: 0.9,
                      }}
                    >
                      {labelTitle(c.label)}
                    </div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {formatNumber(c.f1)}
                    </div>
                  </div>

                  {/* Precision */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        opacity: 0.9,
                      }}
                    >
                      <span>Precision</span>
                      <span>{formatNumber(c.precision)}</span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.9)',
                        overflow: 'hidden',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: mkWidth(safePrec),
                          background:
                            'linear-gradient(90deg, var(--tesa-primary), var(--tesa-cyan))',
                        }}
                      />
                    </div>
                  </div>

                  {/* Recall */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        opacity: 0.9,
                        marginTop: 4,
                      }}
                    >
                      <span>Recall</span>
                      <span>{formatNumber(c.recall)}</span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.9)',
                        overflow: 'hidden',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: mkWidth(safeRec),
                          background:
                            'linear-gradient(90deg, var(--tesa-primary), var(--tesa-cyan))',
                        }}
                      />
                    </div>
                  </div>

                  {/* F1 ещё раз, но как мини-бар */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        opacity: 0.9,
                        marginTop: 4,
                      }}
                    >
                      <span>F1</span>
                      <span>{formatNumber(c.f1)}</span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 999,
                        background: 'rgba(15,23,42,0.9)',
                        overflow: 'hidden',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: mkWidth(safeF1),
                          background:
                            'linear-gradient(90deg, var(--tesa-primary), var(--tesa-cyan))',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Confusion matrix */}
      {settings.visualizations.showConfusionMatrix && (
        <section className="chart-card">
          <h3>4. Confusion matrix</h3>
          {!hasMetrics ? (
            <p className="chart-description">
              Матрица ошибок покажет, как часто модель путает классы. Она появится после загрузки
              валидационного CSV.
            </p>
          ) : (
            <>
              <p className="chart-description">
                Строки — истинная метка (True label), столбцы — предсказанная (Predicted label). Внутри
                — процент по строке и абсолютное количество примеров. Интерпретация кодов берётся из
                текущей матрицы сопоставления классов.
              </p>
              <div className="confusion-grid">
                <div className="confusion-header-top">True \ Pred</div>
                {labelNames.map((lbl) => (
                  <div key={`ph-${lbl}`} className="confusion-header-top">
                    {lbl}
                  </div>
                ))}

                {labelNames.map((trueLbl, i) => (
                  <React.Fragment key={`row-${trueLbl}`}>
                    <div className="confusion-header-left">{trueLbl}</div>
                    {labelNames.map((_predLbl, j) => {
                      const count = confusionMatrix[i]?.[j] ?? 0;
                      const frac = confusionPercents[i]?.[j] ?? 0;
                      const pct = frac * 100;
                      const style = getCellStyle(frac);
                      return (
                        <div
                          key={`cell-${i}-${j}`}
                          className="confusion-cell"
                          style={style}
                        >
                          <div className="confusion-cell-main">
                            {pct.toFixed(1)}%
                          </div>
                          <div className="confusion-cell-sub">{count}</div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default MetricsPage;

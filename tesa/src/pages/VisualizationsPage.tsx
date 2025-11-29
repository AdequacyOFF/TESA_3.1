import React, { useMemo } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { useSettings } from '../context/SettingsContext';
import type { SentimentLabel } from '../types/sentiment';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  normalizeLabelMapping,
  conceptLabelToDatasetCode,
} from '../utils/labelMapping';

const sentimentToText = (label: SentimentLabel) => {
  if (label === 0) return 'Отрицательные';
  if (label === 1) return 'Нейтральные';
  return 'Положительные';
};

const sentimentColors: Record<SentimentLabel, string> = {
  0: '#ef4444',
  1: '#9ca3af',
  2: '#22c55e',
};

const VisualizationsPage: React.FC = () => {
  const { reviews, filters } = useAnalysis();
  const { settings } = useSettings();

  const filtered = useMemo(() => {
    let rows = reviews.slice();

    // тональность с учётом ручных правок
    rows = rows.filter((row) => {
      const effectiveLabel = row.correctedLabel ?? row.predictedLabel;
      if (effectiveLabel === undefined) return true;
      return filters.sentiments.includes(effectiveLabel);
    });

    // источник
    if (filters.sources.length) {
      rows = rows.filter((row) => row.src && filters.sources.includes(row.src));
    }

    // статус строки
    if (filters.status === 'corrected') {
      rows = rows.filter((row) => row.correctedLabel !== undefined);
    } else if (filters.status === 'uncorrected') {
      rows = rows.filter((row) => row.correctedLabel === undefined);
    }

    // поиск
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      if (filters.searchMode === 'text') {
        rows = rows.filter((row) => row.text.toLowerCase().includes(q));
      } else {
        rows = rows.filter((row) => (row.src ?? '').toLowerCase().includes(q));
      }
    }

    return rows;
  }, [reviews, filters]);

  const normalizedLabelMapping = useMemo(
    () => normalizeLabelMapping(settings.labelMapping),
    [settings.labelMapping],
  );

  // helper: получить "код датасета" для концептуальной метки, с fallback на саму метку
  const getDatasetCodeForConcept = (concept: SentimentLabel): number | SentimentLabel => {
    const code = conceptLabelToDatasetCode(concept as any, normalizedLabelMapping);
    return typeof code === 'number' ? code : concept;
  };

  const totalCount = filtered.length;

  // распределение по тональностям
  const sentimentData = useMemo(() => {
    const counts: Record<SentimentLabel, number> = { 0: 0, 1: 0, 2: 0 };

    filtered.forEach((row) => {
      const eff = row.correctedLabel ?? row.predictedLabel;
      if (eff === 0 || eff === 1 || eff === 2) {
        counts[eff]++;
      }
    });

    const data = ([0, 1, 2] as SentimentLabel[])
      .map((label) => {
        const code = getDatasetCodeForConcept(label);
        return {
          label,
          name: `${code} · ${sentimentToText(label)}`,
          value: counts[label],
        };
      })
      .filter((d) => d.value > 0);

    return { counts, data };
  }, [filtered, normalizedLabelMapping]); // getDatasetCodeForConcept зависит от normalizedLabelMapping

  // разрез по источникам — топ-10
  const sourceData = useMemo(() => {
    const map = new Map<
      string,
      { src: string; neg: number; neu: number; pos: number; total: number }
    >();

    filtered.forEach((row) => {
      const eff = row.correctedLabel ?? row.predictedLabel;
      if (eff !== 0 && eff !== 1 && eff !== 2) return;

      const key = row.src ?? '— источник не указан';
      if (!map.has(key)) {
        map.set(key, { src: key, neg: 0, neu: 0, pos: 0, total: 0 });
      }
      const entry = map.get(key)!;
      if (eff === 0) entry.neg += 1;
      if (eff === 1) entry.neu += 1;
      if (eff === 2) entry.pos += 1;
      entry.total += 1;
    });

    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return arr.slice(0, 10);
  }, [filtered]);

  const hasSentimentData = sentimentData.data.length > 0;
  const hasSourceData = sourceData.length > 0;

  const shortenSource = (src: string) => {
    if (src.length <= 40) return src;
    return src.slice(0, 37) + '…';
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="page-header-title">Визуализации</div>
      </div>

      {/* сводка */}
      <section
        className="chart-card"
        style={{
          marginTop: 6,
          paddingTop: 10,
          paddingBottom: 12,
        }}
      >
        <h3>1. Сводка по выборке</h3>
        <p className="chart-description">
          Учитываются только строки, прошедшие через текущие фильтры и поиск. Тональность берётся
          с учётом ручных правок.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            marginTop: 8,
          }}
        >
          {[
            {
              key: 'total',
              label: 'Всего текстов',
              value: totalCount,
            },
            {
              key: 'neg',
              label: `${getDatasetCodeForConcept(0)} · Отрицательные`,
              value: sentimentData.counts[0],
            },
            {
              key: 'neu',
              label: `${getDatasetCodeForConcept(1)} · Нейтральные`,
              value: sentimentData.counts[1],
            },
            {
              key: 'pos',
              label: `${getDatasetCodeForConcept(2)} · Положительные`,
              value: sentimentData.counts[2],
            },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                borderRadius: 14,
                padding: '8px 10px',
                background: 'var(--tesa-surface-soft)',
                border: '1px solid var(--tesa-border-subtle)',
                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.60)',
                backdropFilter: 'blur(18px) saturate(150%)',
              }}
            >
              <div
                className="text-muted"
                style={{ fontSize: 11, marginBottom: 3 }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 14,
          marginTop: 14,
          alignItems: 'stretch',
        }}
      >
        {/* donut по тональностям */}
        {settings.visualizations.showSentimentDistribution && (
          <section className="chart-card">
            <h3>2. Распределение по тональностям</h3>

            {!hasSentimentData ? (
              <p className="chart-description">
                Пока нет данных для построения диаграммы. Убедитесь, что для текстов есть
                предсказанные или исправленные метки и фильтры не скрывают всё.
              </p>
            ) : (
              <>
                <p className="chart-description">
                  Круговая диаграмма показывает долю текстов с каждой тональностью (в кодировке
                  вашего датасета). Точные значения и проценты доступны во всплывающей подсказке.
                </p>

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData.data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={4}
                        labelLine={false}
                        label={false}
                      >
                        {sentimentData.data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={sentimentColors[entry.label]}
                            stroke="rgba(15,23,42,0.9)"
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => {
                          const total = sentimentData.data.reduce(
                            (acc, d) => acc + d.value,
                            0,
                          );
                          const v = Number(value) || 0;
                          const pct = total ? ((v / total) * 100).toFixed(1) : '0.0';
                          return [`${v} (${pct}%)`, props.payload.name];
                        }}
                        contentStyle={{
                          backgroundColor: 'var(--tesa-surface-alt)',
                          borderRadius: 12,
                          border: '1px solid var(--tesa-border-subtle)',
                          boxShadow: '0 10px 24px rgba(15,23,42,0.7)',
                          color: 'var(--tesa-text)',
                          fontSize: 12,
                        }}
                        labelStyle={{
                          color: 'var(--tesa-muted)',
                          fontSize: 11,
                        }}
                        itemStyle={{
                          color: 'var(--tesa-text)',
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 10,
                    fontSize: 11,
                  }}
                >
                  {sentimentData.data.map((d) => (
                    <div
                      key={d.label}
                      className="legend-pill"
                    >
                      <span
                        className="legend-dot"
                        style={{ background: sentimentColors[d.label] }}
                      />
                      <span>{d.name}</span>
                      <span className="text-muted">{d.value} шт.</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* источники — топ-лист, без диаграмм Recharts */}
        {settings.visualizations.showSourceBreakdown && (
          <section className="chart-card">
            <h3>3. Источники (топ-10)</h3>

            {!hasSourceData ? (
              <p className="chart-description">
                В данных нет источников (<code>src</code>) или они не попадают под текущие фильтры.
                Загрузите CSV со столбцом <code>src</code> и/или ослабьте фильтры.
              </p>
            ) : (
              <>
                <div className="source-list">
                  {sourceData.map((item, index) => {
                    const { src, neg, neu, pos, total } = item;

                    const negPct = total ? Math.round((neg / total) * 100) : 0;
                    const neuPct = total ? Math.round((neu / total) * 100) : 0;
                    const posPct = total ? Math.round((pos / total) * 100) : 0;

                    const maxVal = Math.max(neg, neu, pos);
                    let dominant: SentimentLabel | null = null;
                    if (maxVal > 0) {
                      if (maxVal === pos) dominant = 2;
                      else if (maxVal === neu) dominant = 1;
                      else dominant = 0;
                    }

                    const negCode = getDatasetCodeForConcept(0);
                    const neuCode = getDatasetCodeForConcept(1);
                    const posCode = getDatasetCodeForConcept(2);

                    return (
                      <div
                        key={src + index}
                        className={
                          index === 0
                            ? 'source-list-row source-list-row-top'
                            : 'source-list-row'
                        }
                      >
                        <div className="source-list-rank">#{index + 1}</div>
                        <div className="source-list-content">
                          <div className="source-list-header">
                            <div
                              className="source-list-name"
                              title={src}
                            >
                              {shortenSource(src)}
                            </div>
                            <div className="text-muted">
                              {total} текстов
                            </div>
                          </div>

                          <div className="source-list-bar">
                            <div
                              className="source-list-bar-segment source-list-bar-neg"
                              style={{ width: `${negPct}%` }}
                            />
                            <div
                              className="source-list-bar-segment source-list-bar-neu"
                              style={{ width: `${neuPct}%` }}
                            />
                            <div
                              className="source-list-bar-segment source-list-bar-pos"
                              style={{ width: `${posPct}%` }}
                            />
                          </div>

                          <div className="source-list-meta">
                            <span className="source-list-chip source-list-chip-neg">
                              {negCode} · {neg} ({negPct}%)
                            </span>
                            <span className="source-list-chip source-list-chip-neu">
                              {neuCode} · {neu} ({neuPct}%)
                            </span>
                            <span className="source-list-chip source-list-chip-pos">
                              {posCode} · {pos} ({posPct}%)
                            </span>
                            {dominant !== null && (
                              <span className="source-list-chip source-list-chip-dominant">
                                Основная: {sentimentToText(dominant)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default VisualizationsPage;

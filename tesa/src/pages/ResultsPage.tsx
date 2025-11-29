// src/pages/ResultsPage.tsx
import React, { useMemo, useState } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { useSettings } from '../context/SettingsContext';
import { type ReviewRow, type SentimentLabel } from '../types/sentiment';
import {
  normalizeLabelMapping,
  areLabelsEqualByConcept,
  conceptLabelToDatasetCode,
  modelCodeToConceptLabel,
  datasetCodeToConceptLabel,
} from '../utils/labelMapping';

// сортируем по id, src или эффективной метке
type SortField = 'id' | 'src' | 'label';

const sentimentToText = (label: SentimentLabel) => {
  if (label === 0) return 'Отрицательная';
  if (label === 1) return 'Нейтральная';
  return 'Положительная';
};

const sentimentBadgeClass = (label: SentimentLabel) => {
  if (label === 0) return 'badge badge-negative';
  if (label === 1) return 'badge badge-neutral';
  return 'badge badge-positive';
};

const ResultsPage: React.FC = () => {
  const { reviews, filters, updateCorrectedLabel } = useAnalysis();
  const { settings } = useSettings();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalRow, setModalRow] = useState<ReviewRow | null>(null);

  const normalizedLabelMapping = useMemo(
    () => normalizeLabelMapping(settings.labelMapping),
    [settings.labelMapping],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let rows = reviews.slice();

    // Фильтр по тональности (используем исправленную или предсказанную)
    rows = rows.filter((row) => {
      const effectiveLabel = row.correctedLabel ?? row.predictedLabel;
      if (effectiveLabel === undefined) return true;
      return filters.sentiments.includes(effectiveLabel);
    });

    // Фильтр по источнику
    if (filters.sources.length) {
      rows = rows.filter((row) => row.src && filters.sources.includes(row.src));
    }

    // Фильтр по статусу строки
    if (filters.status === 'corrected') {
      rows = rows.filter((row) => row.correctedLabel !== undefined);
    } else if (filters.status === 'uncorrected') {
      rows = rows.filter((row) => row.correctedLabel === undefined);
    }

    // Поиск
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      if (filters.searchMode === 'text') {
        rows = rows.filter((row) => row.text.toLowerCase().includes(q));
      } else {
        rows = rows.filter((row) => (row.src ?? '').toLowerCase().includes(q));
      }
    }

    // Сортировка
    rows.sort((a, b) => {
      let av: any;
      let bv: any;

      if (sortField === 'id') {
        av = Number(a.id);
        bv = Number(b.id);
      } else if (sortField === 'src') {
        av = a.src ?? '';
        bv = b.src ?? '';
      } else {
        // sortField === 'label' — используем эффективную метку (концептуальную)
        const aEff = a.correctedLabel ?? a.predictedLabel ?? -1;
        const bEff = b.correctedLabel ?? b.predictedLabel ?? -1;
        av = aEff;
        bv = bEff;
      }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [reviews, filters, sortField, sortDir]);

  const correctedCount = useMemo(
    () => reviews.filter((r) => r.correctedLabel !== undefined).length,
    [reviews],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleLabelChange = (id: string, value: string) => {
    if (value === '') {
      updateCorrectedLabel(id, undefined);
      return;
    }
    const num = Number(value);
    if (num === 0 || num === 1 || num === 2) {
      updateCorrectedLabel(id, num as SentimentLabel);
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return (
      <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  // helper: получить "цифру" для концептуального класса с учётом mapping
  const getDatasetCodeForConcept = (concept: SentimentLabel): number | SentimentLabel => {
    const code = conceptLabelToDatasetCode(concept as any, normalizedLabelMapping);
    return typeof code === 'number' ? code : concept;
  };

  // 🔽 ВАЖНО: экспорт только 2 колонок text,label с итоговым результатом анализа,
  // ПЕРЕПИСАННЫМ под кодировку датасета (mapping).
  const handleDownloadFinalCsv = () => {
    if (!reviews.length) return;

    const header = 'text,label';
    const lines: string[] = [header];

    reviews.forEach((row) => {
      const baseFinal = row.correctedLabel ?? row.predictedLabel;

      let labelValue = '';
      if (baseFinal === 0 || baseFinal === 1 || baseFinal === 2) {
        // baseFinal — концептуальная метка (0=neg,1=neu,2=pos)
        const concept = modelCodeToConceptLabel(baseFinal);
        const datasetCode =
          concept != null
            ? conceptLabelToDatasetCode(concept, normalizedLabelMapping)
            : baseFinal;
        labelValue = String(datasetCode);
      }

      // экранируем кавычки и оборачиваем текст в "
      const safeText = '"' + (row.text ?? '').replace(/"/g, '""') + '"';

      lines.push(`${safeText},${labelValue}`);
    });

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tesa_results_final.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ height: '90vh', overflow: 'auto ', paddingBottom: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="page-header-title">Результаты и разметка</div>
        <div className="page-header-subtitle">
          Таблица с тональностью по каждому тексту. Ручные исправления полностью заменяют исходный
          результат анализа. При выгрузке CSV остаются только текст и итоговая метка, переписанная
          под кодировку вашего датасета.
        </div>
      </div>

      {/* Стеклянная сводка + экспорт */}
      <section
        className="chart-card"
        style={{
          marginTop: 6,
          marginBottom: 10,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Сводка по разметке</div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              Состояние датасета после применения фильтров слева.
            </div>
          </div>

          <button
            className="btn"
            type="button"
            onClick={handleDownloadFinalCsv}
            disabled={!reviews.length}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              fontSize: 12,
            }}
          >
            <span>⬇︎</span>
            <span>Скачать финальный CSV</span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              Всего строк
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{reviews.length}</div>
          </div>

          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              После фильтров
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{filtered.length}</div>
          </div>

          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              Исправлено вручную
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{correctedCount}</div>
          </div>
        </div>
      </section>

      {/* Таблица результатов */}
      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60, cursor: 'pointer' }} onClick={() => handleSort('id')}>
                  ID
                  {renderSortIndicator('id')}
                </th>
                <th>Текст</th>
                <th
                  style={{ width: 140, cursor: 'pointer' }}
                  onClick={() => handleSort('src')}
                >
                  Источник
                  {renderSortIndicator('src')}
                </th>
                <th
                  style={{ width: 260, cursor: 'pointer' }}
                  onClick={() => handleSort('label')}
                >
                  Тональность (можно исправить)
                  {renderSortIndicator('label')}
                </th>
              </tr>
            </thead>
            <tbody>
              {!paged.length && (
                <tr>
                  <td colSpan={4}>
                    <span className="text-muted">
                      Нет строк, подходящих под текущие фильтры / поиск. Попробуйте сбросить
                      фильтры слева.
                    </span>
                  </td>
                </tr>
              )}

              {paged.map((row) => {
                const effectiveLabel = (row.correctedLabel ?? row.predictedLabel) as
                  | SentimentLabel
                  | undefined;

                let rowClass = '';
                if (row.trueLabel !== undefined && effectiveLabel !== undefined) {
                  const equal = areLabelsEqualByConcept(
                    row.trueLabel as number,
                    effectiveLabel as number,
                    normalizedLabelMapping,
                  );
                  rowClass = equal ? 'row-match' : 'row-mismatch';
                }

                // цифра для индикатора (dataset-code), а не "сырое" 0/1/2
                const effectiveCode =
                  effectiveLabel !== undefined
                    ? getDatasetCodeForConcept(effectiveLabel)
                    : undefined;

                return (
                  <tr key={row.id} className={rowClass} style={{ cursor: 'pointer' }}>
                    <td onClick={() => setModalRow(row)}>{row.id}</td>
                    <td onClick={() => setModalRow(row)}>
                      <div className="text-ellipsis">{row.text}</div>
                    </td>
                    <td onClick={() => setModalRow(row)}>
                      {row.src ?? <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div
                        style={{ marginBottom: 4, cursor: 'pointer' }}
                        onClick={() => setModalRow(row)}
                      >
                        {effectiveLabel !== undefined ? (
                          <div className={sentimentBadgeClass(effectiveLabel)}>
                            {sentimentToText(effectiveLabel)} ({effectiveCode})
                          </div>
                        ) : (
                          <span className="text-muted">нет предсказания</span>
                        )}
                      </div>

                      {/* стеклянный селект для исправления */}
                      <div className="select-control" style={{ marginTop: 2 }}>
                        <select
                          value={
                            row.correctedLabel !== undefined ? String(row.correctedLabel) : ''
                          }
                          onChange={(e) => handleLabelChange(row.id, e.target.value)}
                        >
                          <option value="">— оставить как есть</option>
                          <option value="0">
                            {getDatasetCodeForConcept(0)} · отрицательная
                          </option>
                          <option value="1">
                            {getDatasetCodeForConcept(1)} · нейтральная
                          </option>
                          <option value="2">
                            {getDatasetCodeForConcept(2)} · положительная
                          </option>
                        </select>
                      </div>

                      {row.correctedLabel !== undefined && (
                        <div className="text-muted" style={{ marginTop: 2, fontSize: 11 }}>
                          исправлено вручную
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Пагинация / футер */}
        <div className="table-footer">
          <div className="table-footer-left">
            <span className="text-muted">
              Показано {paged.length} из {filtered.length} строк
            </span>
          </div>
          <div className="table-footer-right" style={{ gap: 6 }}>
            <div className="text-muted" style={{ fontSize: 11, marginRight: 4 }}>
              На странице:
            </div>
            <div className="select-control" style={{ width: 120, marginRight: 6 }}>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 / стр</option>
                <option value={20}>20 / стр</option>
                <option value={50}>50 / стр</option>
                <option value={100}>100 / стр</option>
              </select>
            </div>
            <button
              className="btn-secondary btn btn-sm"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            <span style={{ margin: '0 6px', fontSize: 12 }}>
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn-secondary btn btn-sm"
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Модалка с полным текстом и редактированием */}
      {modalRow && (
        <div className="modal-overlay" onClick={() => setModalRow(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Полный текст отзыва</h3>
            <div className="modal-meta">
              <div>
                ID: <strong>{modalRow.id}</strong>
              </div>
              <div>
                Источник:{' '}
                <strong>
                  {modalRow.src ?? <span className="text-muted">не указан</span>}
                </strong>
              </div>
            </div>
            <div className="modal-text">{modalRow.text}</div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Текущая тональность:</div>
              {(() => {
                const eff = (modalRow.correctedLabel ?? modalRow.predictedLabel) as
                  | SentimentLabel
                  | undefined;
                const effCode =
                  eff !== undefined ? getDatasetCodeForConcept(eff) : undefined;
                return eff !== undefined ? (
                  <div className={sentimentBadgeClass(eff)}>
                    {sentimentToText(eff)} ({effCode})
                  </div>
                ) : (
                  <span className="text-muted">нет предсказания</span>
                );
              })()}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Исправить тональность:</div>
              <div className="select-control">
                <select
                  value={
                    modalRow.correctedLabel !== undefined ? String(modalRow.correctedLabel) : ''
                  }
                  onChange={(e) => {
                    handleLabelChange(modalRow.id, e.target.value);
                    const val = e.target.value;
                    let updated = modalRow;
                    if (val === '') {
                      updated = { ...modalRow, correctedLabel: undefined };
                    } else {
                      const num = Number(val);
                      if (num === 0 || num === 1 || num === 2) {
                        updated = { ...modalRow, correctedLabel: num as SentimentLabel };
                      }
                    }
                    setModalRow(updated);
                  }}
                >
                  <option value="">— оставить как есть</option>
                  <option value="0">
                    {getDatasetCodeForConcept(0)} · отрицательная
                  </option>
                  <option value="1">
                    {getDatasetCodeForConcept(1)} · нейтральная
                  </option>
                  <option value="2">
                    {getDatasetCodeForConcept(2)} · положительная
                  </option>
                </select>
              </div>
            </div>

            {modalRow.trueLabel !== undefined && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                Эталонная метка:{' '}
                <strong>
                  {(() => {
                    const trueConcept = datasetCodeToConceptLabel(
                      modalRow.trueLabel as number,
                      normalizedLabelMapping,
                    );
                    if (trueConcept == null) {
                      return <>неизвестно ({modalRow.trueLabel})</>;
                    }
                    return (
                      <>
                        {sentimentToText(trueConcept as SentimentLabel)} ({modalRow.trueLabel})
                      </>
                    );
                  })()}
                </strong>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn-secondary btn" type="button" onClick={() => setModalRow(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;

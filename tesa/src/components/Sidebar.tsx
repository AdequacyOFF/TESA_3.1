import React, { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';
import { useSettings } from '../context/SettingsContext';
import { type SentimentLabel } from '../types/sentiment';
import { exportResultsCsv } from '../services/csvUtils';
import {
  normalizeLabelMapping,
  conceptLabelToDatasetCode,
} from '../utils/labelMapping';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const isAnalyzePage = location.pathname.startsWith('/analyze');
  const isResultsPage = location.pathname.startsWith('/results');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validationInputRef = useRef<HTMLInputElement | null>(null);

  const [dragActive, setDragActive] = useState(false);

  const [exportIncludeId, setExportIncludeId] = useState<boolean>(true);
  const [exportIncludeText, setExportIncludeText] = useState<boolean>(true);

  const {
    rawDataset,
    job,
    loading,
    loadCsvFile,
    runAnalysis,
    reviews,
    filters,
    updateFilters,
    resetFilters,
    applyValidationFile,
    resetValidation,
  } = useAnalysis();

  const { settings } = useSettings();

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.src) set.add(r.src);
    });
    return Array.from(set);
  }, [reviews]);

  // нормализованный маппинг: dataset-code (0/1/2) <-> смысловой класс (neg/neu/pos)
  const normalizedMapping = useMemo(
    () => normalizeLabelMapping(settings.labelMapping),
    [settings.labelMapping],
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadCsvFile(file);
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadCsvFile(file);
    }
  };

  const handleValidationClick = () => {
    validationInputRef.current?.click();
  };

  const handleValidationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      applyValidationFile(file);
    }
    e.target.value = '';
  };

  const toggleSentiment = (label: SentimentLabel) => {
    const current = filters.sentiments;
    if (current.includes(label)) {
      const next = current.filter((x) => x !== label);
      updateFilters({ sentiments: next.length ? next : current });
    } else {
      updateFilters({ sentiments: [...current, label] });
    }
  };

  const getSentimentChipText = (label: SentimentLabel) => {
    const datasetCode = conceptLabelToDatasetCode(label as any, normalizedMapping);
    const codeToShow =
      typeof datasetCode === 'number' ? datasetCode : label;

    if (label === 0) return `${codeToShow} · отрицательные`;
    if (label === 1) return `${codeToShow} · нейтральные`;
    return `${codeToShow} · положительные`;
  };

  const handleRunAnalysisClick = async () => {
    // при новом запуске анализа сбрасываем валидацию/метрики
    await resetValidation();
    await runAnalysis();
  };

  /* ====== ВЕТКА /analyze ====== */
  if (isAnalyzePage) {
    return (
      <aside className="sidebar" style={{ height: '92vh', overflow: 'auto' }}>
        {/* Загрузка данных */}
        <div>
          <div className="sidebar-section-title">Загрузка данных</div>
          <div className="sidebar-section">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid var(--tesa-border-subtle)',
                    background:
                      'linear-gradient(135deg, rgba(15,23,42,0.1), rgba(148,163,184,0.16))',
                  }}
                >
                  CSV
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Файл с отзывами</div>
                </div>
              </div>

              {rawDataset && (
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    border: '1px solid var(--tesa-border-subtle)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rawDataset.totalRows} строк
                </div>
              )}
            </div>

            <div
              className={dragActive ? 'dropzone dropzone-active' : 'dropzone'}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: '1px solid var(--tesa-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  📂
                </div>
                <div style={{ fontSize: 13 }}>
                  Бросьте сюда <strong>CSV</strong>-файл
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  или выберите на диске
                </div>
              </div>

              <button className="btn-secondary btn" type="button" onClick={handleBrowseClick}>
                Выбрать файл…
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {rawDataset && (
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <div className="text-muted" style={{ marginBottom: 2 }}>
                  Текущий датасет:
                </div>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={rawDataset.fileName}
                >
                  {rawDataset.fileName}
                </div>
                <div className="text-muted" style={{ marginTop: 4 }}>
                  Строк: {rawDataset.totalRows}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Запуск анализа */}
        <div>
          <div className="sidebar-section-title">Запуск анализа</div>
          <div className="sidebar-section">
            <button
              className="btn"
              type="button"
              onClick={handleRunAnalysisClick}
              disabled={loading || !rawDataset}
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            >
              {loading && job?.status === 'processing' ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      border: '2px solid rgba(249,250,251,0.5)',
                      borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  Анализируем…
                </>
              ) : (
                <>Запустить анализ</>
              )}
            </button>

            <div style={{ marginTop: 10, fontSize: 12 }}>
              {job ? (
                <>
                  <div style={{ marginBottom: 2 }}>
                    Статус:{' '}
                    <strong>
                      {job.status === 'processing' && 'обработка'}
                      {job.status === 'finished' && 'готово'}
                      {job.status === 'failed' && 'ошибка'}
                      {!['processing', 'pending', 'finished', 'failed'].includes(job.status) &&
                        job.status}
                    </strong>
                  </div>
                  {job.totalRows !== undefined && (
                    <div className="text-muted">Строк в файле: {job.totalRows}</div>
                  )}
                  {job.status === 'failed' && job.errorMessage && (
                    <div style={{ marginTop: 6, color: '#fca5a5' }}>Ошибка: {job.errorMessage}</div>
                  )}
                </>
              ) : (
                <div className="text-muted">Анализ ещё не запускался.</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  /* ====== ВЕТКА /results ====== */
  if (isResultsPage) {
    return (
      <aside className="sidebar" style={{ height: '92vh', overflow: 'auto' }}>
        {/* Блок 1: Фильтры разметки */}
        <div>
          <div className="sidebar-section-title">Фильтры разметки</div>
          <div className="sidebar-section">
            {/* Тональность */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Тональность</span>
                <span className="text-muted" style={{ fontSize: 11 }} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[0, 1, 2].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={
                      filters.sentiments.includes(label as SentimentLabel)
                        ? 'chip chip-active'
                        : 'chip'
                    }
                    onClick={() => toggleSentiment(label as SentimentLabel)}
                    style={{ fontSize: 11, paddingInline: 10 }}
                  >
                    {getSentimentChipText(label as SentimentLabel)}
                  </button>
                ))}
              </div>
            </div>

            {/* Источник */}
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Источник (src)</span>
                {filters.sources[0] && (
                  <span
                    className="text-muted"
                    style={{
                      fontSize: 11,
                      maxWidth: 130,
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={filters.sources[0]}
                  >
                    {filters.sources[0]}
                  </span>
                )}
              </div>

              <div className="select-control">
                <select
                  value={filters.sources[0] ?? ''}
                  onChange={(e) =>
                    updateFilters({
                      sources: e.target.value ? [e.target.value] : [],
                    })
                  }
                >
                  <option value="">Все источники</option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Статус строки */}
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>Статус строки</span>
                <span className="text-muted" style={{ fontSize: 11 }}>
                  корректировка
                </span>
              </div>

              <div className="select-control">
                <select
                  value={filters.status}
                  onChange={(e) =>
                    updateFilters({
                      status: e.target.value as any,
                    })
                  }
                >
                  <option value="all">Все</option>
                  <option value="corrected">Только исправленные</option>
                  <option value="uncorrected">Только без исправлений</option>
                </select>
              </div>
            </div>

            {/* Сброс фильтров */}
            <div style={{ marginTop: 12 }}>
              <button
                className="btn-secondary btn"
                type="button"
                onClick={resetFilters}
                style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        </div>

        {/* Блок 2: Поиск */}
        <div>
          <div className="sidebar-section-title">Поиск</div>
          <div className="sidebar-section">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>Поиск по разметке</span>
              <span className="text-muted" style={{ fontSize: 11 }}>
                {filters.searchMode === 'src' ? 'по источнику' : 'по тексту'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 8,
                fontSize: 12,
              }}
            >
              <button
                type="button"
                className={
                  filters.searchMode === 'text' ? 'chip chip-active chip-sm' : 'chip chip-sm'
                }
                onClick={() => updateFilters({ searchMode: 'text' })}
              >
                По тексту
              </button>
              <button
                type="button"
                className={
                  filters.searchMode === 'src' ? 'chip chip-active chip-sm' : 'chip chip-sm'
                }
                onClick={() => updateFilters({ searchMode: 'src' })}
              >
                По источнику
              </button>
            </div>

            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => updateFilters({ searchQuery: e.target.value })}
              placeholder={
                filters.searchMode === 'src'
                  ? 'Поиск по src…'
                  : 'Поиск по тексту…'
              }
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Блок 3: Экспорт & валидация */}
        <div>
          <div className="sidebar-section-title">Экспорт & валидация</div>
          <div className="sidebar-section">
            <button
              className="btn"
              type="button"
              onClick={() =>
                exportResultsCsv(reviews, settings.labelMapping, {
                  includeId: exportIncludeId,
                  includeText: exportIncludeText,
                })
              }
              disabled={!reviews.length}
              style={{ width: '100%', marginBottom: 6, justifyContent: 'center', fontSize: 13 }}
            >
              Скачать CSV
            </button>

            {/* чекбоксы в одну строку */}
            <div
              style={{
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={exportIncludeId}
                  onChange={(e) => setExportIncludeId(e.target.checked)}
                  style={{ width: 14, height: 14 }}
                />
                <span>ID</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={exportIncludeText}
                  onChange={(e) => setExportIncludeText(e.target.checked)}
                  style={{ width: 14, height: 14 }}
                />
                <span>text</span>
              </label>
            </div>

            <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>
              В файле всегда будет колонка <code>label</code>. ID и text — по выбору.
            </div>

            <button
              className="btn-secondary btn"
              type="button"
              onClick={handleValidationClick}
              style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
            >
              Загрузить верную разметку
            </button>
            <input
              ref={validationInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleValidationChange}
            />
          </div>
        </div>
      </aside>
    );
  }

  /* ====== ДЛЯ ОСТАЛЬНЫХ ВКЛАДОК ====== */

  return (
    <aside className="sidebar" style={{ height: '92vh', overflow: 'auto' }}>
      <div>
        <div className="sidebar-section-title">Навигация</div>
        <div className="sidebar-section">
          <p style={{ marginTop: 0, marginBottom: 6, fontSize: 13 }}>
            Используйте вкладки сверху, чтобы переключаться между разделами:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }} className="text-muted">
            <li>Анализ входного CSV</li>
            <li>Результаты и разметка</li>
            <li>Визуализации</li>
            <li>Оценка качества</li>
            <li>Настройки</li>
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

import React, { useMemo } from 'react';
import {
  useSettings,
  type LabelMeaning,
} from '../context/SettingsContext';

// коды, которые реально приходят / хранятся как числа
type LabelCode = 0 | 1 | 2;

// модель ВСЕГДА: 0 = negative, 1 = neutral, 2 = positive
const MODEL_MEANING: Record<LabelCode, LabelMeaning> = {
  0: 'negative',
  1: 'neutral',
  2: 'positive',
};

const MEANING_LABEL_RU: Record<LabelMeaning, string> = {
  negative: 'Негатив',
  neutral: 'Нейтрал',
  positive: 'Позитив',
};

const MEANING_SHORT: Record<LabelMeaning, string> = {
  negative: '−',
  neutral: '0',
  positive: '+',
};

const CODES: LabelCode[] = [0, 1, 2];
const MEANING_ORDER: LabelMeaning[] = ['negative', 'neutral', 'positive'];

const DEFAULT_MAPPING: Record<LabelCode, LabelMeaning> = {
  0: 'negative',
  1: 'neutral',
  2: 'positive',
};

const vizItems = [
  {
    key: 'showSentimentDistribution' as const,
    title: 'Тональности',
    emoji: '📊',
    description: 'Донат-диаграмма по негативу, нейтралу и позитиву.',
  },
  {
    key: 'showSourceBreakdown' as const,
    title: 'Источники',
    emoji: '📚',
    description: 'Топ-источники с распределением тональностей.',
  },
  {
    key: 'showConfusionMatrix' as const,
    title: 'Confusion matrix',
    emoji: '🧩',
    description: 'Матрица ошибок по классам.',
  },
];

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, updateVisualizations } = useSettings();
  const isLightTheme = settings.theme === 'light';

  // безопасный бэкенд (на случай старых сохранённых настроек)
  const backend = settings.backend ?? { host: '5.129.212.83', port: 51000 };

  //  приводим labelMapping к нормальному виду
  const currentLabelMapping: Record<LabelCode, LabelMeaning> = useMemo(() => {
    const raw = settings.labelMapping ?? {};
    return {
      0: raw[0] ?? DEFAULT_MAPPING[0],
      1: raw[1] ?? DEFAULT_MAPPING[1],
      2: raw[2] ?? DEFAULT_MAPPING[2],
    };
  }, [settings.labelMapping]);

  // клик по ячейке матрицы (код + смысл)
  const handleMappingClick = (code: LabelCode, meaning: LabelMeaning) => {
    const prevMeaning = currentLabelMapping[code];
    if (!prevMeaning || prevMeaning === meaning) return;

    const next: Record<LabelCode, LabelMeaning> = { ...currentLabelMapping };

    // гарантия: один смысл — одно число
    CODES.forEach((c) => {
      if (c !== code && next[c] === meaning) {
        next[c] = prevMeaning;
      }
    });

    next[code] = meaning;

    updateSettings({
      labelMapping: next as any,
    });
  };

  // превью: как ответы модели будут переписаны перед показом
  const remapPreview: Record<LabelCode, LabelCode> = useMemo(() => {
    const mapping: Record<LabelCode, LabelCode> = { 0: 0, 1: 1, 2: 2 };

    CODES.forEach((modelCode) => {
      const concept = MODEL_MEANING[modelCode];
      const targetCode = CODES.find((c) => currentLabelMapping[c] === concept);
      if (targetCode !== undefined) {
        mapping[modelCode] = targetCode;
      }
    });

    return mapping;
  }, [currentLabelMapping]);

  const handleBackendHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const host = e.target.value;
    updateSettings({
      backend: {
        ...backend,
        host,
      },
    } as any);
  };

  const handleBackendPortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const port = raw === '' ? 0 : Number(raw);
    updateSettings({
      backend: {
        ...backend,
        port,
      },
    } as any);
  };

  return (
    <div style={{ height: '90vh', overflow: 'auto', paddingBottom: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="page-header-title">Настройки</div>
        <div className="page-header-subtitle">
          Соответствие ответов модели классам, какие блоки визуализаций включены, и параметры
          подключения к бэкенду.
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 14,
        }}
      >
        {/* Блок с матрицей соответствий */}
        <section className="chart-card">
          <h3>Сопоставление кодов и классов</h3>
          <p className="chart-description">
            Бэкенд всегда возвращает <code>0 = негатив</code>, <code>1 = нейтрал</code>,{' '}
            <code>2 = позитив</code>. Здесь задаётся, какие числа означают эти классы в
            валидационном датасете. Таблица — это матрица: строки = коды в файле, столбцы = смысл.
          </p>

          <div
            style={{
              marginTop: 8,
              borderRadius: 18,
              padding: '10px 12px',
              background: isLightTheme ? '#ffffff' : 'var(--tesa-surface-soft)',
              border: '1px solid var(--tesa-border-subtle)',
              boxShadow: isLightTheme
                ? '0 8px 18px rgba(15,23,42,0.06)'
                : '0 10px 22px rgba(15,23,42,0.65)',
              backdropFilter: 'blur(18px) saturate(150%)',
              fontSize: 12,
            }}
          >
            {/* Матрица */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '80px repeat(3, minmax(0, 1fr))',
                gap: 6,
                alignItems: 'stretch',
              }}
            >
              {/* верхний левый пустой угол */}
              <div />

              {MEANING_ORDER.map((meaning) => (
                <div
                  key={`head-${meaning}`}
                  style={{
                    borderRadius: 12,
                    padding: '6px 8px',
                    textAlign: 'center',
                    border: '1px solid var(--tesa-border-subtle)',
                    background: isLightTheme
                      ? '#f9fafb'
                      : 'var(--tesa-surface-alt)',
                    boxShadow: isLightTheme
                      ? '0 4px 10px rgba(15,23,42,0.04)'
                      : '0 6px 14px rgba(15,23,42,0.6)',
                    fontSize: 11,
                    color: 'var(--tesa-text)',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {MEANING_SHORT[meaning]} {MEANING_LABEL_RU[meaning]}
                  </div>
                  <div className="text-muted">
                    {meaning === 'negative' && 'negative'}
                    {meaning === 'neutral' && 'neutral'}
                    {meaning === 'positive' && 'positive'}
                  </div>
                </div>
              ))}

              {CODES.map((code) => (
                <React.Fragment key={code}>
                  {/* заголовок строки — код в датасете */}
                  <div
                    style={{
                      borderRadius: 12,
                      padding: '6px 8px',
                      border: '1px solid var(--tesa-border-subtle)',
                      background: isLightTheme
                        ? '#ffffff'
                        : 'rgba(15,23,42,0.85)',
                      boxShadow: isLightTheme
                        ? '0 4px 10px rgba(15,23,42,0.04)'
                        : '0 6px 14px rgba(15,23,42,0.7)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      color: 'var(--tesa-text)',
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Код в файле</div>
                    <div style={{ fontWeight: 600 }}>Класс {code}</div>
                  </div>

                  {MEANING_ORDER.map((meaning) => {
                    const active = currentLabelMapping[code] === meaning;
                    return (
                      <button
                        key={`${code}-${meaning}`}
                        type="button"
                        onClick={() => handleMappingClick(code, meaning)}
                        style={{
                          borderRadius: 999,
                          padding: '6px 8px',
                          border: active
                            ? '1px solid var(--tesa-primary)'
                            : '1px solid var(--tesa-border-subtle)',
                          background: active
                            ? 'var(--tesa-primary-soft)'
                            : (isLightTheme
                                ? '#ffffff'
                                : 'rgba(15,23,42,0.80)'),
                          boxShadow: active
                            ? (isLightTheme
                                ? '0 0 0 1px var(--tesa-primary-glow), 0 4px 12px rgba(15,23,42,0.16)'
                                : '0 0 0 1px var(--tesa-primary-glow), 0 6px 16px rgba(15,23,42,0.9)')
                            : (isLightTheme
                                ? '0 3px 8px rgba(15,23,42,0.06)'
                                : '0 4px 10px rgba(15,23,42,0.7)'),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          fontSize: 11,
                          color: 'var(--tesa-text)',
                          transition:
                            'background 0.12s ease, box-shadow 0.12s ease, transform 0.08s ease',
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>
                          {MEANING_SHORT[meaning]} {MEANING_LABEL_RU[meaning]}
                        </div>
                        {active && (
                          <div className="text-muted" style={{ fontSize: 10 }}>
                            выбран
                          </div>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* превью ремапа */}
            <div style={{ marginTop: 10 }}>
              <div className="text-muted" style={{ marginBottom: 4 }}>
                Как ответы модели будут переписаны перед отображением:
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {CODES.map((m) => {
                  const to = remapPreview[m];
                  const concept = MODEL_MEANING[m];
                  return (
                    <div key={m} className="chip chip-sm">
                      {m} → {to} ·{' '}
                      {concept === 'negative' && 'негатив'}
                      {concept === 'neutral' && 'нейтрал'}
                      {concept === 'positive' && 'позитив'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Блок с выбором визуализаций */}
        <section className="chart-card">
          <h3>Какие блоки показывать</h3>
          <p className="chart-description">
            Включите только те визуализации, которые нужны для вашей сессии: распределения,
            источники, confusion matrix и F1 по классам.
          </p>

          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gap: 8,
            }}
          >
            {vizItems.map((item) => {
              const enabled = settings.visualizations[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateVisualizations({
                      [item.key]: !enabled,
                    } as any)
                  }
                  style={{
                    borderRadius: 16,
                    padding: '8px 10px',
                    border: enabled
                      ? '1px solid var(--tesa-primary)'
                      : '1px solid var(--tesa-border-subtle)',
                    background: enabled
                      ? 'var(--tesa-primary-soft)'
                      : 'var(--tesa-surface-soft)',
                    boxShadow: enabled
                      ? '0 0 0 1px var(--tesa-primary-glow), 0 8px 20px rgba(15,23,42,0.8)'
                      : '0 6px 14px rgba(15,23,42,0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    textAlign: 'left',
                    fontSize: 13,
                    color: 'var(--tesa-text)',
                    transition:
                      'background 0.12s ease, box-shadow 0.12s ease, transform 0.08s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{item.emoji}</span>
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {item.description}
                    </div>
                  </div>

                  {/* простой стеклянный тумблер */}
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 999,
                      border: '1px solid var(--tesa-border-subtle)',
                      background: enabled
                        ? 'linear-gradient(135deg, var(--tesa-primary), var(--tesa-cyan))'
                        : 'rgba(15,23,42,0.9)',
                      boxShadow: enabled
                        ? '0 0 10px var(--tesa-primary-glow)'
                        : '0 4px 10px rgba(15,23,42,0.8)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: enabled ? 'flex-end' : 'flex-start',
                      transition:
                        'background 0.12s ease, box-shadow 0.12s ease, justify-content 0.12s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#f9fafb',
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Блок настроек бэкенда на всю ширину */}
      <section
        className="chart-card"
        style={{
          marginTop: 16,
        }}
      >
        <h3>Параметры подключения к бэкенду</h3>
        <p className="chart-description">
          Здесь задаётся, на какой хост и порт будут уходить запросы к API. Формат базового URL :
          <code> http://&lt;host&gt;:&lt;port&gt;/…</code>
        </p>

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <label style={{ fontSize: 12 }}>
              <span className="text-muted">Хост</span>
              <input
                type="text"
                value={backend.host}
                onChange={handleBackendHostChange}
                placeholder="5.129.212.83"
                style={{ marginTop: 4, width: '100%' }}
              />
            </label>

            <label style={{ fontSize: 12, maxWidth: 160 }}>
              <span className="text-muted">Порт</span>
              <input
                min={0}
                max={65535}
                value={backend.port || ''}
                onChange={handleBackendPortChange}
                placeholder="51000"
                style={{ marginTop: 4, width: '100%' }}
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;

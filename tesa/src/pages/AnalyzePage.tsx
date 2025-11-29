import React from 'react';
import { Link } from 'react-router-dom';
import { useAnalysis } from '../context/AnalysisContext';
import { useSettings } from '../context/SettingsContext';
import ManualAnalysisCard from '../components/ManualAnalysisCard';

const AnalyzePage: React.FC = () => {
  const { rawDataset, job, loading } = useAnalysis();
  const { settings } = useSettings();
  const isLightTheme = settings.theme === 'light';

  const hasFile = !!rawDataset;

  const statusType: 'idle' | 'running' | 'success' | 'error' =
    !job
      ? 'idle'
      : job.status === 'finished'
      ? 'success'
      : job.status === 'failed'
      ? 'error'
      : 'running';

  const statusText =
    !job
      ? 'ещё не запускалась'
      : job.status === 'processing'
      ? 'в обработке'
      : job.status === 'finished'
      ? 'завершена'
      : job.status === 'failed'
      ? 'ошибка'
      : job.status;

  const baseStatusPillStyle: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 500,
    border: '1px solid var(--tesa-border-subtle)',
    background: isLightTheme ? '#f9fafb' : 'rgba(15, 23, 42, 0.8)',
    color: 'var(--tesa-text)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  };

  let statusPillStyle: React.CSSProperties = { ...baseStatusPillStyle };

  if (statusType === 'success') {
    statusPillStyle = isLightTheme
      ? {
          ...baseStatusPillStyle,
          background: 'rgba(22,163,74,0.08)',
          border: '1px solid rgba(22,163,74,0.7)',
          color: '#166534',
        }
      : {
          ...baseStatusPillStyle,
          background: 'var(--tesa-positive-soft)',
          border: '1px solid rgba(34,197,94,0.9)',
          color: '#dcfce7',
        };
  } else if (statusType === 'error') {
    statusPillStyle = isLightTheme
      ? {
          ...baseStatusPillStyle,
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.7)',
          color: '#991b1b',
        }
      : {
          ...baseStatusPillStyle,
          background: 'var(--tesa-danger-soft)',
          border: '1px solid rgba(248,113,113,0.9)',
          color: '#fee2e2',
        };
  } else if (statusType === 'running') {
    statusPillStyle = isLightTheme
      ? {
          ...baseStatusPillStyle,
          background: 'rgba(37,99,235,0.08)',
          border: '1px solid rgba(37,99,235,0.7)',
          color: '#1d4ed8',
        }
      : {
          ...baseStatusPillStyle,
          background: 'var(--tesa-primary-soft)',
          border: '1px solid var(--tesa-primary)',
          color: '#e5f2ff',
        };
  }

  return (
    <div style={{ height: '90vh', overflow: 'auto', paddingBottom: 16 }}>
      {/* Заголовок страницы */}
      <div style={{ marginBottom: 10 }}>
        <div className="page-header-title">Анализ входного CSV</div>
        <div className="page-header-subtitle">
          Загрузите датасет, прогоните через пайплайн и получите тональность для каждого текста.
        </div>
      </div>

      {/* Стеклянная сводка по датасету */}
      <section
        className="chart-card"
        style={{
          marginTop: 6,
          marginBottom: hasFile ? 14 : 10,
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
            <div style={{ fontSize: 13, fontWeight: 500 }}>Сводка по датасету</div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              Текущее состояние входного CSV и задачи анализа.
            </div>
          </div>
          <div style={statusPillStyle}>
            {statusType === 'running' && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--tesa-primary)',
                }}
              />
            )}
            {statusType === 'success' && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--tesa-positive)',
                }}
              />
            )}
            {statusType === 'error' && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--tesa-danger)',
                }}
              />
            )}
            {statusType === 'idle' && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'rgba(148,163,184,0.8)',
                }}
              />
            )}
            <span style={{ textTransform: 'none' }}>{statusText}</span>
          </div>
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
              Файл
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={hasFile ? rawDataset!.fileName : 'Файл не загружен'}
            >
              {hasFile ? rawDataset!.fileName : 'Файл не загружен'}
            </div>
          </div>

          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              Строк в датасете
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {hasFile ? rawDataset!.totalRows : 0}
            </div>
          </div>

          <div>
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
              Статус пайплайна
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, textTransform: 'none' }}>
              {statusText}
            </div>
          </div>
        </div>
      </section>

      {/* Если файла нет — стеклянный onboarding */}
      {!hasFile && (
        <section className="chart-card" style={{ marginTop: 4 }}>
          <h3>Как начать</h3>
          <p className="chart-description">
            Слева управляете загрузкой и предобработкой, здесь — контролируете превью и прогресс.
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {[
              {
                num: 1,
                title: 'Загрузите CSV',
                text: (
                  <>
                    В левой панели выберите CSV с колонкой <code>text</code>. Опционально:{' '}
                    <code>src</code>, <code>label</code> и <code>id</code>.
                  </>
                ),
              },
              {
                num: 2,
                title: 'Настройте предобработку',
                text: <>Включите нужные флаги токенизации, лемматизации и NER.</>,
              },
              {
                num: 3,
                title: 'Запустите анализ',
                text: (
                  <>
                    Нажмите «Запустить анализ» слева. После этого здесь появится превью и статус
                    выполнения.
                  </>
                ),
              },
            ].map((step) => (
              <div
                key={step.num}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '1px solid var(--tesa-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                    {step.title}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {step.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Если файл загружен — превью + статус пайплайна */}
      {hasFile && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1.1fr)',
            gap: 14,
            marginTop: 6,
          }}
        >
          {/* Превью CSV */}
          <section className="chart-card">
            <h3>Превью данных</h3>
            <div
              className="table-wrapper"
              style={{
                marginTop: 8,
                boxShadow: 'none',
                borderRadius: 16,
              }}
            >
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>ID</th>
                      <th>Текст</th>
                      <th style={{ width: 140 }}>Источник (src)</th>
                      <th style={{ width: 80 }}>Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawDataset!.previewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="text-muted">
                          {row.id ?? idx + 1}
                        </td>
                        <td>
                          <div className="text-ellipsis">{row.text}</div>
                        </td>
                        <td className="text-muted">
                          {row.src ?? <span style={{ opacity: 0.6 }}>—</span>}
                        </td>
                        <td className="text-muted">
                          {row.label !== undefined ? (
                            row.label
                          ) : (
                            <span style={{ opacity: 0.6 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-muted" style={{ marginTop: 8, fontSize: 11 }}>
              Если что-то не так с колонками или кодировкой — проверьте исходный CSV и загрузите его
              заново.
            </p>
          </section>

          {/* Статус задачи + переход к результатам */}
          <section className="chart-card">
            <h3>Статус пайплайна</h3>
            <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
              {job ? (
                <>
                  {job.id && (
                    <div>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        ID задачи:
                      </span>{' '}
                      <code>{job.id}</code>
                    </div>
                  )}
                  <div>
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      Статус:
                    </span>{' '}
                    <strong style={{ textTransform: 'none' }}>{statusText}</strong>
                  </div>
                  {job.totalRows !== undefined && (
                    <div className="text-muted">
                      Строк в датасете: <strong>{job.totalRows}</strong>
                    </div>
                  )}

                  {job.status === 'processing' && (
                    <div style={{ marginTop: 12 }}>
                      <div className="progress">
                        <div className="progress-inner" />
                      </div>
                      <div className="text-muted" style={{ marginTop: 4 }}>
                        Идёт обработка…
                      </div>
                    </div>
                  )}

                  {job.status === 'finished' && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 10 }}>
                        Пайплайн завершил обработку. Можно переходить к разметке и ручным
                        исправлениям.
                      </div>
                      <Link to="/results" style={{ textDecoration: 'none' }}>
                        <button className="btn-secondary btn" type="button" disabled={loading}>
                          Открыть результаты
                        </button>
                      </Link>
                    </div>
                  )}

                  {job.status === 'failed' && job.errorMessage && (
                    <div style={{ marginTop: 10, color: '#fca5a5' }}>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>Ошибка пайплайна</div>
                      <div>{job.errorMessage}</div>
                    </div>
                  )}

                  {job.status !== 'processing' &&
                    job.status !== 'finished' &&
                    job.status !== 'failed' && (
                      <div className="text-muted" style={{ marginTop: 8, fontSize: 12 }}>
                        Задача в очереди или в промежуточном статусе. Обновите страницу при
                        необходимости.
                      </div>
                    )}
                </>
              ) : (
                <div className="text-muted">
                  Задача ещё не запускалась. Настройте предобработку и нажмите «Запустить анализ» в
                  левой панели.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Консоль ручного анализа */}
      <div style={{ marginTop: 16 }}>
        <ManualAnalysisCard />
      </div>
    </div>
  );
};

export default AnalyzePage;

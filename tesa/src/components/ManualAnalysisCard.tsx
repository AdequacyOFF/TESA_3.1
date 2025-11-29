import React, { useState } from 'react';
import type { SentimentLabel } from '../types/sentiment';
import { useSettings, buildBackendBaseUrl } from '../context/SettingsContext';
import {
  analyzeText,
  type ManualAnalysisResult,
} from '../services/sentimentApi';

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

// расширяем локальный тип результата
type ManualResultExtended = ManualAnalysisResult & {
  lemmatized?: string;
  entities?: string[];
};

interface LemmatizeResponse {
  output: string;
}

interface NerResponse {
  entities: string[];
}

const callLemmatize = async (baseUrl: string, text: string): Promise<string> => {
  const res = await fetch(`${baseUrl}/lemmatize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Lemmatize error ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`,
    );
  }

  const data = (await res.json()) as LemmatizeResponse;
  return data.output ?? text;
};

const callNer = async (baseUrl: string, text: string): Promise<string[]> => {
  const res = await fetch(`${baseUrl}/ner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `NER error ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`,
    );
  }

  const data = (await res.json()) as NerResponse;
  return Array.isArray(data.entities) ? data.entities : [];
};

const ManualAnalysisCard: React.FC = () => {
  const { settings } = useSettings();

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ManualResultExtended[]>([]);

  const [useLemmatize, setUseLemmatize] = useState<boolean>(false);
  const [useNer, setUseNer] = useState<boolean>(true);

  const handleAnalyze = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const trimmed = text.trim();
      const baseUrl = buildBackendBaseUrl(settings);

      // 1. Сентимент (через /predict)
      const sentimentResult = await analyzeText(settings, trimmed);

      // 2. Дополнительно — лемматизация и NER (опционально)
      let lemmatized: string | undefined;
      let entities: string[] | undefined;

      if (useLemmatize) {
        try {
          lemmatized = await callLemmatize(baseUrl, trimmed);
        } catch (e) {
          console.error('Lemmatize failed', e);
        }
      }

      if (useNer) {
        try {
          entities = await callNer(baseUrl, trimmed);
        } catch (e) {
          console.error('NER failed', e);
        }
      }

      const extended: ManualResultExtended = {
        ...sentimentResult,
        lemmatized,
        entities,
      };

      setResults((prev) => [extended, ...prev].slice(0, 10));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Ошибка запроса к бэкенду');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setText('');
    setResults([]);
  };

  return (
    <section className="chart-card" style={{ marginTop: 18 }}>
      <h3>Ручной анализ текста</h3>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Введите отзыв, комментарий или фразу для анализа…"
        style={{
          width: '100%',
          resize: 'vertical',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 8,
          marginBottom: 10,
          justifyContent: 'flex-start',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn"
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
        >
          {loading ? 'Анализируем…' : 'Проанализировать'}
        </button>
        <button
          className="btn-secondary btn"
          type="button"
          onClick={handleClear}
          disabled={loading || (results.length === 0 && !text)}
        >
          Очистить
        </button>

        {/* чекбоксы лемматизации и NER в одной строке с кнопками */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginLeft: 8,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <input
              type="checkbox"
              checked={useLemmatize}
              onChange={(e) => setUseLemmatize(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <span>Лемматизация</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <input
              type="checkbox"
              checked={useNer}
              onChange={(e) => setUseNer(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            <span>NER (сущности)</span>
          </label>
        </div>
      </div>

      <div>
        <div className="text-muted" style={{ marginBottom: 4 }}>
          Последние запросы (до 10)
        </div>

        {results.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px dashed var(--tesa-border-subtle)',
              background: 'var(--tesa-surface)',
              padding: 10,
              fontSize: 12,
            }}
          >
            После первого запроса здесь появится мини-таблица с текстом (или
            лемматизированным текстом), итоговой тональностью и найденными сущностями.
          </div>
        ) : (
          <div
            style={{
              marginTop: 4,
              borderRadius: 14,
              border: '1px solid var(--tesa-border-subtle)',
              background: 'var(--tesa-surface)',
              overflow: 'hidden',
              maxHeight: 260,
            }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Текст</th>
                  <th style={{ width: 210 }}>Тональность</th>
                  <th style={{ width: 260 }}>Сущности</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => {
                  const label = row.predictedLabel;
                  const entities =
                    row.entities && row.entities.length
                      ? row.entities.join(', ')
                      : '—';

                  // если чекбокс лемматизации включён, показываем отредаченный текст,
                  // иначе — исходный
                  const textToShow =
                    useLemmatize && row.lemmatized ? row.lemmatized : row.text;

                  return (
                    <tr key={index}>
                      <td>{results.length - index}</td>
                      <td>
                        <div className="text-ellipsis">{textToShow}</div>
                      </td>
                      <td>
                        <div className={sentimentBadgeClass(label)}>
                          {sentimentToText(label)} ({label})
                        </div>
                      </td>
                      <td>
                        <div className="text-ellipsis">{entities}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default ManualAnalysisCard;

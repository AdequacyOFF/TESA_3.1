// src/components/ManualAnalysisCard.tsx
import React, { useState } from 'react';
import type { SentimentLabel } from '../types/sentiment';
import { useSettings } from '../context/SettingsContext';
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

const ManualAnalysisCard: React.FC = () => {
  const { settings } = useSettings();

  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ManualAnalysisResult[]>([]);

  const handleAnalyze = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const result = await analyzeText(settings, text.trim());
      setResults((prev) => [result, ...prev].slice(0, 10));
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
            После первого запроса здесь появится мини-таблица с текстом и итоговой тональностью.
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
                  <th style={{ width: 60 }}>#</th>
                  <th>Текст</th>
                  <th style={{ width: 210 }}>Тональность</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => {
                  const label = row.predictedLabel;
                  return (
                    <tr key={index}>
                      <td>{results.length - index}</td>
                      <td>
                        <div className="text-ellipsis">{row.text}</div>
                      </td>
                      <td>
                        <div className={sentimentBadgeClass(label)}>
                          {sentimentToText(label)} ({label})
                        </div>
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

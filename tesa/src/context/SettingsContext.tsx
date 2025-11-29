// src/context/SettingsContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light';
export type ModelId = 'base' | 'advanced';

// смысловая нагрузка класса
export type LabelMeaning = 'negative' | 'neutral' | 'positive';

export interface VisualizationSettings {
  showSentimentDistribution: boolean;
  showSourceBreakdown: boolean;
  showConfusionMatrix: boolean;
  showF1BarChart: boolean;
}

export interface BackendSettings {
  host: string;
  port: number;
}

export interface AppSettings {
  theme: ThemeMode;
  model: ModelId;
  visualizations: VisualizationSettings;
  // соответствие "число в датасете" -> "смысл класса"
  // ключи: 0,1,2; значения: 'negative' | 'neutral' | 'positive'
  labelMapping: Record<number, LabelMeaning>;
  // настройки бэкенда
  backend: BackendSettings;
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateVisualizations: (patch: Partial<VisualizationSettings>) => void;
  toggleTheme: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  model: 'base',
  visualizations: {
    showSentimentDistribution: true,
    showSourceBreakdown: true,
    showConfusionMatrix: true,
    showF1BarChart: true,
  },
  // по умолчанию совпадает с моделью:
  // 0 = negative, 1 = neutral, 2 = positive
  labelMapping: {
    0: 'negative',
    1: 'neutral',
    2: 'positive',
  },
  // дефолтные заглушки для бэка — можешь потом поменять на свои
  backend: {
    host: 'localhost',
    port: 8000,
  },
};

const STORAGE_KEY = 'tesa_settings_v1';

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw) ?? {};

      return {
        ...defaultSettings,
        ...parsed,
        visualizations: {
          ...defaultSettings.visualizations,
          ...(parsed.visualizations ?? {}),
        },
        labelMapping: {
          ...defaultSettings.labelMapping,
          ...(parsed.labelMapping ?? {}),
        },
        backend: {
          ...defaultSettings.backend,
          ...(parsed.backend ?? {}),
        },
      } as AppSettings;
    } catch {
      return defaultSettings;
    }
  });

  // сохранение в localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      //
    }
  }, [settings]);

  // проставляем класс для темы на <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('tesa-theme-dark', 'tesa-theme-light');
    root.classList.add(
      settings.theme === 'light' ? 'tesa-theme-light' : 'tesa-theme-dark',
    );
  }, [settings.theme]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      visualizations: {
        ...prev.visualizations,
        ...(patch.visualizations ?? {}),
      },
      labelMapping: {
        ...prev.labelMapping,
        ...(patch.labelMapping ?? {}),
      },
      backend: {
        ...prev.backend,
        ...(patch.backend ?? {}),
      },
    }));
  };

  const updateVisualizations = (patch: Partial<VisualizationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      visualizations: {
        ...prev.visualizations,
        ...patch,
      },
    }));
  };

  const toggleTheme = () => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  };

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, updateVisualizations, toggleTheme }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
};

// опционально: helper для сервисов, чтобы собирать базовый URL
export const buildBackendBaseUrl = (settings: AppSettings): string =>
  `http://${settings.backend.host}:${settings.backend.port}`;

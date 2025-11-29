import React from 'react';
import { NavLink } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useSettings } from '../context/SettingsContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { settings, toggleTheme } = useSettings();

  return (
    <div className="app-root">
      <header className="top-nav">
        <div className="top-nav-left">
          <div className="top-nav-logo">T</div>
          <div>
            <div className="top-nav-title">TESA</div>
            <div className="top-nav-subtitle">Text Emotionality Style Analyzer</div>
          </div>
        </div>

        <nav className="top-nav-tabs">
          <NavLink
            to="/analyze"
            className={({ isActive }) =>
              'top-nav-tab' + (isActive ? ' top-nav-tab-active' : '')
            }
          >
            Анализ
          </NavLink>
          <NavLink
            to="/results"
            className={({ isActive }) =>
              'top-nav-tab' + (isActive ? ' top-nav-tab-active' : '')
            }
          >
            Результаты
          </NavLink>
          <NavLink
            to="/visuals"
            className={({ isActive }) =>
              'top-nav-tab' + (isActive ? ' top-nav-tab-active' : '')
            }
          >
            Визуализации
          </NavLink>
          <NavLink
            to="/metrics"
            className={({ isActive }) =>
              'top-nav-tab' + (isActive ? ' top-nav-tab-active' : '')
            }
          >
            Оценка качества
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              'top-nav-tab' + (isActive ? ' top-nav-tab-active' : '')
            }
          >
            Настройки
          </NavLink>

          <button
            type="button"
            className="btn-secondary btn btn-sm"
            onClick={toggleTheme}
          >
            {settings.theme === 'dark' ? '🌙 Тёмная' : '☀️ Светлая'}
          </button>
        </nav>
      </header>

      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <div className="page-scroll">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

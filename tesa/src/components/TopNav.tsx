import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/analyze', label: 'Анализ' },
  { to: '/results', label: 'Результаты' },
  { to: '/visuals', label: 'Визуализации' },
  { to: '/metrics', label: 'Оценка качества' },
  { to: '/settings', label: 'Настройки' },
];

const TopNav: React.FC = () => {
  const location = useLocation();

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <div className="top-nav-logo">T</div>
        <div>
          <div className="top-nav-title">TESA</div>
          <div className="top-nav-subtitle">Text Emotionality Style Analyzer</div>
        </div>
      </div>
      <nav className="top-nav-tabs">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={isActive ? 'top-nav-tab top-nav-tab-active' : 'top-nav-tab'}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
};

export default TopNav;

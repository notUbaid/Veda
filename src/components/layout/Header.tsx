import React from 'react';
import { Menu } from 'lucide-react';
import { NotificationDropdown } from './GlobalLayoutComponents';

interface HeaderProps {
  title: string;
  subtitle: string;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 lg:mb-10">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 glass-card">
          <Menu size={24} className="text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="text-slate-400 text-sm font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NotificationDropdown />
      </div>
    </header>
  );
}

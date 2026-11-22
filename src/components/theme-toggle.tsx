'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useUIStore } from '@/lib/store';

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Sync with existing localStorage or html element class
    const saved = localStorage.getItem('trackmywork_theme') as 'dark' | 'light' | null;
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      const isHtmlDark = document.documentElement.classList.contains('dark');
      const initial = isHtmlDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'trackmywork_theme') {
        const val = e.newValue === 'dark' ? 'dark' : 'light';
        setTheme(val);
        document.documentElement.classList.toggle('dark', val === 'dark');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setTheme]);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextTheme = isCurrentlyDark ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('trackmywork_theme', nextTheme);
    } catch (_) {}
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="p-2 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 transition-colors"
        aria-label="Toggle theme"
      >
        <Moon className="w-5 h-5" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-all duration-200 border ${
        isDark
          ? 'bg-surface-800/80 border-surface-700 text-amber-400 hover:bg-surface-700/80 hover:text-amber-300 shadow-xs'
          : 'bg-white border-surface-200/80 text-surface-600 hover:bg-surface-50 hover:text-surface-900 shadow-xs'
      }`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}

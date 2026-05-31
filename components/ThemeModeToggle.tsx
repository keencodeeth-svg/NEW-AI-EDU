'use client';

import { Moon, Monitor, Sun } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

type ThemeMode = 'light' | 'dark' | 'system';

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  title: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: '浅色', title: '切换到浅色模式', Icon: Sun },
  { value: 'dark', label: '暗色', title: '切换到暗色模式', Icon: Moon },
  { value: 'system', label: '系统', title: '跟随系统外观', Icon: Monitor },
];

export default function ThemeModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const resolvedLabel = resolvedTheme === 'dark' ? '暗色' : '浅色';

  return (
    <div
      className="theme-mode-toggle"
      role="group"
      aria-label={`外观模式，当前为${theme === 'system' ? `跟随系统（${resolvedLabel}）` : resolvedLabel}`}
    >
      {themeOptions.map(({ value, label, title, Icon }) => (
        <button
          key={value}
          type="button"
          className={`theme-mode-option${theme === value ? ' active' : ''}`}
          aria-label={title}
          aria-pressed={theme === value}
          title={title}
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden="true" className="theme-mode-icon" />
          <span className="theme-mode-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StatePanel from '@/components/StatePanel';
import { emitOpenCommandPalette } from '@/lib/navigation-command';

type NavLink = { href: string; label: string };
type NavGroup = { title: string; links: NavLink[] };

const routeGlyphs: Array<[RegExp, string]> = [
  [/^\/$/, '首'],
  [/classroom/, '课'],
  [/login|register|recover/, '账'],
  [/student/, '学'],
  [/teacher/, '师'],
  [/parent/, '家'],
  [/school/, '校'],
  [/admin/, '管'],
  [/assignment|submissions/, '作'],
  [/exam|questions/, '考'],
  [/library|course|files/, '资'],
  [/report|analysis|growth|portrait/, '析'],
  [/calendar|schedule/, '历'],
  [/notification|announcements|inbox/, '信'],
  [/practice|wrong-book|diagnostic/, '练'],
  [/plan|coach|tutor/, '辅'],
  [/discussion|projects/, '协'],
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRouteGlyph(item: NavLink) {
  const source = `${item.href} ${item.label}`.toLowerCase();
  const matched = routeGlyphs.find(([pattern]) => pattern.test(source));
  return matched?.[1] ?? item.label.slice(0, 1);
}

function pickRoleQuickTabHrefs(roleLabel: string) {
  if (roleLabel.includes('学生')) {
    return ['/student', '/student/assignments', '/student/interactive-classroom', '/wrong-book'];
  }
  if (roleLabel.includes('教师')) {
    return ['/teacher', '/teacher/submissions', '/ai-classroom', '/teacher/analysis'];
  }
  if (roleLabel.includes('学校')) {
    return ['/school', '/school/interactive-classrooms', '/school/schedules', '/school/teachers'];
  }
  if (roleLabel.includes('家长')) {
    return ['/parent', '/calendar', '/notifications', '/inbox'];
  }
  if (roleLabel.includes('管理')) {
    return ['/admin', '/admin/ai-models', '/admin/launch-readiness', '/admin/questions'];
  }
  return [];
}

function pickQuickTabLinks(roleLabel: string, primaryLinks: NavLink[], mergedLinks: NavLink[]) {
  const linkByHref = new Map(mergedLinks.map((item) => [item.href, item]));
  const picked: NavLink[] = [];

  for (const href of pickRoleQuickTabHrefs(roleLabel)) {
    const item = linkByHref.get(href);
    if (item && !picked.some((link) => link.href === item.href)) {
      picked.push(item);
    }
  }

  for (const item of primaryLinks) {
    if (picked.length >= 4) break;
    if (!picked.some((link) => link.href === item.href)) {
      picked.push(item);
    }
  }

  return picked.slice(0, 4);
}

export default function MobileAppNav({
  roleLabel,
  primaryLinks,
  navGroups,
}: {
  roleLabel: string;
  primaryLinks: NavLink[];
  navGroups: NavGroup[];
}) {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [menuSessionPathname, setMenuSessionPathname] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const menuOpen = menuSessionPathname === pathname;

  const mergedLinks = useMemo(() => {
    const seen = new Set<string>();
    const merged: NavLink[] = [];
    [...primaryLinks, ...navGroups.flatMap((group) => group.links)].forEach((item) => {
      if (seen.has(item.href)) return;
      seen.add(item.href);
      merged.push(item);
    });
    return merged;
  }, [primaryLinks, navGroups]);

  const openMenu = useCallback(() => {
    setMenuSessionPathname(pathname);
  }, [pathname]);

  const closeMenu = useCallback(() => {
    setMenuSessionPathname(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const closeMenuAfterNavigation = useCallback(() => {
    setMenuSessionPathname(null);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-mobile-nav', menuOpen ? 'open' : 'closed');
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.setAttribute('data-mobile-nav', 'closed');
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const isMatched = (item: NavLink) => {
    if (!normalizedKeyword) return true;
    return (
      item.label.toLowerCase().includes(normalizedKeyword) ||
      item.href.toLowerCase().includes(normalizedKeyword)
    );
  };

  const visiblePrimaryLinks = primaryLinks.filter((item) => isMatched(item));
  const visibleGroups = navGroups
    .map((group) => ({ ...group, links: group.links.filter((item) => isMatched(item)) }))
    .filter((group) => group.links.length);
  const visibleLinkCount = useMemo(() => {
    const hrefSet = new Set<string>();
    visiblePrimaryLinks.forEach((item) => hrefSet.add(item.href));
    visibleGroups.forEach((group) => group.links.forEach((item) => hrefSet.add(item.href)));
    return hrefSet.size;
  }, [visiblePrimaryLinks, visibleGroups]);
  const quickTabLinks = useMemo(
    () => pickQuickTabLinks(roleLabel, primaryLinks, mergedLinks),
    [mergedLinks, primaryLinks, roleLabel],
  );

  function renderSheetLink(item: NavLink, key?: string) {
    return (
      <Link
        key={key ?? item.href}
        href={item.href}
        className={`mobile-nav-link${isActive(pathname, item.href) ? ' active' : ''}`}
        onClick={closeMenuAfterNavigation}
      >
        <span className="mobile-nav-link-glyph" aria-hidden="true">
          {getRouteGlyph(item)}
        </span>
        <span className="mobile-nav-link-label">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-nav-trigger"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={openMenu}
      >
        <span className="mobile-nav-trigger-icon" aria-hidden="true">
          导航
        </span>
        <span className="mobile-nav-trigger-text">{roleLabel}</span>
      </button>

      {menuOpen ? (
        <div className="mobile-nav-sheet open">
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="关闭导航菜单"
            onClick={closeMenu}
          />
          <aside
            className="mobile-nav-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="移动端导航菜单"
          >
            <div className="mobile-nav-panel-head">
              <div className="mobile-nav-title-wrap">
                <div className="mobile-nav-title">主线导航</div>
                <div className="mobile-nav-subtitle">{roleLabel}</div>
              </div>
              <button
                type="button"
                className="mobile-nav-close"
                ref={closeButtonRef}
                onClick={closeMenu}
              >
                关闭
              </button>
            </div>
            <div className="mobile-nav-search">
              <input
                className="mobile-nav-search-input"
                placeholder="搜索功能（例如：考试、题库、报告）"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                aria-label="搜索功能"
              />
              <div className="mobile-nav-search-meta">
                已显示 {visibleLinkCount} / {mergedLinks.length} 个入口
              </div>
              <div className="mobile-nav-search-actions">
                <button type="button" className="button ghost" onClick={emitOpenCommandPalette}>
                  全局搜索 Cmd/Ctrl+K
                </button>
              </div>
            </div>
            <div className="mobile-nav-sections">
              <section className="mobile-nav-section">
                <div className="mobile-nav-section-head">
                  主线功能（{visiblePrimaryLinks.length}）
                </div>
                <div className="mobile-nav-links">
                  {visiblePrimaryLinks.map((item) => renderSheetLink(item))}
                </div>
              </section>

              {visibleGroups.map((group) => (
                <section key={group.title} className="mobile-nav-section">
                  <div className="mobile-nav-section-head">
                    {group.title}（{group.links.length}）
                  </div>
                  <div className="mobile-nav-links">
                    {group.links.map((item) =>
                      renderSheetLink(item, `${group.title}-${item.href}`),
                    )}
                  </div>
                </section>
              ))}

              {visibleLinkCount === 0 ? (
                <StatePanel
                  compact
                  tone="empty"
                  title="没有匹配到功能"
                  description="可以换个关键词，或用全局搜索直达。"
                  action={
                    <button
                      type="button"
                      className="button secondary"
                      onClick={emitOpenCommandPalette}
                    >
                      打开全局搜索
                    </button>
                  }
                />
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      <nav className="mobile-tabbar" aria-label="快捷导航">
        {quickTabLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-tabbar-item${isActive(pathname, item.href) ? ' active' : ''}`}
          >
            <span className="mobile-tabbar-item-glyph" aria-hidden="true">
              {getRouteGlyph(item)}
            </span>
            <span className="mobile-tabbar-item-label">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-tabbar-item mobile-tabbar-item-menu${menuOpen ? ' active' : ''}`}
          onClick={openMenu}
        >
          <span className="mobile-tabbar-item-glyph" aria-hidden="true">
            更多
          </span>
          <span className="mobile-tabbar-item-label">菜单</span>
        </button>
      </nav>
    </>
  );
}

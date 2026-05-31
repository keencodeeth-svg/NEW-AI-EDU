import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import { getCurrentUser } from '@/lib/auth';
import UserMenu from '@/components/UserMenu';
import DensityToggle from '@/components/DensityToggle';
import ThemeModeToggle from '@/components/ThemeModeToggle';
import RoleSidebarNav from '@/components/RoleSidebarNav';
import AppToastHub from '@/components/AppToastHub';
import MobileAppNav from '@/components/MobileAppNav';
import GlobalCommandPalette from '@/components/GlobalCommandPalette';
import { ClassroomBrand } from '@/components/brand/classroom-brand';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import {
  CLASSROOM_PRODUCT_NAME,
  PLATFORM_BRAND_NAME,
  PLATFORM_BRAND_TAGLINE,
  PLATFORM_PRODUCT_NAME,
} from '@/lib/classroom-integration';
import {
  guestGroups,
  guestPrimaryLinks,
  roleLabelMap,
  roleNavConfig,
  type AppRole,
} from '@/lib/navigation/role-nav-config';
import DetailsAriaSync from '@/components/DetailsAriaSync';

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: PLATFORM_PRODUCT_NAME,
  description: `${PLATFORM_BRAND_TAGLINE} 面向学生、教师、家长与学校的智能学习与教学操作系统。`,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const role = user?.role as AppRole | undefined;
  const navConfig = role ? roleNavConfig[role] : null;
  const primaryLinks = navConfig?.primary ?? guestPrimaryLinks;
  const navGroups = navConfig?.groups ?? guestGroups;
  const roleLabel = role ? roleLabelMap[role] : '访客模式';
  const isAuthenticated = Boolean(user);

  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        data-authenticated={user ? '1' : '0'}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <I18nProvider>
            <ServerProvidersInit />
            <DetailsAriaSync />
            <a className="skip-link" href="#main-content">
              跳转到主内容
            </a>
            <div className={`app-shell${isAuthenticated ? ' with-side-nav' : ' public-shell'}`}>
              {isAuthenticated ? (
                <aside className="app-sidebar desktop-sidebar">
                  <div className="brand-shell">
                    <ClassroomBrand size="sm" showSubtitle={false} platform className="min-w-0" />
                  </div>
                  <RoleSidebarNav primaryLinks={primaryLinks} navGroups={navGroups} />
                </aside>
              ) : null}

              <div className="app-main-shell">
                <header className="site-header compact-header">
                  <div className="site-header-left">
                    {isAuthenticated ? (
                      <MobileAppNav
                        roleLabel={roleLabel}
                        primaryLinks={primaryLinks}
                        navGroups={navGroups}
                      />
                    ) : (
                      <Link className="public-header-brand" href="/" aria-label={`${PLATFORM_PRODUCT_NAME}首页`}>
                        <ClassroomBrand size="sm" showSubtitle={false} platform className="min-w-0" />
                      </Link>
                    )}
                    <div className="site-header-context">
                      <div className="site-header-meta">
                        {isAuthenticated ? (
                          <div className="section-sub desktop-role-badge">{roleLabel}</div>
                        ) : null}
                        <div className="site-header-purpose">
                          {PLATFORM_BRAND_NAME}把每天最关键的学习、教学与质量改进动作组织成清晰主线
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="header-actions">
                    {isAuthenticated ? (
                      <GlobalCommandPalette
                        roleLabel={roleLabel}
                        primaryLinks={primaryLinks}
                        navGroups={navGroups}
                      />
                    ) : (
                      <nav className="public-header-links" aria-label="公共页面导航">
                        <Link href="/">首页</Link>
                        <Link href="/ai-classroom">{CLASSROOM_PRODUCT_NAME}</Link>
                      </nav>
                    )}
                    <ThemeModeToggle />
                    {user ? <DensityToggle /> : null}
                    <UserMenu user={user} />
                  </div>
                </header>
                <main className="main" id="main-content">
                  {children}
                </main>
                <footer className="site-footer">
                  <div className="site-footer-copy">© 2026 {PLATFORM_BRAND_NAME}</div>
                  <div className="site-footer-meta">
                    {PLATFORM_BRAND_TAGLINE}
                  </div>
                </footer>
              </div>
            </div>
            <AppToastHub />
            <Toaster position="top-center" />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

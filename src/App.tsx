import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Menu, X } from 'lucide-react';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LabWorkspace } from './components/LabWorkspace';
import { ElectrolysisDissociationPage } from './components/ElectrolysisDissociationPage';
import { CurriculumKNTTPage } from './components/CurriculumKNTTPage';
import { FormulasConverterPage } from './components/FormulasConverterPage';
import { BalancingTrainerPage } from './components/BalancingTrainerPage';
import { PeriodicTablePage } from './components/PeriodicTablePage';

export type AppRoute =
  | 'lab'
  | 'electrolysis'
  | 'curriculum'
  | 'formulas'
  | 'balancing'
  | 'periodic';

const NAV_LINKS: { id: AppRoute; label: string }[] = [
  { id: 'lab', label: 'Phòng Lab 3D' },
  { id: 'electrolysis', label: 'Điện Li & Phân' },
  { id: 'curriculum', label: 'Kiến Thức 10-12' },
  { id: 'formulas', label: 'Công Thức' },
  { id: 'balancing', label: 'Cân Bằng PT' },
];

export default function App() {
  const [route, setRoute] = useState<AppRoute>('lab');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [jumpReactionId, setJumpReactionId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setAuthMessage(null);
    try {
      await signInWithGoogle();
    } catch {
      setAuthMessage('Không thể mở cửa sổ đăng nhập Google lúc này; dữ liệu vẫn được lưu cục bộ.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // ignore
    }
  };

  const handleOpenReactionInLab = (reactionId: string) => {
    setJumpReactionId(reactionId);
    setRoute('lab');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (target: AppRoute) => {
    setRoute(target);
    setMobileMenuOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#070D19] text-slate-100">
        {/* Strict 3-Zone Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0B1222]">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
            {/* Zone 1: Single-line Brand Wordmark */}
            <button
              type="button"
              onClick={() => navigateTo('lab')}
              className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left hover:text-sky-300 transition-colors"
            >
              Hóa Học KNTT
            </button>

            {/* Zone 2: 5 Concise Single-line Navigation Links */}
            <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => {
                const isActive = route === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => navigateTo(link.id)}
                    className={`text-sm font-medium whitespace-nowrap shrink-0 pb-1 transition-colors border-b-2 ${
                      isActive
                        ? 'border-sky-400 text-white font-semibold'
                        : 'border-transparent text-slate-400 hover:text-slate-100 hover:border-slate-600'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: 1 Primary Action + Mobile Menu Toggle */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigateTo('periodic')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  route === 'periodic'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-sky-600 text-white hover:bg-sky-500'
                }`}
              >
                Bảng Tuần Hoàn
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Mở menu điều hướng"
                aria-expanded={mobileMenuOpen}
                className="md:hidden rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <nav
              aria-label="Menu di động"
              className="md:hidden border-t border-slate-800 bg-[#0B1222] px-4 py-3 flex flex-col gap-1"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigateTo(link.id)}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                    route === link.id
                      ? 'bg-sky-500/15 text-sky-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        {/* Main Workspace Content */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-6 py-6 sm:py-8">
          {authMessage && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/50 px-4 py-2.5 text-xs text-amber-200">
              {authMessage}
            </div>
          )}

          {route === 'lab' && (
            <LabWorkspace
              user={user}
              initialReactionId={jumpReactionId}
              onSignIn={() => void handleSignIn()}
            />
          )}
          {route === 'electrolysis' && <ElectrolysisDissociationPage />}
          {route === 'curriculum' && (
            <CurriculumKNTTPage onOpenReactionInLab={handleOpenReactionInLab} />
          )}
          {route === 'formulas' && <FormulasConverterPage />}
          {route === 'balancing' && <BalancingTrainerPage />}
          {route === 'periodic' && <PeriodicTablePage />}
        </main>

        {/* Quiet Utility Footer */}
        <footer className="border-t border-slate-800/90 bg-[#0B1222]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 py-5 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
            <p>
              Hóa Học KNTT · Tổng hợp kiến thức Lớp 10, 11, 12 theo chương trình Kết nối tri thức với cuộc sống.
            </p>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-slate-200 font-medium">{user.email}</span>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="font-semibold text-slate-300 hover:text-white underline"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="font-semibold text-sky-400 hover:text-sky-300 underline"
                >
                  Đăng nhập Google để đồng bộ lịch sử
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

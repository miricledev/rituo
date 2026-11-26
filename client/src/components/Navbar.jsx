import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiChevronDown,
  FiGrid,
  FiHelpCircle,
  FiInfo,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiSettings,
  FiSun,
  FiUsers,
  FiX
} from 'react-icons/fi';
import { HiOutlineAcademicCap, HiOutlineSparkles } from 'react-icons/hi2';
import { useAuth } from '../contexts/AuthContext';
import { triggerProtocolTransition } from '../utils/protocolTransition';
import ipLogo from '../assets/ip-logo.jpg';
import Inbox from './Inbox';
import IpBuck from './IpBuck';
import api from '../services/api';

const navIcons = {
  Dashboard: FiGrid,
  Schools: HiOutlineAcademicCap,
  'Student Workspace': HiOutlineAcademicCap,
  'Teacher Desk': FiUsers,
  'Feature Lab': HiOutlineSparkles,
  Legacy: HiOutlineSparkles
};

function NavbarIpWallet({ balance, loading, compact = false }) {
  const displayedBalance = loading ? '–' : balance;
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`${loading ? 'Loading' : balance} IP Bucks. Show earning information.`}
        className={`inline-flex items-center rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-amber-300/20 dark:from-amber-400/10 dark:to-yellow-300/5 dark:text-amber-200 ${compact ? 'h-10 px-2' : 'h-10 px-3'}`}
      >
        <IpBuck amount={displayedBalance} compact />
        {!compact ? <FiInfo className="ml-1.5 h-3.5 w-3.5 opacity-60" /> : null}
      </button>
      <div role="tooltip" className="pointer-events-none invisible absolute right-0 top-[calc(100%+10px)] z-50 w-72 translate-y-1 rounded-2xl border border-amber-200 bg-white/95 p-4 text-left opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-amber-300/20 dark:bg-[#0a1020]/95">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">What are IP Bucks?</p>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">Earn them by fully completing the same habit on consecutive scheduled occasions. Rewards begin on streak two and follow 1, 2, 3, 5, 8…</p>
        <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-400">Spend them in the IP Shop on avatar items and performance tools. They cannot be purchased with real money.</p>
      </div>
    </div>
  );
}

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  useEffect(() => {
    setIsDarkMode(true);
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!currentUser?.id) {
      setWalletBalance(0);
      setWalletLoading(false);
      return undefined;
    }
    let active = true;
    const loadWallet = async () => {
      try {
        const response = await api.get('/groups/ip-wallet');
        if (active) setWalletBalance(Number(response.data?.wallet?.balance) || 0);
      } catch (_error) {
        if (active) setWalletBalance(0);
      } finally {
        if (active) setWalletLoading(false);
      }
    };
    const handleWalletUpdate = (event) => {
      const nextBalance = Number(event.detail?.balance);
      if (Number.isFinite(nextBalance)) {
        setWalletBalance(nextBalance);
        setWalletLoading(false);
      } else {
        loadWallet();
      }
    };
    setWalletLoading(true);
    loadWallet();
    const refreshTimer = window.setInterval(loadWallet, 60000);
    window.addEventListener('ip-bucks-updated', handleWalletUpdate);
    window.addEventListener('focus', loadWallet);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('ip-bucks-updated', handleWalletUpdate);
      window.removeEventListener('focus', loadWallet);
    };
  }, [currentUser?.id]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    const completeLogout = () => {
      logout();
      navigate('/');
    };
    const plannerGuard = window.__innerPerformancePlannerGuard;
    if (plannerGuard?.isDirty?.()) {
      plannerGuard.requestLeave(completeLogout);
      return;
    }
    completeLogout();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const isStudent = currentUser?.accountRole === 'student';
  const navItems = (
    isStudent
      ? [
          { title: 'Student Workspace', path: '/dashboard' },
          { title: 'Legacy', path: '/legacy', show: currentUser?.hasLegacyAccess }
        ]
      : [
          { title: 'Dashboard', path: '/dashboard', show: true },
          { title: 'Schools', path: '/groups' },
          { title: 'Teacher Desk', path: '/teacher-desk', show: ['admin', 'teacher'].includes(currentUser?.accountRole) },
          { title: 'Feature Lab', path: '/feature-lab', show: currentUser?.accountRole === 'admin' },
          { title: 'Legacy', path: '/legacy', show: currentUser?.hasLegacyAccess }
        ]
  ).filter((item) => item.show !== false);

  const isActivePath = (path) => (
    location.pathname === path ||
    (path === '/groups' && location.pathname.startsWith('/groups/')) ||
    (isStudent && path === '/dashboard' && location.pathname.startsWith('/groups/'))
  );

  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/70 bg-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-[#050816]/85 dark:shadow-[0_12px_50px_rgba(0,0,0,0.35)]">
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4 sm:h-[72px]">
          <div className="flex min-w-0 items-center gap-3 lg:gap-8">
            <Link
              to="/dashboard"
              onClick={() => triggerProtocolTransition('Dashboard')}
              className="group flex min-w-0 items-center gap-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <span className="relative flex-shrink-0">
                <span className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 opacity-35 blur-md transition-opacity group-hover:opacity-60" />
                <img
                  src={ipLogo}
                  alt="Inner Performance Logo"
                  className="relative h-10 w-10 rounded-xl border border-white/40 object-cover shadow-lg sm:h-11 sm:w-11 dark:border-white/20"
                />
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white lg:text-base">
                  Inner Performance
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-600 dark:text-cyan-300">
                  Growth workspace
                </span>
              </span>
            </Link>

            <div className="hidden items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1.5 md:flex dark:border-white/10 dark:bg-white/[0.045]">
              {navItems.map((item) => {
                const Icon = navIcons[item.title] || FiGrid;
                const active = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (!active) triggerProtocolTransition(item.title);
                    }}
                    className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      active
                        ? 'bg-white text-slate-950 shadow-sm dark:bg-white/[0.12] dark:text-white'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white'
                    }`}
                  >
                    <Icon className={active ? 'text-violet-600 dark:text-cyan-300' : ''} />
                    <span>{item.title}</span>
                    {active && (
                      <span className="absolute inset-x-3 -bottom-1.5 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {currentUser ? <NavbarIpWallet balance={walletBalance} loading={walletLoading} /> : null}
            <button
              onClick={toggleDarkMode}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/10 dark:bg-white/[0.055] dark:text-amber-300 dark:hover:border-white/20 dark:hover:text-amber-200"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
            </button>

            {currentUser && <Inbox />}

            {currentUser ? (
              <div className="relative">
                <button
                  onClick={toggleMenu}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 py-1.5 pl-1.5 pr-3 text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-white/10 dark:bg-white/[0.055] dark:hover:border-white/20"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden min-w-0 lg:block">
                    <span className="block max-w-32 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {currentUser?.username}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-cyan-300">
                      {currentUser?.accountRole || 'student'}
                    </span>
                  </span>
                  <FiChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur-2xl animate-fade-in dark:border-white/10 dark:bg-[#0a1020]/95">
                    <div className="border-b border-slate-100 px-3 py-3 dark:border-white/10">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{currentUser?.username}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{currentUser?.email}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => {
                        closeMenu();
                        triggerProtocolTransition('Settings');
                      }}
                      className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    >
                      <FiSettings className="h-4 w-4" />
                      Settings
                    </Link>
                    <Link
                      to="/settings#help"
                      onClick={() => {
                        closeMenu();
                        triggerProtocolTransition('Help & Support');
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    >
                      <FiHelpCircle className="h-4 w-4" />
                      Help & Support
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      <FiLogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-violet-600 dark:text-slate-300 dark:hover:text-cyan-300">
                  Log in
                </Link>
                <Link to="/register" className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-transform hover:-translate-y-0.5">
                  Sign up
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            {currentUser ? <NavbarIpWallet balance={walletBalance} loading={walletLoading} compact /> : null}
            {currentUser && <Inbox />}
            <button
              onClick={toggleDarkMode}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-amber-300"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 focus:outline-none dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-200 bg-white/95 px-3 pb-4 pt-3 shadow-xl backdrop-blur-2xl animate-slide-in md:hidden dark:border-white/10 dark:bg-[#070b17]/95">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = navIcons[item.title] || FiGrid;
              const active = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    closeMenu();
                    if (!active) triggerProtocolTransition(item.title);
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-cyan-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
            <div className="my-2 border-t border-slate-200 dark:border-white/10" />
            <Link to="/settings" onClick={() => { closeMenu(); triggerProtocolTransition('Settings'); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]">
              <FiSettings className="h-4 w-4" />
              Settings
            </Link>
            <Link to="/settings#help" onClick={() => { closeMenu(); triggerProtocolTransition('Help & Support'); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]">
              <FiHelpCircle className="h-4 w-4" />
              Help & Support
            </Link>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
              <FiLogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaArrowRight,
  FaBrain,
  FaCalendarCheck,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaShieldAlt,
  FaUser
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import ipLogo from '../assets/ip-logo.jpg';

const featureItems = [
  { icon: FaBrain, title: 'Intentional performance', detail: 'Goals, habits and school progress in one system.' },
  { icon: FaCalendarCheck, title: 'A day that fits', detail: 'AI planning built around real school commitments.' },
  { icon: FaShieldAlt, title: 'Role-aware access', detail: 'Purpose-built experiences for every account type.' }
];

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password to continue.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not sign you in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03051a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-40 -top-56 h-[36rem] w-[36rem] rounded-full bg-indigo-600/25 blur-[100px]"
          animate={{ x: [0, 45, 0], y: [0, 35, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-56 -right-36 h-[40rem] w-[40rem] rounded-full bg-cyan-500/15 blur-[110px]"
          animate={{ x: [0, -55, 0], y: [0, -30, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.08fr_.92fr]">
        <section className="hidden min-h-screen flex-col justify-between border-r border-white/10 px-12 py-10 lg:flex xl:px-20 xl:py-14">
          <Link to="/" className="flex w-fit items-center gap-3">
            <img src={ipLogo} alt="Inner Performance" className="h-12 w-12 rounded-xl border border-white/15 object-cover shadow-lg" />
            <div>
              <div className="text-lg font-extrabold tracking-tight">MindHeartGut</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">Inner Performance</div>
            </div>
          </Link>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.36em] text-cyan-300">Your performance environment</p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-7xl">
              Build the person your goals require.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
              A focused space for school performance, personal discipline and the habits that connect the two.
            </p>

            <div className="mt-10 grid gap-3">
              {featureItems.map(({ icon: Icon, title, detail }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + index * 0.1 }}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur"
                >
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon /></div>
                  <div>
                    <h2 className="text-sm font-bold">{title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FaCheck className="text-emerald-400" /> Secure role-based access
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <Link to="/" className="mb-10 flex w-fit items-center gap-3 lg:hidden">
              <img src={ipLogo} alt="Inner Performance" className="h-12 w-12 rounded-xl border border-white/15 object-cover" />
              <div>
                <div className="font-extrabold">MindHeartGut</div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-cyan-300">Inner Performance</div>
              </div>
            </Link>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.065] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Welcome back</p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Sign in to focus.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Your workspace and intention ritual are ready.</p>
                </div>
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-300">
                  <FaLock />
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="username" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Username</label>
                  <div className="relative">
                    <FaUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500" />
                    <input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      placeholder="Enter your username"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/55 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Password</label>
                    <span className="text-xs text-slate-600">Case sensitive</span>
                  </div>
                  <div className="relative">
                    <FaLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/55 py-3.5 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-400/10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-cyan-300"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 px-5 py-4 text-sm font-extrabold text-slate-950 shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                      Securing your workspace...
                    </>
                  ) : (
                    <>
                      Continue <FaArrowRight className="transition group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6 text-center text-sm text-slate-500">
                New student?{' '}
                <Link to="/register" className="font-semibold text-cyan-300 transition hover:text-cyan-200">Create a student account</Link>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
              <FaShieldAlt /> Protected by secure account roles
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

export default Login;

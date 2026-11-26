import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FaArrowRight,
  FaBrain,
  FaCalendarAlt,
  FaChartLine,
  FaCheck,
  FaClipboardCheck,
  FaGraduationCap,
  FaKey,
  FaLock,
  FaMagic,
  FaSchool,
  FaShieldAlt,
  FaStar,
  FaUserGraduate,
  FaUsers
} from 'react-icons/fa';
import { HiOutlineAcademicCap } from 'react-icons/hi2';
import ipLogo from '../assets/ip-logo.jpg';

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

const featureCards = [
  {
    icon: FaChartLine,
    eyebrow: 'Whole-school visibility',
    title: 'See progress before it becomes a problem',
    description: 'Bring habits, attendance signals, goals, interventions, challenges, and student progress into one connected school view.',
    accent: 'from-violet-500/25 to-violet-500/5',
    iconClass: 'bg-violet-400/15 text-violet-200'
  },
  {
    icon: FaClipboardCheck,
    eyebrow: 'Daily student action',
    title: 'Turn support plans into clear next steps',
    description: 'Students see focused daily habits, understand why each action matters, and build evidence through consistent completion.',
    accent: 'from-cyan-400/20 to-cyan-400/5',
    iconClass: 'bg-cyan-400/15 text-cyan-200'
  },
  {
    icon: FaBrain,
    eyebrow: 'AI-assisted workflows',
    title: 'Reduce administration, not professional judgement',
    description: 'Use structured AI tools to draft habits, clean student imports, answer role-aware questions, and help students plan their time.',
    accent: 'from-amber-400/20 to-amber-400/5',
    iconClass: 'bg-amber-400/15 text-amber-200'
  }
];

const roleCards = [
  {
    icon: FaShieldAlt,
    role: 'School leaders & admins',
    headline: 'Control the school workspace',
    items: ['Provision accounts at scale', 'Manage staff and student access', 'Review school-wide progress', 'Export reports and login packs'],
    color: 'violet'
  },
  {
    icon: HiOutlineAcademicCap,
    role: 'Teachers',
    headline: 'Act on what matters today',
    items: ['View assigned students', 'Track attendance and habits', 'Run class workflows', 'Support goals and interventions'],
    color: 'cyan'
  },
  {
    icon: FaUserGraduate,
    role: 'Students',
    headline: 'Know what to do next',
    items: ['Complete daily habits', 'Plan time with AI support', 'See goals and progress', 'Build positive routines'],
    color: 'amber'
  }
];

const aiTools = [
  { icon: FaMagic, title: 'Habit drafting', text: 'Turn an administrator’s plain-language brief into structured, reviewable student habits.' },
  { icon: FaUsers, title: 'Intelligent CSV intake', text: 'Interpret inconsistent school data, map useful fields, and prepare accounts for review before import.' },
  { icon: FaCalendarAlt, title: 'Student planning', text: 'Help students organise school time, commitments, and estimated habit durations into a practical day.' },
  { icon: FaBrain, title: 'Role-aware support', text: 'Give admins, teachers, and students different guidance, suggested questions, and an appropriate tone.' }
];

const workflow = [
  { number: '01', title: 'Create the school', text: 'An authorised administrator opens a private workspace and configures the school.' },
  { number: '02', title: 'Bring people in', text: 'Add individual accounts or securely review an AI-assisted bulk student import.' },
  { number: '03', title: 'Set meaningful actions', text: 'Create goals, habits, challenges, courses, and school support workflows.' },
  { number: '04', title: 'See and respond', text: 'Use live evidence to celebrate progress and focus support where it is needed.' }
];

const MetricCard = ({ label, value, detail, tone }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={`h-2 w-2 rounded-full ${tone}`} />
    </div>
    <p className="mt-3 text-2xl font-black text-white">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>
);

const ProductPreview = ({ reduceMotion }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, rotateX: 5 }}
    animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ duration: reduceMotion ? 0 : 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    className="relative mx-auto w-full max-w-[680px]"
  >
    <motion.div
      animate={reduceMotion ? {} : { y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#091126]/95 p-3 shadow-[0_35px_110px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-4"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <img src="/images/landing/private-school-platform.webp" alt="Inner Performance private school platform connecting students, teachers and school leaders" className="relative w-full rounded-[1.4rem] object-cover" />
      <div className="hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
          School workspace
        </span>
      </div>

      <div className="grid gap-3 pt-3 md:grid-cols-[150px_1fr]">
        <aside className="hidden rounded-2xl border border-white/10 bg-black/15 p-3 md:block">
          <div className="mb-5 flex items-center gap-2">
            <img src={ipLogo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <div>
              <p className="text-[9px] font-black text-white">INNER PERFORMANCE</p>
              <p className="text-[8px] text-slate-500">School platform</p>
            </div>
          </div>
          {['Dashboard', 'Students', 'Teaching', 'Reports'].map((item, index) => (
            <div key={item} className={`mb-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold ${index === 0 ? 'bg-gradient-to-r from-violet-500/20 to-cyan-400/10 text-white' : 'text-slate-500'}`}>
              {item}
            </div>
          ))}
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-cyan-400/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">Monday overview</p>
                <h3 className="mt-1 text-lg font-black text-white">Good morning, Oakbridge</h3>
                <p className="mt-1 text-[10px] text-slate-400">Focus support. Recognise progress. Keep every student moving.</p>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-bold text-emerald-300">
                Live school day
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Students" value="486" detail="Active profiles" tone="bg-violet-400" />
            <MetricCard label="Attendance" value="94%" detail="Today so far" tone="bg-cyan-400" />
            <MetricCard label="Habits" value="82%" detail="Completion" tone="bg-emerald-400" />
            <MetricCard label="Support" value="12" detail="Need attention" tone="bg-amber-300" />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1.25fr_.75fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Weekly momentum</p>
                  <p className="mt-1 text-[9px] text-slate-500">Combined student progress</p>
                </div>
                <FaChartLine className="text-cyan-300" />
              </div>
              <div className="mt-5 flex h-24 items-end gap-2">
                {[38, 55, 44, 72, 64, 86, 78].map((height, index) => (
                  <motion.div
                    key={index}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.7, delay: 0.7 + index * 0.08 }}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-cyan-300"
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[8px] uppercase text-slate-600">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200"><FaBrain /></span>
                <div>
                  <p className="text-xs font-bold text-white">AI support</p>
                  <p className="text-[9px] text-slate-500">Role-aware guidance</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {['Draft habits from a brief', 'Review student import', 'Plan today’s schedule'].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduceMotion ? 0 : 1.1 + index * 0.15 }}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/15 px-2.5 py-2 text-[9px] text-slate-300"
                  >
                    <FaStar className="text-amber-300" />
                    {item}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </motion.div>

    <motion.div
      animate={reduceMotion ? {} : { y: [0, 7, 0], rotate: [0, 1, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      className="absolute -bottom-8 -left-2 hidden w-52 rounded-2xl border border-white/15 bg-[#101a33]/95 p-3 shadow-2xl backdrop-blur-xl sm:block lg:-left-14"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><FaCheck /></span>
        <div>
          <p className="text-[10px] font-bold text-white">Student recovered</p>
          <p className="mt-0.5 text-[9px] text-slate-500">Daily actions completed</p>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const Landing = () => {
  const reduceMotion = useReducedMotion();
  const motionTransition = { duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] };

  return (
    <div className="min-h-screen overflow-hidden bg-[#040713] text-white selection:bg-amber-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(124,58,237,0.16),transparent_32%),radial-gradient(circle_at_82%_22%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(to_bottom,#040713,#071022_48%,#040713)]" />
        <motion.div animate={reduceMotion ? {} : { x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} className="absolute -left-32 top-40 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        <motion.div animate={reduceMotion ? {} : { x: [0, -40, 0], y: [0, -20, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#040713]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="group flex items-center gap-3">
            <span className="relative">
              <span className="absolute -inset-1 rounded-2xl bg-amber-300/25 blur-md transition group-hover:bg-amber-300/40" />
              <img src={ipLogo} alt="Inner Performance" className="relative h-11 w-11 rounded-xl border border-white/15 object-cover" />
            </span>
            <span>
              <span className="block font-display text-sm font-black tracking-tight text-white sm:text-base">Inner Performance</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-amber-300">Private school platform</span>
            </span>
          </a>

          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-400 md:flex">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#roles" className="transition hover:text-white">For schools</a>
            <a href="#ai" className="transition hover:text-white">AI tools</a>
            <a href="#privacy" className="transition hover:text-white">Private access</a>
          </div>

          <Link to="/login" className="group inline-flex items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-300/10 transition hover:-translate-y-0.5 hover:bg-amber-200">
            School sign in
            <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      <main id="top" className="relative">
        <section className="relative flex min-h-screen items-center px-4 pb-24 pt-32 sm:px-6 lg:px-8 lg:pt-36">
          <div className="mx-auto grid w-full max-w-[1440px] items-center gap-16 lg:grid-cols-[.92fr_1.08fr]">
            <motion.div initial="hidden" animate="visible" variants={reveal} transition={motionTransition}>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                <FaLock />
                Purpose-built private software for schools
              </div>
              <h1 className="mt-7 max-w-3xl font-display text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl xl:text-[5.35rem]">
                Help every student build the habits behind
                <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent">
                  better outcomes.
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Inner Performance gives school leaders, teachers, and students one connected space for purposeful habits, goals, attendance, interventions, scheduling, progress, and AI-assisted support.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-amber-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-amber-300/15 transition hover:-translate-y-0.5">
                  Access your school
                  <FaArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#platform" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.045] px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:border-white/25 hover:bg-white/[0.08]">
                  Explore the platform
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-2"><FaCheck className="text-emerald-300" /> Role-based school access</span>
                <span className="flex items-center gap-2"><FaCheck className="text-emerald-300" /> Admin-controlled accounts</span>
                <span className="flex items-center gap-2"><FaCheck className="text-emerald-300" /> Structured AI workflows</span>
              </div>
            </motion.div>

            <ProductPreview reduceMotion={reduceMotion} />
          </div>
        </section>

        <section className="relative border-y border-white/10 bg-white/[0.025]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-white/10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
            {[
              ['One platform', 'School-wide coordination'],
              ['Three roles', 'Admin · Teacher · Student'],
              ['Daily evidence', 'Habits into progress'],
              ['AI assisted', 'Human reviewed']
            ].map(([value, label]) => (
              <div key={value} className="px-4 py-7 text-center">
                <p className="text-sm font-black text-white sm:text-base">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1440px]">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={reveal} transition={motionTransition} className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">One connected operating layer</p>
              <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                More than a habit tracker. A system for consistent school support.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg">
                Inner Performance connects the actions students take each day with the context staff need to guide, recognise, and intervene.
              </p>
            </motion.div>

            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.article
                    key={feature.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={reveal}
                    transition={{ ...motionTransition, delay: reduceMotion ? 0 : index * 0.12 }}
                    className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${feature.accent} p-7 transition hover:-translate-y-1 hover:border-white/20`}
                  >
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
                    <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${feature.iconClass}`}>
                      <Icon className="text-xl" />
                    </span>
                    <p className="relative mt-7 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{feature.eyebrow}</p>
                    <h3 className="relative mt-2 text-2xl font-black tracking-tight text-white">{feature.title}</h3>
                    <p className="relative mt-4 text-sm leading-7 text-slate-400">{feature.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="roles" className="relative border-y border-white/10 bg-[#071022]/75 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={reveal} transition={motionTransition} className="lg:sticky lg:top-28">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Designed around responsibility</p>
                <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                  The right workspace for every role.
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-400">
                  Accounts are provisioned for the job each person needs to do. Administrators control the school, teachers support students, and students focus on their own progress.
                </p>
                <div className="mt-7 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  <FaKey className="text-amber-300" />
                  Private access is issued by the school.
                </div>
              </motion.div>

              <div className="space-y-4">
                {roleCards.map((role, index) => {
                  const Icon = role.icon;
                  const colorClasses = {
                    violet: 'bg-violet-400/15 text-violet-200 border-violet-400/20',
                    cyan: 'bg-cyan-400/15 text-cyan-200 border-cyan-400/20',
                    amber: 'bg-amber-400/15 text-amber-200 border-amber-400/20'
                  }[role.color];
                  return (
                    <motion.article
                      key={role.role}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.25 }}
                      variants={reveal}
                      transition={{ ...motionTransition, delay: reduceMotion ? 0 : index * 0.1 }}
                      className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/20 sm:grid-cols-[auto_1fr] sm:p-7"
                    >
                      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${colorClasses}`}>
                        <Icon className="text-2xl" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{role.role}</p>
                        <h3 className="mt-2 text-2xl font-black text-white">{role.headline}</h3>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {role.items.map((item) => (
                            <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-[8px] text-emerald-300"><FaCheck /></span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="ai" className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={reveal} transition={motionTransition}>
                <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/[0.035] to-cyan-400/10 p-6 shadow-2xl sm:p-8">
                  <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/20"><FaBrain /></span>
                      <div>
                        <p className="font-black text-white">Inner Performance AI</p>
                        <p className="text-xs text-slate-500">Structured assistance for schools</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Ready</span>
                  </div>

                  <div className="relative mt-7 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs leading-6 text-slate-300">
                      “Create a four-week set of confidence, organisation, and revision habits for Year 10 students preparing for assessments.”
                    </p>
                  </div>
                  <div className="relative mt-4 space-y-3">
                    {[
                      ['Morning plan', '10 minutes · Weekdays'],
                      ['Focused revision block', '35 minutes · Mon–Thu'],
                      ['Confidence reflection', '5 minutes · Friday']
                    ].map(([title, meta], index) => (
                      <motion.div
                        key={title}
                        initial={{ opacity: 0, x: -18 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: reduceMotion ? 0 : 0.3 + index * 0.16 }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><FaStar /></span>
                          <div>
                            <p className="text-sm font-bold text-white">{title}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{meta}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[9px] font-bold text-cyan-300">Review</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="relative mt-5 flex items-center gap-2 text-[10px] text-slate-500">
                    <FaShieldAlt className="text-emerald-300" />
                    AI output is structured for review before it enters the school workflow.
                  </div>
                </div>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={reveal} transition={motionTransition}>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-300">AI that understands the workflow</p>
                <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                  Faster school operations. Clear human review.
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-400">
                  AI supports the repetitive and time-consuming parts of the platform while staff remain in control of what is reviewed, approved, and used.
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {aiTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <div key={tool.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                        <Icon className="text-lg text-cyan-300" />
                        <h3 className="mt-4 font-black text-white">{tool.title}</h3>
                        <p className="mt-2 text-xs leading-6 text-slate-500">{tool.text}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-white/10 bg-white/[0.025] px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1440px]">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={reveal} transition={motionTransition} className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">From setup to daily action</p>
              <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">A clear operating rhythm for the school.</h2>
            </motion.div>
            <div className="relative mt-14 grid gap-4 md:grid-cols-4">
              <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-violet-500/20 via-cyan-300/50 to-amber-300/20 md:block" />
              {workflow.map((step, index) => (
                <motion.div key={step.number} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={reveal} transition={{ ...motionTransition, delay: reduceMotion ? 0 : index * 0.1 }} className="relative rounded-2xl border border-white/10 bg-[#081024] p-5">
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-400/10 font-mono text-lg font-black text-white shadow-xl">
                    {step.number}
                  </span>
                  <h3 className="mt-6 text-lg font-black text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{step.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="privacy" className="relative px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1200px]">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={reveal} transition={motionTransition} className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#101a35] via-[#091126] to-[#071b25] p-7 shadow-[0_35px_100px_rgba(0,0,0,0.35)] sm:p-10 lg:p-14">
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_.8fr]">
                <div>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl text-amber-200"><FaLock /></span>
                  <p className="mt-7 text-xs font-black uppercase tracking-[0.28em] text-amber-300">Private by design</p>
                  <h2 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                    This is not an open social platform.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                    Inner Performance is private software for authorised schools. Administrators create and manage accounts, students belong to their school workspace, and role-based access keeps each user focused on the information and tools relevant to them.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    [FaSchool, 'School-managed access', 'Accounts are provisioned and managed within an authorised school.'],
                    [FaUsers, 'Role-specific workspaces', 'Admins, teachers, and students receive different controls and support.'],
                    [FaShieldAlt, 'Review before action', 'Sensitive bulk imports and AI-generated structures are reviewed before use.']
                  ].map(([Icon, title, text]) => (
                    <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-cyan-300"><Icon /></span>
                      <div>
                        <p className="text-sm font-black text-white">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={reveal} transition={motionTransition} className="mx-auto max-w-[1200px] overflow-hidden rounded-[2.5rem] border border-amber-300/20 bg-gradient-to-r from-amber-300 via-amber-400 to-cyan-300 p-[1px]">
            <div className="relative overflow-hidden rounded-[calc(2.5rem-1px)] bg-[#071022] px-6 py-14 text-center sm:px-10 sm:py-16">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.18),transparent_48%)]" />
              <FaGraduationCap className="relative mx-auto text-3xl text-amber-300" />
              <h2 className="relative mx-auto mt-5 max-w-3xl font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                Your school already has an Inner Performance workspace?
              </h2>
              <p className="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
                Sign in with the account supplied by your school administrator. Access is private and is not available through public registration.
              </p>
              <Link to="/login" className="group relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-amber-300 px-7 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-amber-300/15 transition hover:-translate-y-0.5 hover:bg-amber-200">
                Continue to school sign in
                <FaArrowRight className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <img src={ipLogo} alt="Inner Performance" className="h-11 w-11 rounded-xl border border-white/10 object-cover" />
            <div>
              <p className="font-display text-sm font-black text-white">Inner Performance</p>
              <p className="mt-1 text-xs text-slate-600">Private performance and support software for schools.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#roles" className="transition hover:text-white">School roles</a>
            <a href="#ai" className="transition hover:text-white">AI tools</a>
            <a href="mailto:support@innerperformance.co.uk" className="transition hover:text-white">Support</a>
            <Link to="/login" className="text-amber-300 transition hover:text-amber-200">Sign in</Link>
          </div>
        </div>
        <div className="border-t border-white/5 px-4 py-5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
          © {new Date().getFullYear()} Inner Performance. Authorised school access only.
        </div>
      </footer>
    </div>
  );
};

export default Landing;

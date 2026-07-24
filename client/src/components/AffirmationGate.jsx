import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaMicrophone, FaArrowRight } from 'react-icons/fa';
import ipLogo from '../assets/ip-logo.jpg';

const affirmations = [
  {
    text: 'I am dedicated to my goals.',
    note: 'My actions today are aligned with the future I am building.'
  },
  {
    text: 'I have the discipline to follow through.',
    note: 'I keep promises to myself, even when motivation changes.'
  },
  {
    text: 'I grow stronger with every intentional choice.',
    note: 'Small, focused steps create meaningful progress.'
  }
];

const AffirmationGate = ({ username, onComplete }) => {
  const [confirmedCount, setConfirmedCount] = useState(0);
  const allConfirmed = confirmedCount === affirmations.length;

  const confirmCurrent = () => {
    if (confirmedCount < affirmations.length) {
      setConfirmedCount((count) => count + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#02051b] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-48 top-[-16rem] h-[38rem] w-[38rem] rounded-full bg-violet-600/20 blur-[100px]"
          animate={{ x: [0, 70, 0], y: [0, 40, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-48 bottom-[-18rem] h-[42rem] w-[42rem] rounded-full bg-cyan-500/15 blur-[110px]"
          animate={{ x: [0, -60, 0], y: [0, -50, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ipLogo} alt="Inner Performance" className="h-11 w-11 rounded-xl border border-white/15 object-cover" />
            <div>
              <div className="text-sm font-bold">MindHeartGut</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Inner Performance</div>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            {confirmedCount} of {affirmations.length} spoken
          </div>
        </motion.header>

        <div className="flex flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mx-auto w-full max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.36em] text-cyan-300">Before you enter</p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Set your intention, {username || 'champion'}.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Say each affirmation out loud. Confirm it only after you have spoken it—the Enter button unlocks when all three are complete.
            </p>
          </motion.div>

          <div className="mx-auto mt-9 grid w-full max-w-5xl gap-4 lg:grid-cols-3">
            {affirmations.map((affirmation, index) => {
              const isComplete = index < confirmedCount;
              const isCurrent = index === confirmedCount;
              const isLocked = index > confirmedCount;
              return (
                <motion.article
                  key={affirmation.text}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: isLocked ? 0.45 : 1, y: 0, scale: isCurrent ? 1.02 : 1 }}
                  transition={{ delay: 0.25 + index * 0.1 }}
                  className={`relative overflow-hidden rounded-[1.6rem] border p-6 text-left backdrop-blur-xl transition ${
                    isComplete
                      ? 'border-emerald-400/40 bg-emerald-400/10'
                      : isCurrent
                        ? 'border-cyan-300/45 bg-white/[0.08] shadow-2xl shadow-cyan-950/50'
                        : 'border-white/10 bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Affirmation {index + 1}</span>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isComplete ? 'bg-emerald-400 text-slate-950' : isCurrent ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/5 text-slate-600'}`}>
                      {isComplete ? <FaCheck /> : <FaMicrophone />}
                    </div>
                  </div>
                  <h2 className="mt-8 text-2xl font-bold leading-tight">{affirmation.text}</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-400">{affirmation.note}</p>

                  <AnimatePresence>
                    {isCurrent && (
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={confirmCurrent}
                        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                      >
                        <FaMicrophone /> I said this out loud
                      </motion.button>
                    )}
                  </AnimatePresence>
                  {isComplete && <div className="mt-7 text-sm font-semibold text-emerald-300">Spoken and affirmed</div>}
                  {isLocked && <div className="mt-7 text-sm text-slate-600">Complete the previous affirmation first</div>}
                </motion.article>
              );
            })}
          </div>

          <motion.div layout className="mx-auto mt-8 w-full max-w-md">
            <button
              type="button"
              onClick={onComplete}
              disabled={!allConfirmed}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-4 text-base font-extrabold text-slate-950 shadow-2xl shadow-cyan-950/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-30"
            >
              Enter my workspace <FaArrowRight />
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {allConfirmed ? 'Your intention is set. You are ready.' : `${affirmations.length - confirmedCount} affirmation${affirmations.length - confirmedCount === 1 ? '' : 's'} remaining`}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AffirmationGate;

import React from 'react';
import { motion } from 'framer-motion';
import ipLogo from '../assets/ip-logo.jpg';

const BrandLoadingScreen = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#03051f] text-white">
    <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(71,85,255,.28), transparent 38%), radial-gradient(circle at 25% 80%, rgba(6,182,212,.14), transparent 34%)' }} />
    <motion.div
      className="absolute h-[520px] w-[520px] rounded-full border border-cyan-300/10"
      animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
      transition={{ rotate: { duration: 18, repeat: Infinity, ease: 'linear' }, scale: { duration: 3, repeat: Infinity } }}
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative flex flex-col items-center px-6 text-center"
    >
      <motion.div
        animate={{ boxShadow: ['0 0 24px rgba(34,211,238,.18)', '0 0 70px rgba(99,102,241,.55)', '0 0 24px rgba(34,211,238,.18)'] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 p-2 backdrop-blur-xl"
      >
        <img src={ipLogo} alt="Inner Performance" className="h-32 w-32 rounded-[1.55rem] object-cover sm:h-40 sm:w-40" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-8 text-xs font-bold uppercase tracking-[0.48em] text-cyan-300"
      >
        Inner Performance
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-3 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl"
      >
        MindHeartGut
      </motion.h1>
      <div className="mt-8 h-1 w-64 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="mt-4 text-sm text-slate-400">Preparing your performance workspace</p>
    </motion.div>
  </div>
);

export default BrandLoadingScreen;

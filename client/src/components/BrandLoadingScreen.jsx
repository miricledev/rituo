import React from 'react';
import { motion } from 'framer-motion';
import ipLogo from '../assets/ip-logo.jpg';

const protocolSteps = ['Mind', 'Heart', 'Gut'];

const BrandLoadingScreen = ({
  protocolName = 'Secure Workspace',
  transitionMode = false
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.24 }}
    className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#020412] text-white"
    role="status"
    aria-live="polite"
    aria-label={`Loading IP Key Protocols: ${protocolName}`}
  >
    <div
      className="absolute inset-0 opacity-80"
      style={{
        background: [
          'radial-gradient(circle at 50% 34%, rgba(79,70,229,.32), transparent 34%)',
          'radial-gradient(circle at 22% 78%, rgba(6,182,212,.17), transparent 30%)',
          'radial-gradient(circle at 82% 72%, rgba(168,85,247,.14), transparent 30%)',
          'linear-gradient(145deg, #020412 0%, #060a24 50%, #020412 100%)'
        ].join(',')
      }}
    />
    <motion.div
      className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 sm:h-[44rem] sm:w-[44rem]"
      animate={{ rotate: 360, scale: [0.94, 1.04, 0.94] }}
      transition={{
        rotate: { duration: 22, repeat: Infinity, ease: 'linear' },
        scale: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
      }}
    />
    <motion.div
      className="absolute left-1/2 top-1/2 h-[25rem] w-[25rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/10 sm:h-[34rem] sm:w-[34rem]"
      animate={{ rotate: -360 }}
      transition={{ duration: 17, repeat: Infinity, ease: 'linear' }}
    />
    <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />

    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex w-full max-w-3xl flex-col items-center px-6 text-center"
    >
      <motion.div
        animate={{
          boxShadow: [
            '0 0 28px rgba(34,211,238,.15)',
            '0 0 82px rgba(99,102,241,.48)',
            '0 0 28px rgba(34,211,238,.15)'
          ]
        }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className={`${transitionMode ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-28 w-28 sm:h-36 sm:w-36'} overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/5 p-1.5 backdrop-blur-xl`}
      >
        <img src={ipLogo} alt="Inner Performance" className="h-full w-full rounded-[1.4rem] object-cover" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="mt-7 text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300 sm:text-xs sm:tracking-[0.5em]"
      >
        Inner Performance Key Protocols
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-2 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-5xl font-black tracking-[-0.06em] text-transparent sm:text-7xl"
      >
        IPKP
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38 }}
        className="mt-5 flex items-center gap-2 sm:gap-4"
      >
        {protocolSteps.map((step, index) => (
          <React.Fragment key={step}>
            <motion.span
              animate={{ color: ['#ffffff', index === 0 ? '#a5b4fc' : index === 1 ? '#f0abfc' : '#67e8f9', '#ffffff'] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.28 }}
              className="text-xl font-extrabold tracking-tight sm:text-3xl"
            >
              {step}.
            </motion.span>
            {index < protocolSteps.length - 1 ? <span className="h-1 w-1 rounded-full bg-white/25" /> : null}
          </React.Fragment>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.48 }}
        className="mt-8 rounded-full border border-white/10 bg-white/[0.055] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-200 shadow-xl backdrop-blur-xl sm:text-sm"
      >
        IP Key Protocols: <span className="text-cyan-300">{protocolName}</span>
      </motion.div>

      <div className="mt-8 h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full w-2/5 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
          initial={{ x: '-110%' }}
          animate={{ x: '260%' }}
          transition={{ duration: transitionMode ? 0.9 : 1.45, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <motion.p
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
      >
        Aligning your performance environment
      </motion.p>
    </motion.div>
  </motion.div>
);

export default BrandLoadingScreen;

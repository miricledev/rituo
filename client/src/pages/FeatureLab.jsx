import React from 'react';
import AdminFeatureLab from '../components/student-tools/AdminFeatureLab';

function FeatureLab() {
  return (
    <main className="relative mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1440px] overflow-x-hidden px-3 py-5 sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-fuchsia-50/40 dark:from-[#050816] dark:via-[#070b17] dark:to-[#160a24]" />
      <div className="pointer-events-none fixed left-[-10rem] top-28 -z-10 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none fixed right-[-8rem] top-1/3 -z-10 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
      <AdminFeatureLab />
    </main>
  );
}

export default FeatureLab;

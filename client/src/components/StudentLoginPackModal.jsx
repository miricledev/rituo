import React, { useEffect, useState } from 'react';
import { FaExclamationTriangle, FaFileCsv, FaFileCode, FaKey, FaTimes } from 'react-icons/fa';

const StudentLoginPackModal = ({
  open,
  schoolName,
  studentCount,
  loading,
  onCancel,
  onConfirm
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [format, setFormat] = useState('html');

  useEffect(() => {
    if (open) {
      setConfirmReset(false);
      setFormat('html');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="login-pack-title" className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1020] text-white shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-xl text-amber-200">
              <FaKey />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Student login pack</p>
              <h2 id="login-pack-title" className="mt-1 text-2xl font-black tracking-tight">Reset passwords before downloading?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                This pack covers {studentCount} students in {schoolName}. Existing passwords cannot be viewed, so downloading a pack requires replacing every student password.
              </p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
            <div className="flex gap-3">
              <FaExclamationTriangle className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <h3 className="font-bold text-amber-100">This action signs students out of their old password</h3>
                <p className="mt-1 text-sm leading-6 text-amber-100/70">
                  Each student receives a new random six-digit temporary password. The new details appear once in the downloaded pack.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">Choose download format</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setFormat('html')} className={`rounded-2xl border p-4 text-left transition ${format === 'html' ? 'border-cyan-300/50 bg-cyan-400/10 ring-2 ring-cyan-400/10' : 'border-white/10 bg-white/[0.035] hover:border-white/20'}`}>
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-violet-400/15 p-3 text-violet-200"><FaFileCode /></span>
                  <div>
                    <p className="font-bold">Printable HTML</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Branded login cards that teachers can open, print, or save as PDF.</p>
                  </div>
                </div>
              </button>
              <button type="button" onClick={() => setFormat('csv')} className={`rounded-2xl border p-4 text-left transition ${format === 'csv' ? 'border-cyan-300/50 bg-cyan-400/10 ring-2 ring-cyan-400/10' : 'border-white/10 bg-white/[0.035] hover:border-white/20'}`}>
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-emerald-400/15 p-3 text-emerald-200"><FaFileCsv /></span>
                  <div>
                    <p className="font-bold">CSV spreadsheet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Structured rows for secure administration and spreadsheet use.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${confirmReset ? 'border-emerald-400/35 bg-emerald-400/10' : 'border-white/10 bg-white/[0.035]'}`}>
            <input type="checkbox" checked={confirmReset} onChange={(event) => setConfirmReset(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />
            <span>
              <span className="block text-sm font-bold text-white">Yes, reset all {studentCount} student passwords first</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">I understand their previous passwords will stop working immediately.</span>
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/10 p-6 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40">
            Cancel — do not reset
          </button>
          <button type="button" onClick={() => onConfirm(format)} disabled={!confirmReset || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">
            <FaKey /> {loading ? 'Resetting and preparing...' : `Reset & download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPackModal;

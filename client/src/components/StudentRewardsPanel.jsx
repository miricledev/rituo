import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiAward, FiCheck, FiChevronRight, FiClock, FiLock, FiRefreshCw, FiSave, FiShoppingBag, FiStar, FiTrendingUp, FiUser, FiX, FiZap } from 'react-icons/fi';
import api from '../services/api';
import InlineToast from './InlineToast';
import IpBuck, { IP_BUCK_TOKEN_SRC } from './IpBuck';
import IpAvatar from './IpAvatar';

export const STUDENT_REWARD_THEME_STYLES = {
  'ip-classic': {
    hero: 'bg-gradient-to-br from-white via-white to-violet-50/80 dark:from-[#11162a] dark:via-[#0b1022] dark:to-violet-950/50',
    primaryGlow: 'bg-violet-500/20',
    secondaryGlow: 'bg-cyan-400/15',
    accent: 'text-violet-600 dark:text-cyan-300',
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200'
  },
  'focus-blue': {
    hero: 'bg-gradient-to-br from-white via-blue-50/80 to-cyan-50 dark:from-[#081426] dark:via-[#0a1c35] dark:to-cyan-950/50',
    primaryGlow: 'bg-blue-500/20',
    secondaryGlow: 'bg-cyan-400/20',
    accent: 'text-blue-700 dark:text-cyan-300',
    chip: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200'
  },
  'growth-green': {
    hero: 'bg-gradient-to-br from-white via-emerald-50/80 to-teal-50 dark:from-[#071b19] dark:via-[#09251f] dark:to-emerald-950/50',
    primaryGlow: 'bg-emerald-500/20',
    secondaryGlow: 'bg-teal-400/20',
    accent: 'text-emerald-700 dark:text-emerald-300',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
  },
  'momentum-violet': {
    hero: 'bg-gradient-to-br from-fuchsia-50 via-violet-50 to-cyan-50 dark:from-[#1a0d2d] dark:via-[#251044] dark:to-[#09253a]',
    primaryGlow: 'bg-fuchsia-500/20',
    secondaryGlow: 'bg-violet-500/20',
    accent: 'text-fuchsia-700 dark:text-fuchsia-300',
    chip: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-200'
  },
  'sunrise-gold': {
    hero: 'bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-[#281706] dark:via-[#311506] dark:to-[#35101b]',
    primaryGlow: 'bg-amber-400/25',
    secondaryGlow: 'bg-rose-400/20',
    accent: 'text-amber-700 dark:text-amber-300',
    chip: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'
  }
};

const DEFAULT_AVATAR = {
  coreColor: 'violet',
  skinTone: 'warm-medium',
  faceShape: 'oval',
  eyeColor: 'deep-brown',
  eyebrowStyle: 'natural',
  facialHairStyle: 'none',
  glassesStyle: 'none',
  bodyStyle: 'balanced',
  hairStyle: 'textured-crop',
  hairColor: 'espresso',
  outfitStyle: 'protocol-jacket',
  pose: 'ready',
  expression: 'focused',
  aura: 'aura-classic',
  headwear: 'none',
  accessory: 'none',
  backdrop: 'backdrop-grid',
  companion: 'none'
};

const DEFAULT_REWARDS = {
  metrics: { successfulDays: 0, totalCompletions: 0, longestStreak: 0, bouncebacks: 0, improvementSteps: 0, growthScore: 0, habitMomentum: [] },
  preferences: { selectedThemeId: 'ip-classic', selectedTitleId: 'steady-starter' },
  themes: [],
  titles: [],
  earnedCount: 0,
  totalCount: 0,
  nextUnlock: null,
  economy: {
    wallet: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
    avatar: DEFAULT_AVATAR,
    avatarChoices: { coreColors: [], skinTones: [], faceShapes: [], eyeColors: [], eyebrowStyles: [], facialHairStyles: [], glassesStyles: [], bodyStyles: [], hairStyles: [], hairColors: [], outfitStyles: [], poses: [], expressions: [] },
    shop: [],
    purchases: [],
    activity: [],
    habitMomentum: [],
    fibonacci: { ladder: [], awardCap: 55, rule: '' },
    entitlements: [],
    newEarnings: 0
  }
};

const TABS = [
  ['earn', 'Earn', FiTrendingUp],
  ['shop', 'Shop', FiShoppingBag],
  ['avatar', 'Avatar', FiUser],
  ['locker', 'Locker', FiAward]
];

const SLOT_LABELS = {
  aura: 'Aura',
  headwear: 'Headwear',
  accessory: 'Accessory',
  backdrop: 'Backdrop',
  companion: 'Companion'
};

const SLOT_DEFAULTS = {
  aura: ['aura-classic', 'Classic aura'],
  headwear: ['none', 'No headwear'],
  accessory: ['none', 'No accessory'],
  backdrop: ['backdrop-grid', 'Classic grid'],
  companion: ['none', 'No companion']
};

const rarityTone = {
  common: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
  rare: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200',
  epic: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200',
  legendary: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  future: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-200'
};

function progressPercent(reward) {
  if (!reward) return 0;
  return Math.min(100, Math.round((Number(reward.progress || 0) / Math.max(Number(reward.target || 1), 1)) * 100));
}

function StudentRewardsPanel({ groupId, studentId, refreshKey, onRewardsChange, onOpenFeature, standalone = false, workspaceType = 'school', readOnlyPreview = false }) {
  const isFootballWorkspace = workspaceType === 'football';
  const isStaffWorkspace = workspaceType === 'staff';
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [open, setOpen] = useState(standalone);
  const [activeTab, setActiveTab] = useState(standalone ? 'shop' : 'earn');
  const [lockerCollection, setLockerCollection] = useState('themes');
  const [avatarDraft, setAvatarDraft] = useState(DEFAULT_AVATAR);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [toast, setToast] = useState(null);

  const applyRewards = (nextRewards) => {
    const normalized = nextRewards || DEFAULT_REWARDS;
    setRewards(normalized);
    setAvatarDraft(normalized.economy?.avatar || DEFAULT_AVATAR);
    onRewardsChange?.(normalized);
    if (!readOnlyPreview) window.dispatchEvent(new CustomEvent('ip-bucks-updated', {
      detail: { balance: Number(normalized.economy?.wallet?.balance) || 0 }
    }));
  };

  useEffect(() => {
    if (!groupId || !studentId) return undefined;
    let active = true;
    setLoading(true);
    api.get(`/groups/${groupId}/students/${studentId}/${readOnlyPreview ? 'preview' : 'rewards'}`)
      .then((response) => {
        if (!active) return;
        applyRewards(response.data?.rewards);
        const newEarnings = Number(response.data?.rewards?.economy?.newEarnings || 0);
        if (newEarnings > 0) setToast({ type: 'success', title: `+${newEarnings} IP Bucks`, message: 'Your consistency streak just paid off.' });
      })
      .catch((error) => {
        if (active) setToast({ type: 'error', title: 'IP Rewards unavailable', message: error.response?.data?.error || 'Refresh the page to try again.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [groupId, studentId, refreshKey, readOnlyPreview]);

  const economy = rewards.economy || DEFAULT_REWARDS.economy;
  const wallet = economy.wallet || DEFAULT_REWARDS.economy.wallet;
  const selectedTitle = rewards.titles.find((item) => item.id === rewards.preferences.selectedTitleId);
  const selectedTheme = rewards.themes.find((item) => item.id === rewards.preferences.selectedThemeId);
  const lockerItems = lockerCollection === 'themes' ? rewards.themes : rewards.titles;
  const avatarItemsBySlot = useMemo(() => Object.fromEntries(
    Object.keys(SLOT_LABELS).map((slot) => [slot, (economy.shop || []).filter((item) => item.kind === 'avatar' && item.slot === slot && item.owned)])
  ), [economy.shop]);

  const updatePreferences = async (payload, successToast) => {
    if (readOnlyPreview) return;
    try {
      setSaving(payload.avatar ? 'avatar' : 'locker');
      const response = await api.put(`/groups/${groupId}/students/${studentId}/rewards`, {
        ...rewards.preferences,
        ...payload
      });
      applyRewards(response.data?.rewards);
      if (successToast) setToast(successToast);
    } catch (error) {
      setToast({ type: 'error', title: 'Could not save rewards', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSaving('');
    }
  };

  const equipLockerReward = (reward) => {
    if (!reward.unlocked || saving) return;
    const preferenceKey = lockerCollection === 'themes' ? 'selectedThemeId' : 'selectedTitleId';
    if (rewards.preferences[preferenceKey] === reward.id) return;
    updatePreferences({ [preferenceKey]: reward.id }, { type: 'success', title: `${reward.name} equipped`, message: `Your ${isFootballWorkspace ? 'football' : isStaffWorkspace ? 'Coaches HQ' : 'student'} workspace has been updated.` });
  };

  const confirmPurchase = async () => {
    if (readOnlyPreview) return;
    if (!pendingPurchase || saving) return;
    try {
      setSaving(`purchase-${pendingPurchase.id}`);
      const response = await api.post(`/groups/${groupId}/students/${studentId}/rewards/shop/purchase`, { itemId: pendingPurchase.id });
      applyRewards(response.data?.rewards);
      setToast({
        type: 'success',
        title: `${pendingPurchase.name} unlocked`,
        message: pendingPurchase.kind === 'feature' ? 'It is now available in IP Tools.' : `It is now available in your ${isFootballWorkspace ? 'Kit Room' : 'Avatar Studio'}.`
      });
      setPendingPurchase(null);
      if (pendingPurchase.kind === 'avatar') setActiveTab('avatar');
    } catch (error) {
      setToast({ type: 'error', title: 'Purchase not completed', message: error.response?.data?.error || 'Please try again.' });
    } finally {
      setSaving('');
    }
  };

  const saveAvatar = () => updatePreferences({ avatar: avatarDraft }, { type: 'success', title: 'Avatar equipped', message: `Your IP ${isFootballWorkspace ? 'football avatar' : 'Avatar'} is now live on your workspace.` });

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-violet-50 shadow-[0_18px_55px_rgba(120,53,15,0.09)] dark:border-amber-300/15 dark:from-amber-500/10 dark:via-white/[0.04] dark:to-violet-500/10">
      <div className="p-3.5 sm:p-5">
        {toast ? <div className="mb-4"><InlineToast toast={toast} onClose={() => setToast(null)} /></div> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IpAvatar avatar={economy.avatar} className="h-16 w-16 shrink-0 rounded-2xl shadow-lg sm:h-20 sm:w-20" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">{isFootballWorkspace ? 'IP Football Rewards' : isStaffWorkspace ? 'IP Staff Avatar Economy' : 'IP Rewards'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black text-slate-950 dark:text-white">{selectedTitle?.name || 'Steady Starter'}</h3><span className="rounded-full border border-amber-200 bg-white/85 px-2.5 py-1 text-amber-800 dark:border-amber-300/20 dark:bg-white/5 dark:text-amber-200"><IpBuck amount={wallet.balance || 0} compact /></span></div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedTheme?.name || 'IP Classic'} · {economy.purchases?.length || 0} shop items owned</p>
              {readOnlyPreview && economy.pendingPreviewEarnings > 0 ? <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Includes {economy.pendingPreviewEarnings} pending IP Bucks for this school; credited when the student opens their wallet.</p> : null}
            </div>
          </div>
          {!standalone ? <button type="button" onClick={() => setOpen((previous) => !previous)} disabled={loading} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-slate-950 sm:w-auto">
            {loading ? 'Loading IP Rewards...' : open ? 'Close rewards' : 'Open IP Rewards'}
          </button> : null}
        </div>
      </div>

      {(open || standalone) ? (
        <div className="border-t border-amber-200/70 bg-white/80 dark:border-white/10 dark:bg-[#080d1d]/80">
          <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/70 p-1.5 dark:border-white/10 dark:bg-white/[0.025]">
            {TABS.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-black transition sm:flex-row sm:justify-center sm:text-xs ${activeTab === id ? 'bg-white text-violet-700 shadow-sm dark:bg-white/10 dark:text-cyan-200' : 'text-slate-500 dark:text-slate-400'}`}><Icon className="h-4 w-4" />{isFootballWorkspace && id === 'avatar' ? 'Player' : label}</button>)}
          </div>

          <div className="p-3.5 sm:p-5">
            {activeTab === 'earn' ? <EarnPanel economy={economy} rewards={rewards} isFootballWorkspace={isFootballWorkspace} /> : null}
            {activeTab === 'shop' ? <ShopPanel economy={economy} wallet={wallet} onSelectPurchase={readOnlyPreview ? () => setToast({ type: 'info', title: 'Read-only preview', message: 'Purchases are disabled in student preview.' }) : setPendingPurchase} onOpenAvatar={() => setActiveTab('avatar')} onOpenFeature={onOpenFeature} isFootballWorkspace={isFootballWorkspace} isStaffWorkspace={isStaffWorkspace} /> : null}
            {activeTab === 'avatar' ? <AvatarStudio economy={economy} avatarDraft={avatarDraft} setAvatarDraft={setAvatarDraft} avatarItemsBySlot={avatarItemsBySlot} saving={saving} onSave={saveAvatar} isFootballWorkspace={isFootballWorkspace} isStaffWorkspace={isStaffWorkspace} /> : null}
            {activeTab === 'locker' ? <LockerPanel rewards={rewards} collection={lockerCollection} setCollection={setLockerCollection} items={lockerItems} saving={saving} onEquip={equipLockerReward} /> : null}
          </div>
        </div>
      ) : null}

      {pendingPurchase ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-slate-900 p-5 text-white shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><img src={IP_BUCK_TOKEN_SRC} alt="" aria-hidden="true" className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_8px_14px_rgba(245,158,11,0.3)]" /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Confirm purchase</p><h3 className="mt-2 truncate text-2xl font-black">{pendingPurchase.name}</h3></div></div><button type="button" onClick={() => setPendingPurchase(null)} className="rounded-xl border border-white/10 p-2 text-slate-400"><FiX /></button></div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{pendingPurchase.description}</p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><span className="text-sm font-bold text-slate-300">Your balance: <IpBuck amount={wallet.balance || 0} compact className="ml-1 text-amber-200" /></span><IpBuck amount={pendingPurchase.price} className="text-amber-200" /></div>
            <p className="mt-3 text-xs text-slate-500">IP Bucks cannot be purchased with real money. This permanently unlocks the item for this account.</p>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setPendingPurchase(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300">Cancel</button><button type="button" onClick={confirmPurchase} disabled={!!saving} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-black text-amber-950 disabled:opacity-50">{saving ? 'Purchasing...' : 'Confirm purchase'}</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EarnPanel({ economy, rewards, isFootballWorkspace }) {
  const wallet = economy.wallet || {};
  const performanceMetrics = isFootballWorkspace
    ? [['Days shown up', rewards.metrics.successfulDays, FiStar], ['Best full streak', rewards.metrics.longestStreak, FiZap], ['Comebacks', rewards.metrics.bouncebacks, FiTrendingUp], ['Growth score', rewards.metrics.growthScore, FiTrendingUp], ['Completion units', rewards.metrics.totalCompletions, FiCheck]]
    : [['Days shown up', rewards.metrics.successfulDays, FiStar], ['Best full streak', rewards.metrics.longestStreak, FiZap], ['Comebacks', rewards.metrics.bouncebacks, FiTrendingUp], ['Improvements', rewards.metrics.improvementSteps, FiTrendingUp], ['Completion units', rewards.metrics.totalCompletions, FiCheck]];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <WalletMetric label="Available" value={wallet.balance || 0} icon={FiStar} />
        <WalletMetric label="All-time earned" value={wallet.lifetimeEarned || 0} icon={FiTrendingUp} />
        <WalletMetric label="Spent" value={wallet.lifetimeSpent || 0} icon={FiShoppingBag} />
      </div>
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-400/20 dark:bg-cyan-400/10"><div className="flex items-start gap-3"><FiActivity className="mt-0.5 shrink-0 text-cyan-700 dark:text-cyan-300" /><div><h4 className="font-black text-cyan-950 dark:text-cyan-100">Consistency earns, one-offs do not</h4><p className="mt-1 text-xs leading-5 text-cyan-800/75 dark:text-cyan-100/65">{economy.fibonacci?.rule} Partial progress still counts in your performance statistics, but IP Bucks require a full habit completion.</p></div></div></div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Fibonacci reward ladder</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">{(economy.fibonacci?.ladder || []).map((step) => <div key={step.streak} className="min-w-[5.5rem] rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-white/10 dark:bg-white/[0.04]"><p className="text-[9px] font-black uppercase text-slate-400">Streak {step.streak}</p><div className="mt-2 flex justify-center"><IpBuck amount={step.reward} compact /></div></div>)}</div>
        <p className="mt-1 text-[10px] text-slate-500">Awards cap at {economy.fibonacci?.awardCap || 55} IP Bucks per completed habit occasion to keep the economy fair.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><h4 className="font-black text-slate-950 dark:text-white">Habit momentum</h4><div className="mt-3 space-y-2">{(economy.habitMomentum || []).map((habit) => <div key={habit.habitIndex} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{habit.habitName}</p><p className="text-[10px] text-slate-500">Current full streak: {habit.currentStreak}</p></div><div className="shrink-0 text-right"><IpBuck amount={habit.nextReward} compact /><p className="mt-0.5 text-[9px] text-slate-500">at streak {habit.nextStreak}</p></div></div>)}{!economy.habitMomentum?.length ? <p className="text-xs text-slate-500">Your active habit streaks will appear here.</p> : null}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><h4 className="font-black text-slate-950 dark:text-white">Wallet activity</h4><div className="mt-3 max-h-64 space-y-2 overflow-auto">{(economy.activity || []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-white/5"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700 dark:text-slate-300">{item.description}</p><p className="mt-0.5 text-[9px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</p></div><IpBuck amount={`${item.amount > 0 ? '+' : ''}${item.amount}`} compact className={`shrink-0 ${item.amount > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`} /></div>)}{!economy.activity?.length ? <p className="text-xs text-slate-500">Complete a habit twice in a row to create your first wallet entry.</p> : null}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{performanceMetrics.map(([label, value, Icon]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"><Icon className="h-4 w-4 text-violet-600 dark:text-cyan-300" /><p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p></div>)}</div>
    </div>
  );
}

function WalletMetric({ label, value, icon: Icon }) {
  return <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 dark:border-amber-300/15 dark:from-amber-400/10 dark:to-white/[0.03]"><Icon className="text-amber-600 dark:text-amber-300" /><div className="mt-2"><IpBuck amount={value} compact /></div><p className="mt-1 text-[8px] font-black uppercase tracking-wide text-slate-400">{label}</p></div>;
}

function ShopPanel({ economy, wallet, onSelectPurchase, onOpenAvatar, onOpenFeature, isFootballWorkspace, isStaffWorkspace }) {
  const [filter, setFilter] = useState('avatar');
  const items = (economy.shop || []).filter((item) => item.kind === filter);
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-slate-950 dark:text-white">{isStaffWorkspace ? 'Avatar Shop' : 'IP Shop'}</h3><p className="mt-1 text-xs text-slate-500">{isStaffWorkspace ? 'All performance tools are included. IP Bucks are only for avatar customisation.' : 'Spend only what consistency has earned. No real-money purchases.'}</p></div><span className="self-start rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200"><IpBuck amount={wallet.balance || 0} compact /></span></div>
      {!isStaffWorkspace ? <div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">{[['avatar', isFootballWorkspace ? 'Kits and player gear' : 'Avatar collection'], ['feature', isFootballWorkspace ? 'Football tools' : 'Performance tools']].map(([id, label]) => <button key={id} type="button" onClick={() => setFilter(id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${filter === id ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-500'}`}>{label}</button>)}</div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide ${rarityTone[item.rarity] || rarityTone.common}`}>{item.rarity}</span><h4 className="mt-3 font-black text-slate-950 dark:text-white">{item.name}</h4></div>{item.comingSoon ? <FiClock className="text-fuchsia-500" /> : item.owned ? <FiCheck className="text-emerald-500" /> : <FiShoppingBag className="text-violet-500" />}</div><p className="mt-2 flex-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p><div className="mt-4 flex items-center justify-between gap-3"><IpBuck amount={item.price} compact />{item.comingSoon ? <span className="rounded-lg bg-fuchsia-50 px-3 py-2 text-[10px] font-black text-fuchsia-700 dark:bg-fuchsia-400/10 dark:text-fuchsia-300">Coming soon</span> : item.owned ? <button type="button" onClick={() => item.kind === 'feature' ? onOpenFeature?.(item.toolId) : onOpenAvatar()} className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{item.kind === 'feature' ? 'Open tool' : 'Owned · Equip'}</button> : <button type="button" onClick={() => onSelectPurchase(item)} disabled={wallet.balance < item.price} className="rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35 dark:bg-white dark:text-slate-950">{wallet.balance >= item.price ? 'Buy' : `Need ${item.price - wallet.balance}`}</button>}</div></article>)}</div>
    </div>
  );
}

function AvatarStudio({ economy, avatarDraft, setAvatarDraft, avatarItemsBySlot, saving, onSave, isFootballWorkspace, isStaffWorkspace }) {
  const updateAvatar = (key, value) => setAvatarDraft((current) => ({ ...current, [key]: value }));
  const choices = economy.avatarChoices || {};
  const outfitChoices = [
    ...(choices.outfitStyles || []),
    ...(economy.shop || []).filter((item) => item.kind === 'avatar' && item.slot === 'outfitStyle' && item.owned)
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
  const randomizeAvatar = () => {
    const pick = (items, fallback) => items?.length ? items[Math.floor(Math.random() * items.length)].id : fallback;
    setAvatarDraft((current) => ({
      ...current,
      coreColor: pick(choices.coreColors, current.coreColor),
      skinTone: pick(choices.skinTones, current.skinTone),
      faceShape: pick(choices.faceShapes, current.faceShape),
      eyeColor: pick(choices.eyeColors, current.eyeColor),
      eyebrowStyle: pick(choices.eyebrowStyles, current.eyebrowStyle),
      facialHairStyle: pick(choices.facialHairStyles, current.facialHairStyle),
      glassesStyle: pick(choices.glassesStyles, current.glassesStyle),
      bodyStyle: pick(choices.bodyStyles, current.bodyStyle),
      hairStyle: pick(choices.hairStyles, current.hairStyle),
      hairColor: pick(choices.hairColors, current.hairColor),
      outfitStyle: pick(outfitChoices, current.outfitStyle),
      pose: pick(choices.poses, current.pose),
      expression: pick(choices.expressions, current.expression)
    }));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,.72fr)_1.28fr]">
      <div>
        <div className="sticky top-4 rounded-[1.75rem] border border-violet-200 bg-gradient-to-b from-violet-50 to-cyan-50 p-3 shadow-xl dark:border-violet-400/20 dark:from-violet-500/10 dark:to-cyan-500/5 sm:p-4">
          <IpAvatar avatar={avatarDraft} className="mx-auto w-full max-w-md shadow-2xl shadow-violet-950/25" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={randomizeAvatar} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-3 text-xs font-black text-violet-700 transition hover:border-violet-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-cyan-200"><FiRefreshCw /> Surprise me</button>
            <button type="button" onClick={onSave} disabled={saving === 'avatar'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-3 text-xs font-black text-white disabled:opacity-50"><FiSave /> {saving === 'avatar' ? 'Saving...' : 'Save avatar'}</button>
          </div>
          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Full-body IP character · All changes preview live</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950 dark:text-white">{isFootballWorkspace ? 'IP Football Avatar Studio' : isStaffWorkspace ? 'Coaches HQ Avatar Studio' : 'IP Avatar Studio'}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{isFootballWorkspace ? 'Build your player, choose their kit and equip permanent matchday items unlocked through consistency.' : isStaffWorkspace ? 'Build a more personal Bitmoji-style IP character. Tools are free; consistency currency is reserved for the avatar locker.' : 'Build your character, choose their energy, then equip permanent items unlocked from the IP Shop.'}</p>
        </div>

        <AvatarControlSection title="Character" description="Choose the features that make the avatar feel like yours.">
          <ChoiceRow label="Skin tone" items={choices.skinTones || []} selected={avatarDraft.skinTone} onSelect={(id) => updateAvatar('skinTone', id)} colorChoices />
          <ChoiceRow label="Face shape" items={choices.faceShapes || []} selected={avatarDraft.faceShape} onSelect={(id) => updateAvatar('faceShape', id)} />
          <ChoiceRow label="Eye colour" items={choices.eyeColors || []} selected={avatarDraft.eyeColor} onSelect={(id) => updateAvatar('eyeColor', id)} colorChoices />
          <ChoiceRow label="Eyebrows" items={choices.eyebrowStyles || []} selected={avatarDraft.eyebrowStyle} onSelect={(id) => updateAvatar('eyebrowStyle', id)} />
          <ChoiceRow label="Hair style" items={choices.hairStyles || []} selected={avatarDraft.hairStyle} onSelect={(id) => updateAvatar('hairStyle', id)} />
          <ChoiceRow label="Hair colour" items={choices.hairColors || []} selected={avatarDraft.hairColor} onSelect={(id) => updateAvatar('hairColor', id)} colorChoices />
          <ChoiceRow label="Facial hair" items={choices.facialHairStyles || []} selected={avatarDraft.facialHairStyle} onSelect={(id) => updateAvatar('facialHairStyle', id)} />
          <ChoiceRow label="Glasses" items={choices.glassesStyles || []} selected={avatarDraft.glassesStyle} onSelect={(id) => updateAvatar('glassesStyle', id)} />
        </AvatarControlSection>

        <AvatarControlSection title="Outfit and energy" description="Shape the character's uniform, stance, and expression.">
          <ChoiceRow label={isFootballWorkspace ? 'Kit' : 'Outfit'} items={outfitChoices} selected={avatarDraft.outfitStyle} onSelect={(id) => updateAvatar('outfitStyle', id)} />
          <ChoiceRow label="Outfit colour" items={choices.coreColors || []} selected={avatarDraft.coreColor} onSelect={(id) => updateAvatar('coreColor', id)} colorChoices />
          <ChoiceRow label="Pose" items={choices.poses || []} selected={avatarDraft.pose} onSelect={(id) => updateAvatar('pose', id)} />
          <ChoiceRow label="Expression" items={choices.expressions || []} selected={avatarDraft.expression} onSelect={(id) => updateAvatar('expression', id)} />
          <ChoiceRow label="Body style" items={choices.bodyStyles || []} selected={avatarDraft.bodyStyle} onSelect={(id) => updateAvatar('bodyStyle', id)} />
        </AvatarControlSection>

        <AvatarControlSection title="Equipment locker" description="Purchased equipment is yours permanently and can be swapped at any time.">
          {Object.entries(SLOT_LABELS).map(([slot, label]) => {
            const [defaultId, defaultName] = SLOT_DEFAULTS[slot];
            const items = [{ id: defaultId, name: defaultName }, ...(avatarItemsBySlot[slot] || [])];
            return <ChoiceRow key={slot} label={label} items={items} selected={avatarDraft[slot]} onSelect={(id) => updateAvatar(slot, id)} />;
          })}
        </AvatarControlSection>
      </div>
    </div>
  );
}

function AvatarControlSection({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035] sm:p-5">
      <h4 className="font-black text-slate-950 dark:text-white">{title}</h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ChoiceRow({ label, items, selected, onSelect, colorChoices = false }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><div className="mt-2 flex flex-wrap gap-2">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${selected === item.id ? 'border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200 dark:bg-violet-500/15 dark:text-cyan-200 dark:ring-violet-500/20' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'}`}>{colorChoices ? <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: item.color }} /> : null}{item.name}</button>)}</div></div>;
}

function LockerPanel({ rewards, collection, setCollection, items, saving, onEquip }) {
  return (
    <div><div><h3 className="text-xl font-black text-slate-950 dark:text-white">Achievement locker</h3><p className="mt-1 text-xs text-slate-500">These original rewards are earned through growth milestones and never cost IP Bucks.</p></div><div className="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">{[['themes', 'Dashboard themes'], ['titles', 'Profile titles']].map(([id, label]) => <button key={id} type="button" onClick={() => setCollection(id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black ${collection === id ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300' : 'text-slate-500'}`}>{label}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{items.map((reward) => { const selectedId = collection === 'themes' ? rewards.preferences.selectedThemeId : rewards.preferences.selectedTitleId; const equipped = selectedId === reward.id; const percent = progressPercent(reward); return <button key={reward.id} type="button" onClick={() => onEquip(reward)} disabled={!reward.unlocked || !!saving} className={`relative rounded-2xl border p-4 text-left ${equipped ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-500/15 dark:ring-violet-500/20' : reward.unlocked ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]' : 'cursor-not-allowed border-slate-200 bg-slate-100/70 opacity-70 dark:border-white/5 dark:bg-white/[0.02]'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950 dark:text-white">{reward.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{reward.description}</p></div>{reward.unlocked ? <FiCheck className="text-emerald-500" /> : <FiLock className="text-slate-400" />}</div>{equipped ? <p className="mt-3 text-[10px] font-black uppercase text-violet-700 dark:text-cyan-300">Equipped</p> : reward.unlocked ? <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Equip <FiChevronRight /></p> : <div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-500" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">{reward.unlockText}</p></div>}</button>; })}</div></div>
  );
}

export default StudentRewardsPanel;

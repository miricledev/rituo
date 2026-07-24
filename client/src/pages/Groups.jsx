import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FaArrowRight,
  FaCheckCircle,
  FaCopy,
  FaCrown,
  FaFootballBall,
  FaGraduationCap,
  FaKey,
  FaLayerGroup,
  FaPlus,
  FaRegStar,
  FaSchool,
  FaSearch,
  FaShieldAlt,
  FaSignInAlt,
  FaStar,
  FaTimes,
  FaUserGraduate,
  FaUsers
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import InlineToast from '../components/InlineToast';

const cardGradients = [
  'from-violet-500 via-indigo-500 to-cyan-400',
  'from-blue-500 via-cyan-400 to-emerald-400',
  'from-fuchsia-500 via-violet-500 to-blue-400',
  'from-indigo-500 via-blue-500 to-sky-300'
];

const roleLabels = {
  'school-admin': 'School admin',
  headteacher: 'Headteacher',
  teacher: 'Teacher',
  student: 'Student',
  coach: 'Coach',
  'pastoral-lead': 'Pastoral lead'
};

const workspaceCopy = {
  admin: {
    eyebrow: 'School network',
    title: 'Lead every school from one place.',
    description: 'Open a school workspace, provision its people, and keep every operational workflow connected.',
    icon: FaShieldAlt
  },
  teacher: {
    eyebrow: 'Assigned schools',
    title: 'Move straight into the work that matters.',
    description: 'Your assigned schools bring classes, registers, behaviour, homework, and interventions together.',
    icon: FaGraduationCap
  },
  student: {
    eyebrow: 'My school',
    title: 'Your school, goals, and habits in one space.',
    description: 'Open your school workspace to see the routines, support, and daily actions connected to you.',
    icon: FaUserGraduate
  }
};

const emptyGroupForm = {
  name: '',
  password: '',
  memberCount: 1,
  groupType: 'school'
};

const emptyJoinForm = {
  groupId: '',
  password: ''
};

const Groups = ({ legacyMode = false }) => {
  const [groups, setGroups] = useState({ memberOf: [], leading: [] });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroup, setNewGroup] = useState(emptyGroupForm);
  const [joinGroup, setJoinGroup] = useState(emptyJoinForm);
  const [favoriteGroups, setFavoriteGroups] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const role = currentUser?.accountRole || 'student';
  const pageMeta = legacyMode
    ? {
        eyebrow: 'Preserved access',
        title: 'Your legacy workspaces.',
        description: 'Older owner-created schools and groups remain available exactly where you left them.',
        icon: FaLayerGroup
      }
    : workspaceCopy[role] || workspaceCopy.student;
  const PageIcon = pageMeta.icon;

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/groups/my-groups');
      const topLevelGroups = {
        memberOf: response.data.memberOf || [],
        leading: response.data.leading || []
      };
      const legacyGroups = response.data.legacy || {
        memberOf: topLevelGroups.memberOf.filter((group) => group.isLegacy !== false),
        leading: topLevelGroups.leading.filter((group) => group.isLegacy !== false)
      };
      setGroups(legacyMode ? legacyGroups : {
        memberOf: topLevelGroups.memberOf.filter((group) => group.isLegacy === false),
        leading: topLevelGroups.leading.filter((group) => group.isLegacy === false)
      });
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Schools could not be loaded',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [currentUser, legacyMode]);

  const allGroups = useMemo(() => [...groups.leading, ...groups.memberOf], [groups]);
  const totalStudents = useMemo(
    () => allGroups.reduce((total, group) => total + (group.members?.length || 0), 0),
    [allGroups]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filterGroups = (items) => (
    normalizedQuery
      ? items.filter((group) => `${group.name} ${group.groupId} ${group.viewerSchoolRole || ''}`.toLowerCase().includes(normalizedQuery))
      : items
  );
  const visibleLeading = filterGroups(groups.leading);
  const visibleMemberOf = filterGroups(groups.memberOf);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await axios.post('/groups/create', {
        ...newGroup,
        memberCount: Number(newGroup.memberCount)
      });
      setShowCreateModal(false);
      setNewGroup(emptyGroupForm);
      setToast({
        type: 'success',
        title: 'School created',
        message: 'Your new school workspace is ready.'
      });
      await fetchGroups();
    } catch (error) {
      setToast({
        type: 'error',
        title: 'School was not created',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await axios.post('/groups/join', joinGroup);
      setShowJoinModal(false);
      setJoinGroup(emptyJoinForm);
      setToast({
        type: 'success',
        title: 'Legacy school joined',
        message: 'The workspace is now available in your legacy list.'
      });
      await fetchGroups();
    } catch (error) {
      setToast({
        type: 'error',
        title: 'School was not joined',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFavorite = (groupId) => {
    setFavoriteGroups((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ));
  };

  const handleCopyId = async (groupId) => {
    await navigator.clipboard.writeText(groupId);
    setCopiedId(groupId);
    window.setTimeout(() => setCopiedId(null), 1200);
  };

  const GroupCard = ({ group, index, isLeader }) => {
    const groupType = group.groupType || 'school';
    const gradient = cardGradients[index % cardGradients.length];
    const viewerRole = roleLabels[group.viewerSchoolRole] || group.viewerSchoolRole || (isLeader ? 'Leader' : role);
    const isFavorite = favoriteGroups.includes(group.groupId);

    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
        whileHover={{ y: -5 }}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/groups/${group.groupId}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') navigate(`/groups/${group.groupId}`);
        }}
        className="group relative cursor-pointer overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[0.055] p-5 text-left shadow-xl shadow-slate-950/20 backdrop-blur-xl outline-none transition hover:border-cyan-300/30 focus:border-cyan-300/50"
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${gradient}`} />
        <div className={`pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-3xl transition group-hover:opacity-20`} />

        <div className="relative flex items-start justify-between gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-xl font-black text-slate-950 shadow-lg`}>
            {group.name?.[0]?.toUpperCase() || 'S'}
          </div>
          <div className="flex items-center gap-2">
            {isLeader && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                <FaCrown /> Lead
              </span>
            )}
            <button
              type="button"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(group.groupId);
              }}
              className="rounded-xl border border-white/10 bg-slate-950/40 p-2.5 text-slate-500 transition hover:border-amber-300/30 hover:text-amber-300"
            >
              {isFavorite ? <FaStar className="text-amber-300" /> : <FaRegStar />}
            </button>
          </div>
        </div>

        <div className="relative mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${legacyMode ? 'bg-amber-400/10 text-amber-200' : 'bg-cyan-400/10 text-cyan-200'}`}>
              {groupType === 'football' ? <FaFootballBall /> : <FaSchool />}
              {groupType === 'football' ? 'Football group' : 'School'}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {viewerRole}
            </span>
          </div>
          <h2 className="mt-4 truncate text-xl font-bold tracking-tight text-white">{group.name}</h2>
          <p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-400">
            {isLeader
              ? 'Manage people, performance, habits, and school operations.'
              : 'Open your assigned workspace and continue where you left off.'}
          </p>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><FaUsers /> Students</div>
            <div className="mt-2 text-lg font-bold">{group.members?.length || 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-3">
            <div className="text-xs text-slate-500">Workspace ID</div>
            <div className="mt-2 truncate font-mono text-sm font-semibold text-slate-200">{group.groupId}</div>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCopyId(group.groupId);
            }}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            {copiedId === group.groupId ? <><FaCheckCircle className="text-emerald-400" /> Copied</> : <><FaCopy /> Copy ID</>}
          </button>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300 transition group-hover:translate-x-1">
            Open workspace <FaArrowRight />
          </span>
        </div>
      </motion.article>
    );
  };

  const WorkspaceSection = ({ title, description, icon: Icon, items, isLeader, startIndex = 0 }) => {
    if (!items.length) return null;
    return (
      <section className="mt-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
              <Icon className={isLeader ? 'text-amber-300' : 'text-cyan-300'} /> {title}
            </div>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">{items.length} workspace{items.length === 1 ? '' : 's'}</span>
        </div>
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((group, index) => (
              <GroupCard key={group.id} group={group} index={startIndex + index} isLeader={isLeader} />
            ))}
          </div>
        </AnimatePresence>
      </section>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: legacyMode
            ? 'radial-gradient(circle at 12% 0%, rgba(245,158,11,.16), transparent 32%), radial-gradient(circle at 88% 12%, rgba(99,102,241,.14), transparent 28%), linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)'
            : 'radial-gradient(circle at 10% 0%, rgba(99,102,241,.22), transparent 32%), radial-gradient(circle at 90% 15%, rgba(6,182,212,.16), transparent 30%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
          backgroundSize: 'auto, auto, 44px 44px, 44px 44px'
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <InlineToast toast={toast} onClose={() => setToast(null)} />

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl sm:p-8"
        >
          <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ${legacyMode ? 'bg-amber-300 text-amber-950' : 'bg-gradient-to-r from-violet-300 to-cyan-300 text-slate-950'}`}>
                  <PageIcon /> {pageMeta.eyebrow}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {legacyMode ? 'Historical mode' : role}
                </span>
              </div>
              <h1 className="mt-7 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">{pageMeta.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{pageMeta.description}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {!legacyMode && role === 'admin' && (
                  <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-100">
                    <FaPlus /> Create school
                  </button>
                )}
                {legacyMode && (
                  <button onClick={() => setShowJoinModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5 hover:bg-amber-200">
                    <FaSignInAlt /> Join legacy school
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                [allGroups.length, 'Schools', FaSchool],
                [totalStudents, 'Students', FaUsers],
                [groups.leading.length, legacyMode ? 'Leading' : 'Managing', FaCrown],
                [roleLabels[allGroups[0]?.viewerSchoolRole] || role, 'Your role', FaShieldAlt]
              ].map(([value, label, Icon]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <Icon className={legacyMode ? 'text-amber-300' : 'text-cyan-300'} />
                  <div className="mt-5 truncate text-2xl font-bold capitalize">{value}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-1 items-center gap-3 rounded-xl bg-slate-950/50 px-4 py-3">
            <FaSearch className="text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search schools, workspace ID, or role"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="px-3 text-xs text-slate-500">
            {normalizedQuery ? `${visibleLeading.length + visibleMemberOf.length} matching` : `${allGroups.length} total workspaces`}
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[330px] animate-pulse rounded-[1.65rem] border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <>
            <WorkspaceSection
              title={legacyMode ? 'Schools I lead' : 'Schools I administer'}
              description={legacyMode ? 'Owner-created workspaces where you retain legacy leader controls.' : 'Schools where you can manage people, structure, and performance.'}
              icon={FaCrown}
              items={visibleLeading}
              isLeader
            />
            <WorkspaceSection
              title={legacyMode ? 'Schools I joined' : 'Assigned schools'}
              description={legacyMode ? 'Older workspaces where you participate as a member.' : 'Schools assigned to your account by an administrator.'}
              icon={FaUsers}
              items={visibleMemberOf}
              startIndex={100}
            />

            {!visibleLeading.length && !visibleMemberOf.length && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.035] px-6 py-16 text-center">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${legacyMode ? 'bg-amber-400/10 text-amber-300' : 'bg-cyan-400/10 text-cyan-300'}`}>
                  {normalizedQuery ? <FaSearch className="text-2xl" /> : <FaSchool className="text-2xl" />}
                </div>
                <h2 className="mt-5 text-2xl font-bold">{normalizedQuery ? 'No schools match your search' : 'No schools here yet'}</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  {normalizedQuery
                    ? 'Try a school name, workspace ID, or assigned role.'
                    : legacyMode
                      ? 'Older owner-created schools will remain available here when you have legacy access.'
                      : role === 'admin'
                        ? 'Create your first managed school and start provisioning staff and students.'
                        : 'An administrator will assign your school to this account.'}
                </p>
                {!normalizedQuery && !legacyMode && role === 'admin' && (
                  <button onClick={() => setShowCreateModal(true)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950">
                    <FaPlus /> Create your first school
                  </button>
                )}
              </motion.section>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && !legacyMode && role === 'admin' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setShowCreateModal(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.form
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={handleCreateGroup}
              className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b1022] p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">New school workspace</p>
                  <h2 className="mt-2 text-2xl font-bold">Create a managed school</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">You will become its school administrator and can provision accounts immediately.</p>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-white/10 p-3 text-slate-400 hover:bg-white/5 hover:text-white"><FaTimes /></button>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">School name</span>
                  <input value={newGroup.name} onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })} placeholder="Northbridge Academy" required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-cyan-400" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Workspace password</span>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 focus-within:border-cyan-400">
                    <FaKey className="text-slate-600" />
                    <input type="password" value={newGroup.password} onChange={(event) => setNewGroup({ ...newGroup, password: event.target.value })} placeholder="Secure school password" required className="w-full bg-transparent py-3 outline-none" />
                  </div>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-slate-400">Expected students</span>
                    <input type="number" min="1" max="100" value={newGroup.memberCount} onChange={(event) => setNewGroup({ ...newGroup, memberCount: event.target.value })} required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-cyan-400" />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-semibold text-slate-400">Workspace type</span>
                    <select value={newGroup.groupType} onChange={(event) => setNewGroup({ ...newGroup, groupType: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-cyan-400">
                      <option value="school">School</option>
                      <option value="football">Football group</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/5">Cancel</button>
                <button disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                  <FaPlus /> {submitting ? 'Creating...' : 'Create school'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}

        {showJoinModal && legacyMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setShowJoinModal(false)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.form
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={handleJoinGroup}
              className="w-full max-w-lg rounded-[2rem] border border-amber-300/20 bg-[#11101c] p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Legacy access</p>
                  <h2 className="mt-2 text-2xl font-bold">Join an older workspace</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use the original workspace ID and password supplied by its owner.</p>
                </div>
                <button type="button" onClick={() => setShowJoinModal(false)} className="rounded-xl border border-white/10 p-3 text-slate-400 hover:bg-white/5 hover:text-white"><FaTimes /></button>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Workspace ID</span>
                  <input value={joinGroup.groupId} onChange={(event) => setJoinGroup({ ...joinGroup, groupId: event.target.value })} placeholder="8-character ID" required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono outline-none focus:border-amber-300" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Workspace password</span>
                  <input type="password" value={joinGroup.password} onChange={(event) => setJoinGroup({ ...joinGroup, password: event.target.value })} placeholder="Password" required className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none focus:border-amber-300" />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowJoinModal(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/5">Cancel</button>
                <button disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950 disabled:opacity-50">
                  <FaSignInAlt /> {submitting ? 'Joining...' : 'Join workspace'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Groups;

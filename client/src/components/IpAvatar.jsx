import React, { useId } from 'react';

const CORE_COLORS = {
  violet: ['#8b5cf6', '#5b21b6', '#c4b5fd'],
  cyan: ['#22d3ee', '#0e7490', '#a5f3fc'],
  emerald: ['#34d399', '#047857', '#a7f3d0'],
  amber: ['#fbbf24', '#b45309', '#fde68a'],
  rose: ['#fb7185', '#be123c', '#fecdd3'],
  slate: ['#94a3b8', '#334155', '#e2e8f0'],
};

const SKIN_TONES = {
  porcelain: ['#f5d0b5', '#d99f7c', '#ffe4d1'],
  'warm-light': ['#e8b98f', '#bd805a', '#f7d2af'],
  'warm-medium': ['#c8895f', '#965d3d', '#e2aa7f'],
  'golden-brown': ['#a9673f', '#754127', '#c88659'],
  'deep-brown': ['#75442e', '#4d291c', '#95634a'],
  'rich-deep': ['#4b2a20', '#2d1712', '#6c4031'],
};

const HAIR_COLORS = {
  midnight: '#111827',
  espresso: '#3f251a',
  chestnut: '#7c3f24',
  golden: '#d6a84b',
  silver: '#cbd5e1',
  'protocol-violet': '#7c3aed',
};

const EYE_COLORS = {
  'deep-brown': '#3f2416',
  hazel: '#8a6a35',
  blue: '#3b82f6',
  green: '#4d7c55',
  grey: '#64748b',
};

const BACKDROPS = {
  'backdrop-grid': 'from-slate-900 via-violet-950 to-slate-950',
  'backdrop-midnight': 'from-[#020617] via-[#082f49] to-[#111827]',
  'backdrop-sunrise': 'from-amber-300 via-orange-400 to-rose-500',
  'backdrop-nebula': 'from-fuchsia-700 via-violet-800 to-cyan-700',
  'backdrop-floodlights': 'from-[#020617] via-[#0f3d35] to-[#14532d]',
  'backdrop-stadium-tunnel': 'from-[#020617] via-[#172554] to-[#312e81]',
};

function Face({ expression, skinShadow, eyeColor, eyebrowStyle }) {
  const mouth = expression === 'smile'
    ? 'M137 119 Q153 133 169 119'
    : expression === 'determined'
      ? 'M139 126 Q153 119 167 126'
      : 'M140 123 Q153 127 166 123';
  const browWidth = eyebrowStyle === 'bold' ? 6 : 4;
  const leftBrow = expression === 'determined'
    ? 'M123 91 L141 87'
    : eyebrowStyle === 'arched'
      ? 'M123 91 Q132 83 141 91'
      : eyebrowStyle === 'straight'
        ? 'M123 89 H141'
        : 'M123 91 Q132 87 141 90';
  const rightBrow = expression === 'determined'
    ? 'M166 87 L184 91'
    : eyebrowStyle === 'arched'
      ? 'M166 91 Q175 83 184 91'
      : eyebrowStyle === 'straight'
        ? 'M166 89 H184'
        : 'M166 90 Q175 87 184 91';
  return (
    <g>
      <g fill="none" stroke={skinShadow} strokeLinecap="round">
        <path d={leftBrow} strokeWidth={browWidth} />
        <path d={rightBrow} strokeWidth={browWidth} />
      </g>
      <g>
        <ellipse cx="133" cy="101" rx="9" ry="6.5" fill="#f8fafc" opacity="0.96" />
        <ellipse cx="175" cy="101" rx="9" ry="6.5" fill="#f8fafc" opacity="0.96" />
        <circle cx="134" cy="101" r="4.8" fill={eyeColor} />
        <circle cx="174" cy="101" r="4.8" fill={eyeColor} />
        <circle cx="134" cy="101" r="2.3" fill="#0f172a" />
        <circle cx="174" cy="101" r="2.3" fill="#0f172a" />
        <circle cx="132.5" cy="99.5" r="1.2" fill="white" />
        <circle cx="172.5" cy="99.5" r="1.2" fill="white" />
      </g>
      <g fill="none" stroke={skinShadow} strokeLinecap="round">
        <path d={mouth} strokeWidth="4.2" />
        <path d="M153 103 Q149 111 151 115 Q154 117 158 114" opacity="0.48" strokeWidth="2.5" />
        <path d="M143 132 Q153 136 163 132" opacity="0.18" strokeWidth="2" />
      </g>
      <ellipse cx="120" cy="114" rx="9" ry="5" fill="#fb7185" opacity="0.08" />
      <ellipse cx="188" cy="114" rx="9" ry="5" fill="#fb7185" opacity="0.08" />
    </g>
  );
}

function FacialHair({ style, color }) {
  if (!style || style === 'none') return null;
  if (style === 'stubble') {
    return <path d="M125 116 Q132 147 154 151 Q178 147 184 116 Q176 139 154 141 Q134 139 125 116 Z" fill={color} opacity="0.2" />;
  }
  if (style === 'moustache') {
    return <path d="M151 116 Q142 112 135 119 Q143 126 153 121 Q164 126 173 119 Q165 112 155 116 Z" fill={color} opacity="0.86" />;
  }
  return (
    <g fill={color} opacity="0.82">
      <path d="M126 119 Q132 148 154 154 Q178 148 183 119 Q176 137 165 143 L154 151 L143 143 Q132 137 126 119 Z" />
      <path d="M151 116 Q142 112 135 119 Q143 125 153 121 Q164 125 173 119 Q165 112 155 116 Z" />
    </g>
  );
}

function Glasses({ style }) {
  if (!style || style === 'none') return null;
  const rounded = style === 'round';
  const aviator = style === 'aviator';
  return (
    <g fill={aviator ? 'rgba(56,189,248,.12)' : 'rgba(255,255,255,.04)'} stroke="#1e293b" strokeWidth="3.5">
      {rounded ? <><circle cx="133" cy="101" r="13" /><circle cx="175" cy="101" r="13" /></> : aviator ? <><path d="M119 91 Q133 87 145 93 L142 110 Q132 119 122 109 Z" /><path d="M163 93 Q176 87 190 91 L187 109 Q177 119 166 110 Z" /></> : <><rect x="119" y="89" width="28" height="24" rx="6" /><rect x="161" y="89" width="28" height="24" rx="6" /></>}
      <path d="M146 98 Q154 94 162 98 M119 96 L105 92 M189 96 L203 92" fill="none" />
    </g>
  );
}

function Hair({ style, color }) {
  if (style === 'none') return null;
  if (style === 'soft-curls') {
    return (
      <g fill={color} stroke="rgba(255,255,255,.12)" strokeWidth="2">
        {[112, 130, 149, 168, 187, 203].map((centerX, index) => <circle key={centerX} cx={centerX} cy={index % 2 ? 52 : 55} r="17" />)}
        <circle cx="111" cy="73" r="15" /><circle cx="199" cy="72" r="15" />
      </g>
    );
  }
  if (style === 'high-top') {
    return <path d="M111 63 L111 25 Q111 15 122 15 H190 Q201 15 201 27 V64 Z" fill={color} stroke="rgba(255,255,255,.14)" strokeWidth="3" />;
  }
  if (style === 'side-sweep') {
    return <path d="M105 73 Q111 37 151 37 Q194 35 207 67 Q177 52 151 78 Q130 65 105 85 Z" fill={color} stroke="rgba(255,255,255,.14)" strokeWidth="3" />;
  }
  if (style === 'tied-back') {
    return (
      <g fill={color} stroke="rgba(255,255,255,.14)" strokeWidth="3">
        <circle cx="215" cy="67" r="22" />
        <path d="M105 71 Q118 38 155 39 Q190 39 205 69 Q169 53 105 82 Z" />
      </g>
    );
  }
  if (style === 'locs') {
    return (
      <g fill="none" stroke={color} strokeLinecap="round" strokeWidth="10">
        <path d="M112 68 Q112 40 128 40 V79" />
        <path d="M135 62 Q137 32 151 34 V74" />
        <path d="M158 60 Q164 31 177 38 V76" />
        <path d="M181 64 Q191 41 198 51 V84" />
      </g>
    );
  }
  return <path d="M105 73 Q111 39 151 38 Q190 37 205 69 L203 80 Q178 60 106 84 Z" fill={color} stroke="rgba(255,255,255,.14)" strokeWidth="3" />;
}

function Headwear({ type }) {
  if (type === 'headwear-focus-band') {
    return <path d="M104 68 Q153 54 207 69 L205 82 Q155 69 105 83 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />;
  }
  if (type === 'headwear-headphones') {
    return (
      <g fill="none" stroke="#e2e8f0" strokeWidth="10">
        <path d="M99 91 Q99 39 156 39 Q213 39 213 91" />
        <rect x="92" y="83" width="20" height="45" rx="8" fill="#0f172a" />
        <rect x="205" y="83" width="20" height="45" rx="8" fill="#0f172a" />
      </g>
    );
  }
  if (type === 'headwear-crown') {
    return <path d="M112 52 L119 12 L141 36 L158 5 L177 36 L201 12 L201 57 Z" fill="#facc15" stroke="#fef3c7" strokeLinejoin="round" strokeWidth="4" />;
  }
  return null;
}

function Arms({ pose, skin, skinShadow, sleeveFill, sleeveSide }) {
  if (pose === 'confident') {
    return (
      <g stroke="rgba(255,255,255,.18)" strokeWidth="2">
        <path d="M101 178 L78 184 L58 225 L79 238 L111 205 Z" fill={sleeveFill} />
        <path d="M58 225 L76 232 L96 249 L84 264 L57 247 Q48 239 58 225 Z" fill={skin} />
        <path d="M203 178 L226 184 L246 225 L225 238 L193 205 Z" fill={sleeveFill} />
        <path d="M246 225 L228 232 L208 249 L220 264 L247 247 Q256 239 246 225 Z" fill={skinShadow} />
      </g>
    );
  }
  if (pose === 'victory') {
    return (
      <g stroke="rgba(255,255,255,.18)" strokeWidth="2">
        <path d="M101 178 L76 183 L66 245 L91 249 L115 201 Z" fill={sleeveFill} />
        <rect x="65" y="239" width="27" height="31" rx="10" fill={skin} />
        <path d="M201 181 L220 166 L226 110 L203 104 L184 184 Z" fill={sleeveSide} />
        <path d="M203 104 L226 110 L237 74 L215 67 Z" fill={skinShadow} />
        <path d="M215 68 L217 48 M224 70 L233 52 M230 75 L244 63" fill="none" stroke={skinShadow} strokeLinecap="round" strokeWidth="8" />
      </g>
    );
  }
  return (
    <g stroke="rgba(255,255,255,.18)" strokeWidth="2">
      <path d="M102 178 L76 184 L66 241 L91 247 L116 199 Z" fill={sleeveFill} />
      <rect x="65" y="237" width="28" height="35" rx="10" fill={skin} />
      <path d="M201 178 L225 184 L238 239 L214 248 L188 200 Z" fill={sleeveSide} />
      <rect x="213" y="237" width="28" height="35" rx="10" fill={skinShadow} />
    </g>
  );
}

function OutfitDetails({ style, accent, highlight }) {
  if (style === 'varsity') {
    return (
      <g>
        <path d="M112 169 L131 169 L153 244 L127 244 Z" fill="rgba(255,255,255,.18)" />
        <path d="M194 169 L176 169 L153 244 L179 244 Z" fill="rgba(15,23,42,.18)" />
        <path d="M153 170 V247" stroke="#f8fafc" strokeWidth="4" />
        {[187, 207, 227].map((centerY) => <circle key={centerY} cx="153" cy={centerY} r="3" fill="#f8fafc" />)}
        <text x="178" y="211" fill={highlight} fontSize="24" fontWeight="900" textAnchor="middle">IP</text>
      </g>
    );
  }
  if (style === 'performance-hoodie') {
    return (
      <g fill="none" stroke={highlight} strokeLinecap="round">
        <path d="M124 169 Q153 196 183 169" strokeWidth="7" opacity="0.65" />
        <path d="M142 186 V211 M164 186 V211" strokeWidth="3" />
        <path d="M129 226 Q153 218 177 226 V244 H129 Z" fill="rgba(15,23,42,.2)" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      </g>
    );
  }
  if (style === 'training-kit') {
    return (
      <g>
        <path d="M111 183 L194 222 V237 L111 198 Z" fill={highlight} opacity="0.75" />
        <path d="M111 204 L186 239 H159 L111 218 Z" fill="white" opacity="0.45" />
        <circle cx="177" cy="192" r="14" fill="rgba(15,23,42,.28)" stroke={highlight} strokeWidth="2" />
        <text x="177" y="197" fill="white" fontSize="12" fontWeight="900" textAnchor="middle">IP</text>
      </g>
    );
  }
  if (['outfit-ip-home-kit', 'outfit-ip-away-kit', 'outfit-goalkeeper-kit'].includes(style)) {
    const shirtText = style === 'outfit-goalkeeper-kit' ? 'GK' : 'IP';
    return (
      <g>
        <path d="M111 181 H195" fill="none" stroke={highlight} strokeWidth="5" opacity="0.8" />
        <path d="M111 220 H202" fill="none" stroke={style === 'outfit-ip-away-kit' ? '#22d3ee' : highlight} strokeWidth="6" opacity="0.88" />
        <path d="M151 169 V245" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="3" />
        <path d="M168 184 L190 184 L190 207 L179 214 L168 207 Z" fill="rgba(2,6,23,.45)" stroke={highlight} strokeWidth="2" />
        <text x="179" y="202" fill="white" fontSize="11" fontWeight="900" textAnchor="middle">{shirtText}</text>
        <text x="151" y="232" fill="rgba(255,255,255,.76)" fontSize="22" fontWeight="900" textAnchor="middle">10</text>
      </g>
    );
  }
  return (
    <g>
      <path d="M153 170 V247" stroke={highlight} strokeWidth="3" opacity="0.75" />
      <path d="M115 187 L139 173 L153 192 L168 173 L192 187" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="3" />
      <rect x="166" y="196" width="27" height="22" rx="6" fill="rgba(15,23,42,.3)" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
      <text x="179.5" y="211" fill="white" fontSize="11" fontWeight="900" textAnchor="middle">IP</text>
      <path d="M117 232 H142" stroke={accent} strokeWidth="3" opacity="0.6" />
    </g>
  );
}

function Accessory({ type }) {
  if (type === 'accessory-book') {
    return (
      <g transform="translate(42 231) rotate(-7)">
        <path d="M0 5 Q18 -2 36 6 V49 Q18 42 0 49 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
        <path d="M36 6 Q54 -2 72 5 V49 Q54 42 36 49 Z" fill="#dbeafe" stroke="#cbd5e1" strokeWidth="2" />
        <path d="M36 6 V49" stroke="#6366f1" strokeWidth="3" />
      </g>
    );
  }
  if (type === 'accessory-shield') {
    return <path d="M54 215 L91 205 L91 249 Q90 277 54 291 Q18 277 17 249 L17 205 Z" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="5" />;
  }
  if (type === 'accessory-lightning') {
    return <path d="M75 209 L42 255 H66 L50 301 L96 243 H72 Z" fill="#fde047" stroke="#fef9c3" strokeLinejoin="round" strokeWidth="4" />;
  }
  if (type === 'accessory-captain-armband') {
    return (
      <g transform="rotate(8 211 199)">
        <rect x="198" y="188" width="27" height="18" rx="4" fill="#facc15" stroke="#fef3c7" strokeWidth="3" />
        <text x="211.5" y="201" fill="#422006" fontSize="12" fontWeight="900" textAnchor="middle">C</text>
      </g>
    );
  }
  if (type === 'accessory-match-ball') {
    return (
      <g transform="translate(23 248)">
        <circle cx="35" cy="35" r="31" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="4" />
        <path d="M35 18 L47 27 L42 42 H27 L22 27 Z" fill="#172554" />
        <path d="M35 18 L31 5 M47 27 L61 23 M42 42 L51 55 M27 42 L17 55 M22 27 L8 23" fill="none" stroke="#7c3aed" strokeWidth="4" />
      </g>
    );
  }
  return null;
}

function Companion({ type }) {
  if (type === 'companion-mind') {
    return (
      <g>
        <circle cx="257" cy="187" r="26" fill="#22d3ee" stroke="#cffafe" strokeWidth="4" />
        <circle cx="249" cy="179" r="7" fill="white" opacity="0.45" />
        <text x="257" y="193" fill="#082f49" fontSize="15" fontWeight="900" textAnchor="middle">M</text>
      </g>
    );
  }
  if (type === 'companion-triad') {
    return (
      <g fontSize="10" fontWeight="900" textAnchor="middle">
        <circle cx="254" cy="155" r="17" fill="#22d3ee" stroke="#cffafe" strokeWidth="3" /><text x="254" y="159" fill="#082f49">M</text>
        <circle cx="272" cy="188" r="17" fill="#fb7185" stroke="#ffe4e6" strokeWidth="3" /><text x="272" y="192" fill="#881337">H</text>
        <circle cx="241" cy="203" r="17" fill="#fbbf24" stroke="#fef3c7" strokeWidth="3" /><text x="241" y="207" fill="#78350f">G</text>
      </g>
    );
  }
  if (type === 'companion-football') {
    return (
      <g transform="translate(228 151)">
        <circle cx="27" cy="27" r="24" fill="#f8fafc" stroke="#a5f3fc" strokeWidth="4" />
        <path d="M27 16 L36 23 L33 34 H21 L18 23 Z" fill="#312e81" />
        <path d="M27 16 L25 5 M36 23 L47 20 M33 34 L40 44 M21 34 L14 44 M18 23 L7 20" fill="none" stroke="#7c3aed" strokeWidth="3" />
      </g>
    );
  }
  return null;
}

function IpAvatar({ avatar = {}, className = '', label = 'Your Inner Performance avatar' }) {
  const idBase = useId().replace(/:/g, '');
  const outfitGradientId = `ip-outfit-${idBase}`;
  const skinGradientId = `ip-skin-${idBase}`;
  const figureShadowId = `ip-shadow-${idBase}`;
  const colors = CORE_COLORS[avatar.coreColor] || CORE_COLORS.violet;
  const skin = SKIN_TONES[avatar.skinTone] || SKIN_TONES['warm-medium'];
  const hairColor = HAIR_COLORS[avatar.hairColor] || HAIR_COLORS.espresso;
  const eyeColor = EYE_COLORS[avatar.eyeColor] || EYE_COLORS['deep-brown'];
  const backdrop = BACKDROPS[avatar.backdrop] || BACKDROPS['backdrop-grid'];
  const pose = avatar.pose || 'ready';
  const outfitStyle = avatar.outfitStyle || 'protocol-jacket';
  const outfitColors = outfitStyle === 'outfit-ip-away-kit'
    ? ['#f8fafc', '#cbd5e1', '#22d3ee']
    : outfitStyle === 'outfit-goalkeeper-kit'
      ? ['#34d399', '#047857', '#fde047']
      : outfitStyle === 'outfit-ip-home-kit'
        ? ['#7c3aed', '#0e7490', '#a5f3fc']
        : colors;
  const varsitySleeve = outfitStyle === 'varsity' ? '#e2e8f0' : `url(#${outfitGradientId})`;
  const pulseAura = avatar.aura === 'aura-pulse';
  const sunriseAura = avatar.aura === 'aura-sunrise';
  const footballBackdrop = ['backdrop-floodlights', 'backdrop-stadium-tunnel'].includes(avatar.backdrop);
  const faceShape = avatar.faceShape || 'oval';
  const facePath = faceShape === 'round'
    ? 'M105 68 Q110 43 154 40 Q199 43 204 68 V125 Q197 157 154 158 Q111 157 104 125 Z'
    : faceShape === 'square'
      ? 'M105 62 L117 46 H191 L204 62 V139 L190 154 H118 L104 139 Z'
      : faceShape === 'heart'
        ? 'M104 63 Q119 43 154 43 Q190 43 205 63 L197 132 Q189 153 154 160 Q119 153 111 132 Z'
        : faceShape === 'angular'
          ? 'M105 62 L118 45 H191 L204 62 L198 132 L177 155 H131 L110 132 Z'
          : 'M106 62 Q118 43 154 43 Q190 43 202 62 L198 132 Q190 157 154 159 Q118 157 110 132 Z';
  const bodyScale = avatar.bodyStyle === 'broad' ? 1.12 : avatar.bodyStyle === 'slim' ? 0.86 : avatar.bodyStyle === 'athletic' ? 1.04 : 0.96;
  const bodyTransform = `translate(153 0) scale(${bodyScale} 1) translate(-153 0)`;

  return (
    <div className={`group relative aspect-[5/6] overflow-hidden rounded-[2rem] bg-gradient-to-br ${backdrop} ${className}`} role="img" aria-label={label}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute -left-12 top-10 h-36 w-36 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="absolute -right-10 bottom-16 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
      <svg viewBox="0 0 300 360" className="relative h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={outfitGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={outfitColors[0]} />
            <stop offset="100%" stopColor={outfitColors[1]} />
          </linearGradient>
          <linearGradient id={skinGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={skin[2]} />
            <stop offset="55%" stopColor={skin[0]} />
            <stop offset="100%" stopColor={skin[1]} />
          </linearGradient>
          <filter id={figureShadowId} x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="12" floodColor="#020617" floodOpacity=".42" stdDeviation="8" />
          </filter>
        </defs>

        <ellipse cx="153" cy="326" rx="100" ry="20" fill="#020617" opacity="0.4" />
        {footballBackdrop ? (
          <g opacity="0.55">
            <path d="M0 260 Q150 215 300 260 V360 H0 Z" fill="#14532d" />
            <path d="M0 292 H300 M150 239 V360" fill="none" stroke="white" strokeWidth="3" opacity="0.45" />
            <circle cx="150" cy="292" r="35" fill="none" stroke="white" strokeWidth="3" opacity="0.45" />
            <path d="M22 42 V184 M278 42 V184" stroke="#94a3b8" strokeWidth="5" />
            <path d="M5 40 H52 M248 40 H295" stroke="#f8fafc" strokeWidth="12" opacity="0.9" />
          </g>
        ) : null}
        <ellipse cx="153" cy="184" rx="118" ry="145" fill="white" opacity="0.025" />
        <ellipse cx="153" cy="181" rx="108" ry="138" fill="none" stroke={sunriseAura ? '#fbbf24' : '#22d3ee'} strokeDasharray={sunriseAura ? '10 9' : pulseAura ? '3 12' : '5 18'} strokeLinecap="round" strokeWidth={pulseAura || sunriseAura ? 7 : 3} opacity={pulseAura || sunriseAura ? 0.82 : 0.24} />
        {pulseAura ? <ellipse cx="153" cy="181" rx="127" ry="155" fill="none" stroke="#67e8f9" strokeWidth="3" opacity="0.3" /> : null}
        {sunriseAura ? <ellipse cx="153" cy="181" rx="127" ry="155" fill="none" stroke="#fb7185" strokeWidth="3" opacity="0.32" /> : null}

        <g className="origin-center transition-transform duration-500 group-hover:-translate-y-1" filter={`url(#${figureShadowId})`}>
          <g transform={bodyTransform}>
            <path d="M108 239 H151 V316 H112 Q104 316 104 307 Z" fill="#172033" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
            <path d="M155 239 H199 L204 307 Q204 316 195 316 H155 Z" fill="#0f172a" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
            <path d="M103 304 H151 V323 Q151 330 142 330 H99 Q91 330 94 320 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
            <path d="M155 304 H204 L212 320 Q215 330 203 330 H164 Q155 330 155 321 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="3" />

            <Arms pose={pose} skin={skin[0]} skinShadow={skin[1]} sleeveFill={varsitySleeve} sleeveSide={outfitStyle === 'varsity' ? '#cbd5e1' : outfitColors[1]} />

            <path d="M105 168 Q105 158 117 158 H191 Q203 158 203 170 L208 246 H99 Z" fill={`url(#${outfitGradientId})`} stroke="rgba(255,255,255,.35)" strokeWidth="3" />
            <path d="M203 170 L217 181 L218 234 L208 246 Z" fill={outfitColors[1]} opacity="0.9" />
            <OutfitDetails style={outfitStyle} accent={outfitColors[1]} highlight={outfitColors[2]} />
          </g>

          <rect x="136" y="142" width="37" height="28" rx="10" fill={`url(#${skinGradientId})`} />
          <circle cx="106" cy="104" r="11" fill={skin[0]} stroke="rgba(255,255,255,.2)" strokeWidth="2" />
          <circle cx="202" cy="104" r="11" fill={skin[1]} stroke="rgba(255,255,255,.16)" strokeWidth="2" />
          <path d={facePath} fill={`url(#${skinGradientId})`} stroke="rgba(255,255,255,.3)" strokeWidth="3" />
          <path d="M190 55 Q207 76 198 132 Q192 149 174 156 Q191 140 192 72 Z" fill={skin[1]} opacity="0.28" />
          <path d="M117 53 Q139 39 175 47 Q142 48 114 73 Z" fill={skin[2]} opacity="0.38" />
          <Hair style={avatar.hairStyle || 'textured-crop'} color={hairColor} />
          <Face expression={avatar.expression || 'focused'} skinShadow={skin[1]} eyeColor={eyeColor} eyebrowStyle={avatar.eyebrowStyle || 'natural'} />
          <FacialHair style={avatar.facialHairStyle || 'none'} color={hairColor} />
          <Glasses style={avatar.glassesStyle || 'none'} />
          <Headwear type={avatar.headwear} />
          <Accessory type={avatar.accessory} />
        </g>

        <Companion type={avatar.companion} />
        <g transform="translate(112 329)">
          <rect width="83" height="21" rx="10.5" fill="rgba(2,6,23,.68)" stroke="rgba(255,255,255,.22)" />
          <text x="41.5" y="14.5" fill="white" fontSize="10" fontWeight="900" letterSpacing="2" textAnchor="middle">IPKP</text>
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}

export default IpAvatar;

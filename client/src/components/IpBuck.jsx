import React from 'react';

export const IP_BUCK_TOKEN_SRC = '/images/rewards/ip-buck-token.webp';

function IpBuck({ amount, compact = false, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black ${compact ? 'text-xs' : 'text-sm'} ${className}`}
      aria-label={`${amount} IP Bucks`}
    >
      <img
        src={IP_BUCK_TOKEN_SRC}
        alt=""
        aria-hidden="true"
        className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(245,158,11,0.32)]`}
      />
      <span aria-hidden="true">{amount}</span>
    </span>
  );
}

export default IpBuck;

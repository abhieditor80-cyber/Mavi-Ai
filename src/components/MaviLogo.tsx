import React, { useId } from 'react';

interface MaviLogoProps {
  size?: number;
  className?: string;
}

export const MaviLogo: React.FC<MaviLogoProps> = ({ size = 34, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const gradA = `maviPrismA-${uid}`;
  const gradB = `maviPrismB-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradA} x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="55%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id={gradB} x1="10" y1="28" x2="30" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="12" fill={`url(#${gradA})`} />
      {/* Faceted geometric M-wing emblem */}
      <path
        d="M11 26.5V14.5C11 13.4 12.25 12.75 13.15 13.4L20 18.4L26.85 13.4C27.75 12.75 29 13.4 29 14.5V26.5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="12" r="2.2" fill={`url(#${gradB})`} />
    </svg>
  );
};

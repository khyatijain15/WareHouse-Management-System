import React from 'react';

interface BlinkingSirenIconProps {
  color?: 'red' | 'blue';
  size?: number;
  className?: string;
}

// SVG colors for red and blue sirens
const SIREN_COLORS = {
  red: {
    dome: '#FF4B4B',
    base: '#A3B8C2',
    star: '#FFE5D0',
  },
  blue: {
    dome: '#3B82F6',
    base: '#A3B8C2',
    star: '#E0F2FE',
  },
};

const BlinkingSirenIcon: React.FC<BlinkingSirenIconProps> = ({ color = 'red', size = 32, className = '' }) => {
  const colors = SIREN_COLORS[color];
  return (
    <span className={`relative inline-block align-middle ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="blinking-siren"
      >
        {/* Dome */}
        <ellipse cx="32" cy="26" rx="22" ry="22" fill={colors.dome} />
        {/* Base */}
        <ellipse cx="32" cy="54" rx="26" ry="8" fill={colors.base} />
        {/* Starburst */}
        <g className="blinking-siren-star">
          <polygon
            points="32,10 36,26 52,20 38,32 52,44 36,38 32,54 28,38 12,44 26,32 12,20 28,26"
            fill={colors.star}
          />
        </g>
      </svg>
      <style jsx>{`
        .blinking-siren-star {
          animation: siren-blink 1s steps(1, end) infinite;
        }
        @keyframes siren-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </span>
  );
};

export default BlinkingSirenIcon; 
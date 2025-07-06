import React, { useMemo } from 'react';

const NUM_PARTICLES = 40;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

const GoldParticlesBackground = () => {
  // Memoize particle properties so they don't change on rerender
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }).map((_, i) => {
      const size = randomBetween(6, 18); // px
      const left = randomBetween(0, 100); // vw
      const delay = randomBetween(0, 6); // s
      const duration = randomBetween(5, 10); // s
      const opacity = randomBetween(0.5, 1);
      return {
        key: i,
        style: {
          width: `${size}px`,
          height: `${size}px`,
          left: `${left}vw`,
          bottom: '-20px',
          opacity,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
        },
      };
    });
  }, []);

  return (
    <div className="gold-particles-bg">
      {particles.map(({ key, style }) => (
        <div key={key} className="gold-particle" style={style} />
      ))}
    </div>
  );
};

export default GoldParticlesBackground; 
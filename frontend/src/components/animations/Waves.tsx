import React, { useEffect, useRef } from 'react';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './Waves.module.css';

interface WavesProps {
  paused?: boolean;
}

interface Wave {
  amplitude: number;
  frequency: number;
  speed: number;
  baseHeight: number;
  offset: number;
}

export const Waves: React.FC<WavesProps> = ({ paused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const { currentTheme } = useThemeContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Define wave properties
    const waves: Wave[] = [
      { amplitude: 20, frequency: 0.004, speed: 0.02, baseHeight: 0.9, offset: 0 },
      { amplitude: 15, frequency: 0.006, speed: 0.015, baseHeight: 0.85, offset: 0 },
      { amplitude: 10, frequency: 0.008, speed: 0.01, baseHeight: 0.8, offset: 0 },
    ];

    // Colors based on theme
    const getWaveColors = () => {
      if (currentTheme === 'Dark') {
        return [
          'rgba(102, 126, 234, 0.1)',
          'rgba(118, 75, 162, 0.08)',
          'rgba(102, 126, 234, 0.06)',
        ];
      }
      return [
        'rgba(102, 126, 234, 0.15)',
        'rgba(118, 75, 162, 0.12)',
        'rgba(102, 126, 234, 0.1)',
      ];
    };

    let time = 0;

    const drawWave = (wave: Wave, color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);

      for (let x = 0; x <= canvas.width; x++) {
        const y = wave.baseHeight * canvas.height + 
                  wave.amplitude * Math.sin(x * wave.frequency + wave.offset);
        
        if (x === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
    };

    const animate = () => {
      if (paused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const colors = getWaveColors();
      waves.forEach((wave, index) => {
        wave.offset = time * wave.speed;
        drawWave(wave, colors[index]);
      });

      time += 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      animate();
    } else {
      // Draw static waves if reduced motion is preferred
      const colors = getWaveColors();
      waves.forEach((wave, index) => {
        drawWave(wave, colors[index]);
      });
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [paused, currentTheme]);

  return <canvas ref={canvasRef} className={styles.wavesCanvas} aria-hidden="true" />;
};

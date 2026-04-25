'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '@/game/GameEngine';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'title' | 'loading' | 'playing'>('title');

  const startGame = useCallback(() => {
    if (gameState !== 'title') return;
    setGameState('loading');

    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (canvasRef.current && !engineRef.current) {
          try {
            const engine = new GameEngine();
            engine.init(canvasRef.current);
            engineRef.current = engine;
            setGameState('playing');
          } catch (err) {
            console.error('Failed to initialize game engine:', err);
            setGameState('title');
          }
        }
      }, 200);
    });
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && gameState === 'title') {
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000' }}>
      {/* Game Canvas - always rendered, visibility controlled by CSS */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && <TitleScreen onStart={startGame} />}

      {/* Loading Screen Overlay */}
      {gameState === 'loading' && <LoadingScreen />}
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setBlink(b => !b), 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at 30% 50%, #0a0a1a 0%, #000000 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: '"Courier New", monospace',
        cursor: 'default',
      }}
      onClick={onStart}
    >
      {/* Animated grid background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `
          linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        animation: 'gridMove 20s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Title */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        userSelect: 'none',
      }}>
        <h1 style={{
          fontSize: 'clamp(48px, 10vw, 120px)',
          fontWeight: 'bold',
          color: '#00ff88',
          textShadow: '0 0 20px #00ff88, 0 0 60px #00ff8844, 0 0 100px #00ff8822',
          letterSpacing: '8px',
          margin: 0,
          lineHeight: 1,
        }}>
          CHROME
        </h1>
        <h1 style={{
          fontSize: 'clamp(48px, 10vw, 120px)',
          fontWeight: 'bold',
          color: '#00ff88',
          textShadow: '0 0 20px #00ff88, 0 0 60px #00ff8844, 0 0 100px #00ff8822',
          letterSpacing: '8px',
          margin: 0,
          lineHeight: 1,
        }}>
          CITY
        </h1>
        <div style={{
          fontSize: 'clamp(24px, 5vw, 60px)',
          color: '#ff6600',
          textShadow: '0 0 15px #ff6600, 0 0 40px #ff660044',
          letterSpacing: '16px',
          marginTop: '10px',
          fontWeight: 'bold',
        }}>
          UNDERGROUND
        </div>
      </div>

      {/* Blinking start prompt */}
      <div style={{
        marginTop: '60px',
        fontSize: 'clamp(14px, 2vw, 22px)',
        color: blink ? '#ffffff' : 'transparent',
        textShadow: blink ? '0 0 10px #ffffff88' : 'none',
        transition: 'color 0.1s',
        letterSpacing: '4px',
        userSelect: 'none',
      }}>
        PRESS ENTER OR CLICK TO START
      </div>

      {/* Controls */}
      <div style={{
        marginTop: '40px',
        color: '#666',
        fontSize: 'clamp(10px, 1.5vw, 13px)',
        textAlign: 'center',
        lineHeight: 2,
        userSelect: 'none',
      }}>
        <div>WASD - Move | Mouse - Look | Shift - Sprint</div>
        <div>E - Enter Vehicle | F - Interact | Space - Jump</div>
        <div>Click - Shoot | R - Reload | 1-5 - Weapons</div>
        <div>V - Toggle View | H - Help</div>
      </div>

      {/* Version */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        color: '#333',
        fontSize: '11px',
        userSelect: 'none',
      }}>
        v0.1 ALPHA
      </div>

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
      `}</style>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      fontFamily: '"Courier New", monospace',
    }}>
      <div style={{
        color: '#00ff88',
        fontSize: '18px',
        textShadow: '0 0 10px #00ff88',
        marginBottom: '20px',
      }}>
        INITIALIZING...
      </div>
      <div style={{
        width: '300px',
        height: '4px',
        background: '#1a1a1a',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, #00ff88, #ff6600)',
          animation: 'loadBar 2s ease-in-out infinite',
        }} />
      </div>
      <div style={{
        color: '#444',
        fontSize: '12px',
        marginTop: '10px',
      }}>
        Generating city...
      </div>

      <style>{`
        @keyframes loadBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

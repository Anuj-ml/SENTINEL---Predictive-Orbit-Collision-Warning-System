import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Crosshair, Menu, Terminal } from 'lucide-react';

import EarthScene from './components/EarthScene';
import { StatusPanel, AlertFeed, ManeuverPanel, AnalyticsPanel } from './components/DashboardComponents';

import { OrbitalObject, Conjunction, Maneuver } from './types';
import { generateMockObjects, checkConjunctions, calculateManeuver } from './services/orbitalPhysics';

const App: React.FC = () => {
  // State
  const [objects, setObjects] = useState<OrbitalObject[]>([]);
  const [time, setTime] = useState<number>(0); // Simulation time
  const [alerts, setAlerts] = useState<Conjunction[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Conjunction | null>(null);
  const [maneuver, setManeuver] = useState<Maneuver | null>(null);
  
  // Initialization
  useEffect(() => {
    // Generate Mock TLE/Object Data
    const objs = generateMockObjects();
    setObjects(objs);
    
    // Initial Risk Assessment
    const initialAlerts = checkConjunctions(objs, 0);
    setAlerts(initialAlerts);
  }, []);

  // Simulation Loop
  useEffect(() => {
    let animationFrame: number;
    const loop = () => {
      setTime(t => t + 10); // Accelerate time (10s per frame)
      animationFrame = requestAnimationFrame(loop);
    };
    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Periodic Risk Re-assessment (Simulating ML Inference Poll)
  useEffect(() => {
    const interval = setInterval(() => {
      const newAlerts = checkConjunctions(objects, time);
      // Only update if significant change to avoid UI flicker
      if (newAlerts.length > 0) {
        setAlerts(prev => {
            // Merge logic simplified for prototype: just replace
            return newAlerts;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [objects, time]);

  const handleGenerateManeuver = () => {
      if (selectedAlert) {
          // Simulate API delay
          setTimeout(() => {
              const plan = calculateManeuver(selectedAlert);
              setManeuver(plan);
          }, 1200);
      }
  };

  const handleSelectAlert = (alert: Conjunction) => {
      setSelectedAlert(alert);
      setManeuver(null); // Reset maneuver when changing selection
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden">
      
      {/* 3D Background Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [18, 0, 10], fov: 45 }}>
          <Suspense fallback={null}>
            <EarthScene objects={objects} time={time} maneuver={maneuver} alerts={alerts} />
            <OrbitControls 
                enablePan={false} 
                enableZoom={true} 
                minDistance={12} 
                maxDistance={40}
                autoRotate={true}
                autoRotateSpeed={0.5}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay Layer */}
      <div className="relative z-10 w-full h-full flex flex-col p-4 pointer-events-none">
        
        {/* Top Bar */}
        <header className="flex justify-between items-center mb-4 pointer-events-auto">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500 rounded flex items-center justify-center">
                    <Crosshair className="text-cyan-400 animate-spin-slow" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] text-white leading-none">SENTINEL</h1>
                    <div className="text-xs text-cyan-600 font-mono tracking-widest">ORBITAL DEFENSE NETWORK</div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right font-mono text-xs text-slate-400 hidden md:block">
                    <div>SIMULATION TIME</div>
                    <div className="text-cyan-400">T+{Math.floor(time)}s</div>
                </div>
                <button className="p-2 border border-slate-700 rounded hover:bg-slate-800 text-slate-300">
                    <Menu size={20} />
                </button>
            </div>
        </header>

        {/* Main Dashboard Grid */}
        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 pointer-events-none">
            
            {/* Left Column - Stats & Alerts */}
            <div className="md:col-span-3 flex flex-col gap-4 pointer-events-auto">
                <div className="h-1/3">
                    <StatusPanel 
                        activeCount={objects.filter(o => o.type === 'SATELLITE').length} 
                        debrisCount={objects.filter(o => o.type === 'DEBRIS').length} 
                    />
                </div>
                <div className="h-2/3">
                    <AlertFeed alerts={alerts} onSelect={handleSelectAlert} />
                </div>
            </div>

            {/* Center - Viewport (Empty mainly to see Earth) */}
            <div className="md:col-span-6 relative">
                {/* Center HUD Elements */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-8 pointer-events-none">
                   <div className="glass-panel px-6 py-2 rounded-full flex items-center gap-4 text-xs font-mono text-cyan-500/80 border-cyan-500/20">
                       <Terminal size={14} />
                       <span>ORBIT PROPAGATION: NOMINAL</span>
                       <span className="w-px h-3 bg-cyan-900"></span>
                       <span>ML INFERENCE: ACTIVE</span>
                   </div>
                </div>
            </div>

            {/* Right Column - Analytics & Maneuver */}
            <div className="md:col-span-3 flex flex-col gap-4 pointer-events-auto">
                 <div className="h-1/3">
                    <AnalyticsPanel />
                </div>
                <div className="h-2/3">
                    <ManeuverPanel 
                        alert={selectedAlert} 
                        maneuver={maneuver} 
                        onGenerate={handleGenerateManeuver} 
                    />
                </div>
            </div>

        </main>
      </div>

      <div className="scan-line"></div>
    </div>
  );
};

export default App;
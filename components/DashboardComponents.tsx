import React from 'react';
import { Activity, AlertTriangle, Crosshair, Shield, Radio, Zap, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Conjunction, RiskLevel, Maneuver } from '../types';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title, icon }) => (
  <div className={`glass-panel rounded-lg p-4 flex flex-col ${className}`}>
    {title && (
        <div className="flex items-center gap-2 mb-3 text-cyan-400 border-b border-cyan-900/50 pb-2">
            {icon}
            <h3 className="font-bold text-sm tracking-widest uppercase font-mono">{title}</h3>
        </div>
    )}
    {children}
  </div>
);

export const StatusPanel = ({ activeCount, debrisCount }: { activeCount: number, debrisCount: number }) => (
    <GlassCard title="System Status" icon={<Activity size={16} />} className="h-full">
        <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-2 bg-slate-900/50 rounded">
                <div className="text-xs text-slate-400 mb-1">ACTIVE ASSETS</div>
                <div className="text-2xl font-mono font-bold text-cyan-400">{activeCount}</div>
            </div>
            <div className="text-center p-2 bg-slate-900/50 rounded">
                <div className="text-xs text-slate-400 mb-1">TRACKED DEBRIS</div>
                <div className="text-2xl font-mono font-bold text-red-400">{debrisCount}</div>
            </div>
        </div>
        <div className="mt-4 space-y-2 text-xs font-mono text-cyan-600">
            <div className="flex justify-between">
                <span>UPLINK</span>
                <span className="text-green-400">ESTABLISHED</span>
            </div>
            <div className="flex justify-between">
                <span>LATENCY</span>
                <span>12ms</span>
            </div>
            <div className="flex justify-between">
                <span>PREDICTION</span>
                <span>+72H WINDOW</span>
            </div>
        </div>
    </GlassCard>
);

export const AlertFeed = ({ alerts, onSelect }: { alerts: Conjunction[], onSelect: (c: Conjunction) => void }) => (
    <GlassCard title="Conjunction Alerts" icon={<AlertTriangle size={16} />} className="h-full">
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {alerts.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-10">No critical conjunctions detected.</div>
            ) : (
                alerts.map((alert) => {
                    // Generate synthetic trend data for the sparkline
                    // Higher risk = more volatile curve ending high
                    const data = [];
                    const base = alert.probability;
                    for(let i=0; i<12; i++) {
                         // Create a somewhat random curve that generally trends towards the current probability
                         const noise = (Math.random() - 0.5) * 0.1;
                         const trend = (i / 12) * base; 
                         const val = Math.max(0, Math.min(1, trend + noise + 0.1));
                         data.push({ val });
                    }

                    // Format Time to Impact
                    const hours = Math.floor(alert.timeToImpact / 3600);
                    const mins = Math.floor((alert.timeToImpact % 3600) / 60);

                    return (
                        <div 
                            key={alert.id} 
                            onClick={() => onSelect(alert)}
                            className={`p-3 rounded border cursor-pointer transition-all hover:translate-x-1 ${
                                alert.riskLevel === RiskLevel.HIGH 
                                ? 'bg-red-950/30 border-red-500/50 hover:bg-red-900/50' 
                                : 'bg-orange-950/30 border-orange-500/50 hover:bg-orange-900/50'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold font-mono text-sm text-slate-200">{alert.objectA} vs {alert.objectB}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    alert.riskLevel === RiskLevel.HIGH ? 'bg-red-600 text-white' : 'bg-orange-500 text-black'
                                }`}>{alert.riskLevel}</span>
                            </div>
                            
                            <div className="flex gap-3 mb-1 h-16">
                                {/* Mini Chart Sparkline */}
                                <div className="w-1/3 bg-slate-900/50 rounded overflow-hidden relative border border-slate-800">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data}>
                                            <defs>
                                                <linearGradient id={`grad-${alert.id}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={alert.riskLevel === RiskLevel.HIGH ? "#ef4444" : "#f97316"} stopOpacity={0.8}/>
                                                    <stop offset="100%" stopColor={alert.riskLevel === RiskLevel.HIGH ? "#ef4444" : "#f97316"} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <Area 
                                                type="monotone" 
                                                dataKey="val" 
                                                stroke={alert.riskLevel === RiskLevel.HIGH ? "#ef4444" : "#f97316"} 
                                                strokeWidth={1.5}
                                                fill={`url(#grad-${alert.id})`} 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Metrics Grid */}
                                <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-slate-400 content-center">
                                    <div>PROBABILITY</div>
                                    <div className="text-right text-white font-bold">{(alert.probability * 100).toFixed(1)}%</div>
                                    
                                    <div>MISS DIST</div>
                                    <div className="text-right text-white">{alert.missDistance.toFixed(1)} km</div>

                                    <div>IMPACT IN</div>
                                    <div className="text-right text-cyan-300 font-bold animate-pulse">T-{hours}h {mins}m</div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    </GlassCard>
);

export const ManeuverPanel = ({ alert, maneuver, onGenerate }: { alert: Conjunction | null, maneuver: Maneuver | null, onGenerate: () => void }) => {
    if (!alert) return (
        <GlassCard title="Autonomous Response" icon={<Shield size={16} />} className="h-full opacity-50">
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm">
                <Shield size={32} className="mb-2 opacity-20" />
                <div>Select an alert to analyze</div>
            </div>
        </GlassCard>
    );

    return (
        <GlassCard title="Autonomous Response" icon={<Shield size={16} />} className="h-full border-cyan-500/50">
            <div className="space-y-4">
                <div className="bg-slate-900/80 p-3 rounded border border-slate-700">
                    <div className="text-xs text-slate-400 uppercase mb-1">Target Asset</div>
                    <div className="font-mono text-lg text-cyan-400 font-bold">{alert.objectA}</div>
                </div>

                {!maneuver ? (
                    <button 
                        onClick={onGenerate}
                        className="w-full py-6 bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 font-bold tracking-widest hover:bg-cyan-500 hover:text-black transition-all rounded uppercase flex flex-col items-center gap-2"
                    >
                        <Zap size={20} />
                        Calculate Avoidance
                    </button>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-3 bg-green-900/20 border border-green-500/30 rounded">
                            <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
                                <Radio size={14} className="animate-pulse" />
                                SOLUTION GENERATED
                            </div>
                            <div className="font-mono text-xs space-y-1 text-slate-300">
                                <div className="flex justify-between border-b border-slate-700/50 pb-1">
                                    <span>THRUST</span>
                                    <span className="text-green-300">{maneuver.thrustN} N</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-700/50 pb-1 pt-1">
                                    <span>DURATION</span>
                                    <span className="text-green-300">{maneuver.duration} s</span>
                                </div>
                                <div className="pt-1">
                                    <span>VECTOR</span>
                                    <div className="text-green-300">[{maneuver.vector.join(', ')}]</div>
                                </div>
                            </div>
                        </div>
                        <button className="w-full py-2 bg-green-600 hover:bg-green-500 text-black font-bold uppercase text-sm rounded">
                            Execute Maneuver
                        </button>
                    </div>
                )}
            </div>
        </GlassCard>
    );
}

const generateChartData = () => {
    const data = [];
    let prob = 0.1;
    for(let i=0; i<20; i++) {
        prob = Math.max(0, Math.min(1, prob + (Math.random() - 0.4) * 0.1));
        data.push({ name: `T+${i}h`, prob: prob });
    }
    return data;
};

export const AnalyticsPanel = () => {
    const data = React.useMemo(() => generateChartData(), []);

    return (
        <GlassCard title="Probability Forecast (72H)" icon={<Database size={16} />} className="h-full">
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis hide domain={[0, 1]} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#0891b2', color: '#fff' }} 
                            itemStyle={{ color: '#22d3ee' }}
                        />
                        <Area type="monotone" dataKey="prob" stroke="#06b6d4" fillOpacity={1} fill="url(#colorProb)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
};
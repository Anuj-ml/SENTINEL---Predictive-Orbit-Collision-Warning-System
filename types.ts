export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalObject {
  id: string;
  name: string;
  type: 'SATELLITE' | 'DEBRIS';
  // Simplified Keplerian elements for propagation
  elements: {
    a: number; // Semi-major axis (km)
    e: number; // Eccentricity
    i: number; // Inclination (rad)
    w: number; // Argument of periapsis (rad)
    O: number; // Longitude of ascending node (rad)
    M0: number; // Mean anomaly at epoch (rad)
    n: number; // Mean motion (rad/s)
  };
  color: string;
}

export interface Conjunction {
  id: string;
  objectA: string;
  objectB: string;
  timeToImpact: number; // seconds
  probability: number; // 0-1
  riskLevel: RiskLevel;
  missDistance: number; // km
}

export interface Maneuver {
  targetId: string;
  thrustN: number;
  vector: [number, number, number];
  duration: number;
  timestamp: string;
}

export interface SystemStatus {
  activeSatellites: number;
  trackedDebris: number;
  systemHealth: number;
  lastScan: string;
}
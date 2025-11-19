import { OrbitalObject, Conjunction, RiskLevel, Vector3, Maneuver } from '../types';

// Constants
const EARTH_RADIUS = 6371; // km

/**
 * SIMULATED BACKEND LOGIC
 * In a real app, this would be Python/FastAPI with skyfield/sgp4.
 * Here we implement a simplified Keplerian propagator for visualization.
 */

// Generate Mock Data
export const generateMockObjects = (): OrbitalObject[] => {
  const objects: OrbitalObject[] = [];

  // 5 Active Satellites (Blue)
  const sats = ['SENTINEL-1', 'NONAME-X', 'EAGLE-EYE', 'COMMS-A', 'COMMS-B'];
  sats.forEach((name, i) => {
    objects.push({
      id: `SAT-${i}`,
      name,
      type: 'SATELLITE',
      color: '#06b6d4', // Cyan
      elements: {
        a: EARTH_RADIUS + 500 + Math.random() * 200,
        e: 0.001 + Math.random() * 0.01,
        i: (Math.random() * Math.PI) / 2,
        w: Math.random() * Math.PI * 2,
        O: Math.random() * Math.PI * 2,
        M0: Math.random() * Math.PI * 2,
        n: 0.0010 + (Math.random() * 0.0001),
      }
    });
  });

  // 20 Debris Objects (Red)
  for (let i = 0; i < 20; i++) {
    objects.push({
      id: `DEB-${Math.floor(Math.random() * 9000) + 1000}`,
      name: `DEBRIS FAGMENT #${i + 1}`,
      type: 'DEBRIS',
      color: '#ef4444', // Red
      elements: {
        a: EARTH_RADIUS + 400 + Math.random() * 1000,
        e: Math.random() * 0.1,
        i: Math.random() * Math.PI, // Random inclination
        w: Math.random() * Math.PI * 2,
        O: Math.random() * Math.PI * 2,
        M0: Math.random() * Math.PI * 2,
        n: 0.0009 + (Math.random() * 0.0003),
      }
    });
  }

  return objects;
};

// Propagate position at time t (seconds since epoch)
export const getPositionAtTime = (obj: OrbitalObject, t: number): Vector3 => {
  const { a, e, i, w, O, M0, n } = obj.elements;
  
  // Mean Anomaly
  const M = M0 + n * t;
  
  // Solve Kepler's Equation for Eccentric Anomaly (E) approx
  let E = M; 
  for(let k=0; k<5; k++) {
    E = M + e * Math.sin(E);
  }

  // True Anomaly (v)
  const v = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  
  // Distance (r)
  const r = a * (1 - e * Math.cos(E));

  // Position in orbital plane
  const x_orb = r * Math.cos(v);
  const y_orb = r * Math.sin(v);

  // Rotate to ECI coordinates
  const x = x_orb * (Math.cos(O) * Math.cos(w + v) - Math.sin(O) * Math.sin(w + v) * Math.cos(i));
  const y = x_orb * (Math.sin(O) * Math.cos(w + v) + Math.cos(O) * Math.sin(w + v) * Math.cos(i));
  const z = x_orb * (Math.sin(i) * Math.sin(w + v));

  // Simplified 3D rotation for demo variance (Keplerian conversion usually more complex)
  // We use a simplified spherical conversion for visual stability in the demo
  const xx = r * (Math.cos(O) * Math.cos(w+v) - Math.sin(O) * Math.sin(w+v) * Math.cos(i));
  const yy = r * (Math.sin(O) * Math.cos(w+v) + Math.cos(O) * Math.sin(w+v) * Math.cos(i));
  const zz = r * (Math.sin(i) * Math.sin(w+v));

  return { x: xx, y: yy, z: zz };
};

// Mock ML Risk Assessment
export const checkConjunctions = (objects: OrbitalObject[], time: number): Conjunction[] => {
  const conjunctions: Conjunction[] = [];
  const sats = objects.filter(o => o.type === 'SATELLITE');
  const debris = objects.filter(o => o.type === 'DEBRIS');

  sats.forEach(sat => {
    const posSat = getPositionAtTime(sat, time);
    
    debris.forEach(deb => {
      const posDeb = getPositionAtTime(deb, time);
      
      // Euclidean distance
      const dist = Math.sqrt(
        Math.pow(posSat.x - posDeb.x, 2) + 
        Math.pow(posSat.y - posDeb.y, 2) + 
        Math.pow(posSat.z - posDeb.z, 2)
      );

      // Thresholds for demo (scaled up for visibility)
      if (dist < 800) {
        // Simulate ML Probability Output (closer = higher prob + noise)
        const baseProb = Math.min(1, 500 / dist);
        // Add "sensor noise"
        const mlProb = Math.min(0.99, baseProb * (0.8 + Math.random() * 0.4));
        
        let risk = RiskLevel.LOW;
        if (mlProb > 0.7) risk = RiskLevel.HIGH;
        else if (mlProb > 0.3) risk = RiskLevel.MEDIUM;

        if (risk !== RiskLevel.LOW) {
            conjunctions.push({
                id: `${sat.id}-${deb.id}-${time}`,
                objectA: sat.name,
                objectB: deb.name,
                timeToImpact: 72 * 60 * 60 * Math.random(), // Random future time in 72h window
                probability: mlProb,
                riskLevel: risk,
                missDistance: dist
            });
        }
      }
    });
  });

  return conjunctions.sort((a, b) => b.probability - a.probability).slice(0, 5);
};

export const calculateManeuver = (conjunction: Conjunction): Maneuver => {
  return {
    targetId: conjunction.objectA,
    thrustN: Number((1.2 + Math.random()).toFixed(2)),
    vector: [
        Number((Math.random() * 2 - 1).toFixed(2)), 
        Number((Math.random() * 2 - 1).toFixed(2)), 
        Number((Math.random() * 2 - 1).toFixed(2))
    ],
    duration: Math.floor(Math.random() * 10) + 5,
    timestamp: new Date().toISOString()
  };
};

// Create a modified orbital object to visualize the maneuver effect
export const getPostManeuverObject = (obj: OrbitalObject, maneuver: Maneuver): OrbitalObject => {
    // Deep copy the object
    const newObj: OrbitalObject = JSON.parse(JSON.stringify(obj));
    
    // Mock physics: modify orbital elements based on the thrust vector
    // This is a visual approximation, not a real impulsive burn propagation
    
    // Perturb Inclination based on Z vector
    newObj.elements.i += maneuver.vector[2] * 0.15; 
    
    // Perturb Semi-major axis (altitude) based on X vector
    newObj.elements.a += maneuver.vector[0] * 300; 
    
    // Perturb RAAN based on Y vector
    newObj.elements.O += maneuver.vector[1] * 0.1;

    // Update ID to prevent key conflicts if rendered
    newObj.id = `${obj.id}-PREDICTED`;
    
    return newObj;
};
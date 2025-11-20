
import numpy as np
import random
from models import OrbitalObject, OrbitalElements, Conjunction, RiskLevel
from typing import List

# Constants
EARTH_RADIUS = 6371  # km

def generate_mock_data() -> List[OrbitalObject]:
    objects = []
    
    # 5 Active Satellites
    sats = ['SENTINEL-1', 'NONAME-X', 'EAGLE-EYE', 'COMMS-A', 'COMMS-B']
    for i, name in enumerate(sats):
        objects.append(OrbitalObject(
            id=f"SAT-{i}",
            name=name,
            type='SATELLITE',
            color='#06b6d4',
            elements=OrbitalElements(
                a=EARTH_RADIUS + 500 + random.random() * 200,
                e=0.001 + random.random() * 0.01,
                i=(random.random() * np.pi) / 2,
                w=random.random() * np.pi * 2,
                O=random.random() * np.pi * 2,
                M0=random.random() * np.pi * 2,
                n=0.0010 + (random.random() * 0.0001)
            )
        ))

    # 20 Debris Objects
    for i in range(20):
        objects.append(OrbitalObject(
            id=f"DEB-{1000 + i}",
            name=f"DEBRIS FRAGMENT #{i + 1}",
            type='DEBRIS',
            color='#ef4444',
            elements=OrbitalElements(
                a=EARTH_RADIUS + 400 + random.random() * 1000,
                e=random.random() * 0.1,
                i=random.random() * np.pi,
                w=random.random() * np.pi * 2,
                O=random.random() * np.pi * 2,
                M0=random.random() * np.pi * 2,
                n=0.0009 + (random.random() * 0.0003)
            )
        ))
    
    return objects

def get_position_at_time(obj: OrbitalObject, t: float) -> np.ndarray:
    """
    Propagates the orbit to time t (seconds) and returns [x, y, z] ECI coordinates.
    """
    el = obj.elements
    
    # Mean Anomaly
    M = el.M0 + el.n * t
    
    # Newton-Raphson for Eccentric Anomaly (E)
    E = M
    for _ in range(5):
        E = M + el.e * np.sin(E)
    
    # True Anomaly (v)
    v = 2 * np.arctan2(np.sqrt(1 + el.e) * np.sin(E / 2), np.sqrt(1 - el.e) * np.cos(E / 2))
    
    # Radius (r)
    r = el.a * (1 - el.e * np.cos(E))
    
    # Position in orbital plane
    # Simplified rotation logic matching the frontend demo for visual consistency
    cosO = np.cos(el.O)
    sinO = np.sin(el.O)
    cosw = np.cos(el.w + v)
    sinw = np.sin(el.w + v)
    cosi = np.cos(el.i)
    sini = np.sin(el.i)

    # To ECI simplified
    x = r * (cosO * cosw - sinO * sinw * cosi)
    y = r * (sinO * cosw + cosO * sinw * cosi)
    z = r * (sini * sinw)
    
    return np.array([x, y, z])

def detect_conjunctions(objects: List[OrbitalObject], time_offset: float) -> List[Conjunction]:
    conjunctions = []
    sats = [o for o in objects if o.type == 'SATELLITE']
    debris = [o for o in objects if o.type == 'DEBRIS']
    
    for sat in sats:
        pos_sat = get_position_at_time(sat, time_offset)
        
        for deb in debris:
            pos_deb = get_position_at_time(deb, time_offset)
            
            # Euclidean distance (km)
            dist = np.linalg.norm(pos_sat - pos_deb)
            
            # Threshold for demo detection (800km to force visuals)
            if dist < 800:
                # Calculate Probability (Mock ML Logic)
                base_prob = min(1.0, 500 / dist)
                ml_prob = min(0.99, base_prob * (0.8 + random.random() * 0.4))
                
                risk = 'LOW'
                if ml_prob > 0.7: risk = 'HIGH'
                elif ml_prob > 0.3: risk = 'MEDIUM'
                
                if risk != 'LOW':
                    conjunctions.append(Conjunction(
                        id=f"{sat.id}-{deb.id}-{time_offset}",
                        objectA=sat.name,
                        objectB=deb.name,
                        timeToImpact=random.random() * 72 * 3600,
                        probability=ml_prob,
                        riskLevel=risk,
                        missDistance=float(dist)
                    ))
                    
    return sorted(conjunctions, key=lambda x: x.probability, reverse=True)[:5]
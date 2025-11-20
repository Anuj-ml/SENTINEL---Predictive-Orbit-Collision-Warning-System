
from pydantic import BaseModel
from typing import List, Literal, Optional

RiskLevel = Literal['LOW', 'MEDIUM', 'HIGH'] 

class OrbitalElements(BaseModel):
    a: float  # Semi-major axis (km)
    e: float  # Eccentricity
    i: float  # Inclination (rad)
    w: float  # Argument of periapsis (rad)
    O: float  # Longitude of ascending node (rad)
    M0: float # Mean anomaly at epoch (rad)
    n: float  # Mean motion (rad/s)

class OrbitalObject(BaseModel):
    id: str
    name: str
    type: Literal['SATELLITE', 'DEBRIS']
    elements: OrbitalElements
    color: str

class Conjunction(BaseModel):
    id: str
    objectA: str
    objectB: str
    timeToImpact: float
    probability: float
    riskLevel: Literal['LOW', 'MEDIUM', 'HIGH']
    missDistance: float

class Maneuver(BaseModel):
    targetId: str
    thrustN: float
    vector: List[float]
    duration: float
    timestamp: str
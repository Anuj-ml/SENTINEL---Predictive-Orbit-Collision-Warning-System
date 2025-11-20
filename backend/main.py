
# To run: uvicorn backend.main:app --reload

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import List
import random

from models import OrbitalObject, Conjunction, Maneuver
from calculations import generate_mock_data, detect_conjunctions

app = FastAPI(title="Sentinel Orbital Backend")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory simulated database
DB_OBJECTS = generate_mock_data()

@app.get("/")
async def root():
    return {"system": "SENTINEL", "status": "ONLINE"}

@app.get("/api/orbit", response_model=List[OrbitalObject])
async def get_orbital_objects():
    """Return all tracked objects and their Keplerian elements."""
    return DB_OBJECTS

@app.get("/api/conjunctions", response_model=List[Conjunction])
async def get_conjunctions(time: float = 0):
    """Calculate collision risks at a specific simulation time."""
    return detect_conjunctions(DB_OBJECTS, time)

@app.post("/api/maneuver", response_model=Maneuver)
async def calculate_avoidance(target_id: str):
    """Trigger the autonomous maneuver engine."""
    return Maneuver(
        targetId=target_id,
        thrustN=round(1.2 + random.random(), 2),
        vector=[
            round(random.uniform(-1, 1), 2),
            round(random.uniform(-1, 1), 2),
            round(random.uniform(-1, 1), 2)
        ],
        duration=random.randint(5, 15),
        timestamp=datetime.utcnow().isoformat()
    )


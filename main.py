from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import sqlite3
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import uvicorn
import os

# Pydantic model for request validation
class TrackerRecord(BaseModel):
    date: str
    eventName: str
    organizer: str
    gifter: str
    coinsOut: int
    coinsIn: int
    net: Optional[int] = None  # Make net optional since we calculate it
    supportTeam: Optional[str] = ""
    conversionNotes: Optional[str] = ""

def init_db():
    with sqlite3.connect("dcgt.db") as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS tracker (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT, eventName TEXT, organizer TEXT, gifter TEXT,
            coinsOut INTEGER, coinsIn INTEGER, net INTEGER,
            supportTeam TEXT, conversionNotes TEXT
        )""")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (if needed)

app = FastAPI(lifespan=lifespan)

@app.post("/submit", status_code=204)
async def submit(data: TrackerRecord):
    try:
        # Calculate net on backend to ensure consistency
        calculated_net = data.coinsIn - data.coinsOut
        
        with sqlite3.connect("dcgt.db") as conn:
            conn.execute("""
            INSERT INTO tracker (date, eventName, organizer, gifter,
                coinsOut, coinsIn, net, supportTeam, conversionNotes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (data.date, data.eventName, data.organizer, data.gifter,
                  data.coinsOut, data.coinsIn, calculated_net, 
                  data.supportTeam or "", data.conversionNotes or ""))
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/records")
async def records() -> List[Dict[str, Any]]:
    try:
        with sqlite3.connect("dcgt.db") as conn:
            cursor = conn.execute("""
                SELECT id, date, eventName, organizer, gifter, coinsOut, coinsIn, net, supportTeam, conversionNotes 
                FROM tracker 
                ORDER BY id DESC
            """)
            rows = [dict(zip([column[0] for column in cursor.description], row)) for row in cursor.fetchall()]
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics")
async def analytics() -> Dict[str, Any]:
    """Get analytics data for dashboard"""
    try:
        with sqlite3.connect("dcgt.db") as conn:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_events,
                    SUM(coinsOut) as total_coins_out,
                    SUM(coinsIn) as total_coins_in,
                    SUM(net) as total_net,
                    AVG(net) as avg_net,
                    MAX(net) as best_net,
                    MIN(net) as worst_net
                FROM tracker
            """)
            stats = dict(zip([column[0] for column in cursor.description], cursor.fetchone()))
            
            # Get top performers
            cursor = conn.execute("""
                SELECT gifter, SUM(net) as total_net, COUNT(*) as events
                FROM tracker 
                GROUP BY gifter 
                ORDER BY total_net DESC 
                LIMIT 5
            """)
            top_gifters = [dict(zip([column[0] for column in cursor.description], row)) for row in cursor.fetchall()]
            
            return {
                "stats": stats,
                "top_gifters": top_gifters
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve the HTML file
@app.get("/")
async def read_index():
    return "Hello world"

# Add CORS middleware if needed for development
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run("index:app", host="0.0.0.0", port=8000, reload=True)
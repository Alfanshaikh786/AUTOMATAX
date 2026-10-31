from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.automata_routes import router as automata_router
from app.api.conversion_routes import router as conversion_router
from app.api.regex_routes import router as regex_router
from app.api.grammar_routes import router as grammar_router
from app.api.operations_routes import router as operations_router
from app.api.simulation_routes import router as simulation_router
from app.api.equivalence_routes import router as equivalence_router
from app.api.debugger_routes import router as debugger_router
from app.api.reports_routes import router as reports_router
from app.api.ai_routes import router as ai_router
from app.api.practice_routes import router as practice_router
from app.services.project_service import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="AutomataX API",
    description="The Intelligent Automata Construction, Conversion & Verification Laboratory API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all modular routers
app.include_router(automata_router)
app.include_router(conversion_router)
app.include_router(regex_router)
app.include_router(grammar_router)
app.include_router(operations_router)
app.include_router(simulation_router)
app.include_router(equivalence_router)
app.include_router(debugger_router)
app.include_router(reports_router)
app.include_router(ai_router)
app.include_router(practice_router)

@app.get("/")
def root():
    return {
        "name": "AutomataX — The Intelligent Automata Construction, Conversion & Verification Laboratory",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount built frontend static files if present (for single-service fullstack deployment)
candidate_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/dist")),
    os.path.abspath(os.path.join(os.getcwd(), "dist")),
    os.path.abspath(os.path.join(os.getcwd(), "frontend/dist")),
]

frontend_dist = None
for d in candidate_dirs:
    if os.path.isfile(os.path.join(d, "index.html")):
        frontend_dist = d
        break

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
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

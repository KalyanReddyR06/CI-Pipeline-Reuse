
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import executions, pipelines


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="CI Pipeline Step Reuse",
    description="API for reusable CI pipeline steps",
    version="0.1.0",
    lifespan=lifespan,
)

# Register API routers
app.include_router(pipelines.router)
app.include_router(executions.router)


@app.get("/")
def root():
    return {"message": "CI Pipeline Reuse API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# Outer CORS middleware handles preflight and error responses.
app = CORSMiddleware(
    app=app,
    allow_origins=[
        "https://kalyanreddyr06.github.io",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

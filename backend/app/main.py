from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.algoritmos.series_deportivas.router import router as series_router
from app.algoritmos.reemplazo_equipos.router import router as replacement_router
from app.algoritmos.problema_mochila.router import router as mochila_router

from app.algoritmos.Mult_matrices.router import router as matrices_router
from app.core.config import get_cors_origins


def create_app() -> FastAPI:
    app = FastAPI(title="IO WEB API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(health_router)
    app.include_router(series_router)
    app.include_router(replacement_router)
    app.include_router(mochila_router)
    app.include_router(matrices_router)
    return app


app = create_app()

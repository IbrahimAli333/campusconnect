from fastapi import APIRouter

from app.api.v1.attendance import router as attendance_router
from app.api.v1.auth import router as auth_router
from app.api.v1.grades import router as grades_router
from app.api.v1.health import router as health_router
from app.api.v1.messages import router as messages_router
from app.api.v1.network import router as network_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.portal import router as portal_router


api_router = APIRouter()
api_router.include_router(attendance_router)
api_router.include_router(auth_router)
api_router.include_router(grades_router)
api_router.include_router(health_router)
api_router.include_router(messages_router)
api_router.include_router(network_router)
api_router.include_router(notifications_router)
api_router.include_router(portal_router)

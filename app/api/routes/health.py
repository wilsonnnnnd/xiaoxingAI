from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


@router.get("/health")
def health():
    return {"status": "ok"}


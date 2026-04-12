from typing import Dict

from fastapi import APIRouter, Depends, HTTPException

from app import db
from app.core import auth as auth_mod
from app.core import config as app_config
from app.core.constants import DEFAULT_PROMPTS, INTERNAL_PROMPTS, INTERNAL_PROMPT_DIRS

router = APIRouter()


def _is_internal_prompt(rel_path: str) -> bool:
    """Return True when the relative path should be treated as internal and hidden."""
    # exact file matches
    if rel_path in INTERNAL_PROMPTS:
        return True
    # directory prefix matches (e.g. 'tools/...')
    for d in INTERNAL_PROMPT_DIRS:
        prefix = d.rstrip("/") + "/"
        if rel_path.startswith(prefix):
            return True
    return False


def _check_prompt_filename(filename: str) -> None:
    """拒绝路径穿越或非 .txt 文件名，允许一级子目录（如 gmail/xxx.txt）"""
    if not filename or filename.strip() != filename:
        raise HTTPException(status_code=400, detail="文件名不合法")
    if ".." in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="文件名不合法")
    if not filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="仅支持 .txt 文件")
    # 防止路径穿越：解析后必须仍在 prompts 目录内
    resolved = (app_config.PROMPTS_DIR / filename).resolve()
    if not str(resolved).startswith(str(app_config.PROMPTS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="文件名不合法")


@router.get("/prompts")
def prompts_list(user: dict = Depends(auth_mod.current_user)):
    """列出所有可用 Prompt 文件：磁盘内置 + 用户在 DB 中创建的自定义文件。"""
    disk_files = sorted(
        rel
        for p in app_config.PROMPTS_DIR.rglob("*.txt")
        if p.is_file()
        for rel in [str(p.relative_to(app_config.PROMPTS_DIR)).replace("\\", "/")]
        if not _is_internal_prompt(rel)
    )
    user_names = db.list_user_prompt_names(user["id"])
    disk_set = set(disk_files)
    extra = [n for n in user_names if n not in disk_set]
    all_files = sorted(disk_set | set(extra))
    return {
        "files": all_files,
        "defaults": sorted(DEFAULT_PROMPTS),
        "custom": sorted(user_names),
    }


@router.get("/prompts/{filename:path}")
def prompt_get(filename: str, user: dict = Depends(auth_mod.current_user)):
    """读取 Prompt：优先返回用户专属（DB），无则回退到磁盘默认文件。"""
    _check_prompt_filename(filename)
    override = db.get_user_prompt(user["id"], filename)
    if override is not None:
        return {"filename": filename, "content": override, "is_custom": True}
    path = app_config.PROMPTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} 不存在")
    return {"filename": filename, "content": path.read_text(encoding="utf-8"), "is_custom": False}


@router.post("/prompts/{filename:path}")
def prompt_save(filename: str, payload: Dict[str, str], user: dict = Depends(auth_mod.current_user)):
    """保存用户专属 Prompt 到 DB（不修改磁盘文件）。"""
    _check_prompt_filename(filename)
    content = payload.get("content")
    if content is None:
        raise HTTPException(status_code=422, detail="缺少 content 字段")
    db.save_user_prompt(user["id"], filename, content)
    return {"ok": True, "filename": filename}


@router.delete("/prompts/{filename:path}")
def prompt_delete(filename: str, user: dict = Depends(auth_mod.current_user)):
    """删除用户专属 Prompt：默认文件则清除覆盖（恢复默认），自定义文件则彻底删除。"""
    _check_prompt_filename(filename)
    deleted = db.delete_user_prompt(user["id"], filename)
    if not deleted:
        detail = "该文件没有个人修改记录" if filename in DEFAULT_PROMPTS else f"{filename} 不存在"
        raise HTTPException(status_code=404, detail=detail)
    return {"ok": True, "filename": filename}


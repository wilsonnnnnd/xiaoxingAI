import json
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

# 需要 modify 权限才能标记已读
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# 文件路径（放在项目根目录，不提交到 git）
_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CREDENTIALS_FILE = _ROOT / "credentials.json"  # 从 Google Cloud Console 下载


def _verifier_path(user_id: Optional[int] = None) -> Path:
    """PKCE verifier 临时文件路径（每个 user_id 独立）"""
    suffix = f"_{user_id}" if user_id is not None else ""
    return _ROOT / f".oauth_code_verifier{suffix}"


def _load_token(user_id: Optional[int] = None) -> Optional[Credentials]:
    from app.db import load_token_json
    raw = load_token_json(user_id)
    if not raw:
        return None
    return Credentials.from_authorized_user_info(json.loads(raw), SCOPES)


def _save_token(creds: Credentials, user_id: Optional[int] = None) -> None:
    from app.db import save_token_json
    save_token_json(creds.to_json(), user_id)


def get_credentials(user_id: Optional[int] = None) -> Credentials:
    """
    返回有效的 Credentials。
    - 若 token.json 存在且有效，直接返回
    - 若 token 过期但有 refresh_token，自动刷新
    - 否则抛出异常，需先完成 OAuth 授权
    """
    creds = _load_token(user_id)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds, user_id)
        return creds

    uid_hint = f" (user_id={user_id})" if user_id else ""
    raise RuntimeError(
        f"未找到有效授权{uid_hint}，请先访问 /gmail/auth 完成 Google OAuth 授权"
    )


def get_oauth_url(redirect_uri: str, user_id: Optional[int] = None) -> str:
    """生成 Google OAuth 授权 URL，并将 PKCE code_verifier 临时保存。
    user_id 通过 OAuth state 参数传递，供 callback 恢复，无需依赖已登录 JWT。
    """
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"缺少 credentials.json，请从 Google Cloud Console 下载并放到：{CREDENTIALS_FILE}"
        )

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    # 将 user_id 编码到 state，callback 中解析以正确保存 token
    state = str(user_id) if user_id is not None else ""
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=state,
    )

    vpath = _verifier_path(user_id)
    if getattr(flow, "code_verifier", None):
        vpath.write_text(flow.code_verifier, encoding="utf-8")
    elif vpath.exists():
        vpath.unlink()

    return auth_url


def exchange_code_for_token(code: str, redirect_uri: str,
                             user_id: Optional[int] = None) -> Credentials:
    """用授权码换取 token 并保存到数据库"""
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    vpath = _verifier_path(user_id)
    if vpath.exists():
        flow.code_verifier = vpath.read_text(encoding="utf-8")
        vpath.unlink()

    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token(creds, user_id)
    return creds

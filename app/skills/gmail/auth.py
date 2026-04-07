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
CREDENTIALS_FILE    = _ROOT / "credentials.json"       # 从 Google Cloud Console 下载
_CODE_VERIFIER_FILE = _ROOT / ".oauth_code_verifier"   # PKCE verifier 临时文件


def _load_token() -> Optional[Credentials]:
    from app.db import load_token_json
    raw = load_token_json()
    if not raw:
        return None
    return Credentials.from_authorized_user_info(json.loads(raw), SCOPES)


def _save_token(creds: Credentials) -> None:
    from app.db import save_token_json
    save_token_json(creds.to_json())


def get_credentials() -> Credentials:
    """
    返回有效的 Credentials。
    - 若 token.json 存在且有效，直接返回
    - 若 token 过期但有 refresh_token，自动刷新
    - 否则抛出异常，需先完成 OAuth 授权
    """
    creds = _load_token()

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds)
        return creds

    raise RuntimeError(
        "未找到有效授权，请先访问 /gmail/auth 完成 Google OAuth 授权"
    )


def get_oauth_url(redirect_uri: str) -> str:
    """生成 Google OAuth 授权 URL，并将 PKCE code_verifier 临时保存"""
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"缺少 credentials.json，请从 Google Cloud Console 下载并放到：{CREDENTIALS_FILE}"
        )

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent"
    )

    # 若 library 自动生成了 PKCE code_verifier，保存供回调使用
    if getattr(flow, "code_verifier", None):
        _CODE_VERIFIER_FILE.write_text(flow.code_verifier, encoding="utf-8")
    elif _CODE_VERIFIER_FILE.exists():
        _CODE_VERIFIER_FILE.unlink()

    return auth_url


def exchange_code_for_token(code: str, redirect_uri: str) -> Credentials:
    """用授权码换取 token 并保存到数据库"""
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

    # 恢复 PKCE code_verifier（若存在），防止 invalid_grant: Missing code verifier
    if _CODE_VERIFIER_FILE.exists():
        flow.code_verifier = _CODE_VERIFIER_FILE.read_text(encoding="utf-8")
        _CODE_VERIFIER_FILE.unlink()

    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token(creds)
    return creds

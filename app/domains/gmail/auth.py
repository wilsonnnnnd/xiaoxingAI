import json
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from app.core import config as app_config
from app.utils.oauth_state import encode_oauth_state

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]

_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CREDENTIALS_FILE = _ROOT / "credentials.json"


def _verifier_path(user_id: Optional[int] = None) -> Path:
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
    creds = _load_token(user_id)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds, user_id)
        return creds

    uid_hint = f" (user_id={user_id})" if user_id else ""
    raise RuntimeError(
        f"No valid credentials found{uid_hint}, please visit /api/gmail/auth to complete Google OAuth authorization"
    )


def get_oauth_url(redirect_uri: str, user_id: Optional[int] = None) -> str:
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"Missing credentials.json, please download from the Google Cloud Console and place it in {CREDENTIALS_FILE}"
        )

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    state = (
        encode_oauth_state(user_id=int(user_id), secret=app_config.JWT_SECRET)
        if user_id is not None
        else ""
    )
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


def exchange_code_for_token(
    code: str,
    redirect_uri: str,
    user_id: Optional[int] = None,
) -> Credentials:
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )

    vpath = _verifier_path(user_id)
    if vpath.exists():
        flow.code_verifier = vpath.read_text(encoding="utf-8")
        vpath.unlink()

    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token(creds, user_id)
    return creds


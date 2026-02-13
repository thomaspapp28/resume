"""
Fetch all jobs from Greenhouse using the Harvest API v3.
Supports OAuth 2.0 Client Credentials or legacy API key (transition period).
"""

import os
import re
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

# Harvest API
HARVEST_JOBS_URL = "https://harvest.greenhouse.io/v3/jobs"
HARVEST_JOB_POSTS_URL = "https://harvest.greenhouse.io/v3/job_posts"
OAUTH_TOKEN_URL = "https://auth.greenhouse.io/token"
LEGACY_TOKEN_URL = "https://harvest.greenhouse.io/auth/token"


def _get_oauth_token() -> str:
    """Get Bearer token via OAuth 2.0 Client Credentials."""
    client_id = os.getenv("GREENHOUSE_CLIENT_ID")
    client_secret = os.getenv("GREENHOUSE_CLIENT_SECRET")
    user_id = os.getenv("GREENHOUSE_USER_ID", "")

    if not client_id or not client_secret:
        raise ValueError(
            "Set GREENHOUSE_CLIENT_ID and GREENHOUSE_CLIENT_SECRET in .env. "
            "Create Harvest v3 OAuth credentials in Greenhouse → API Credentials."
        )

    resp = requests.post(
        OAUTH_TOKEN_URL,
        auth=(client_id, client_secret),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "sub": user_id},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _get_legacy_token() -> str:
    """Get Bearer token using legacy Harvest API key (transition period)."""
    api_key = os.getenv("GREENHOUSE_API_KEY")
    if not api_key:
        raise ValueError("GREENHOUSE_API_KEY not set in .env")
    resp = requests.post(
        LEGACY_TOKEN_URL,
        auth=(api_key, ""),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_greenhouse_token() -> str:
    """
    Get a Bearer token for the Harvest API.
    Prefers OAuth (GREENHOUSE_CLIENT_ID/SECRET); falls back to GREENHOUSE_API_KEY if set.
    """
    if os.getenv("GREENHOUSE_CLIENT_ID") and os.getenv("GREENHOUSE_CLIENT_SECRET"):
        return _get_oauth_token()
    if os.getenv("GREENHOUSE_API_KEY"):
        return _get_legacy_token()
    raise ValueError(
        "No Greenhouse credentials in .env. Set either:\n"
        "  - GREENHOUSE_CLIENT_ID + GREENHOUSE_CLIENT_SECRET (and optionally GREENHOUSE_USER_ID), or\n"
        "  - GREENHOUSE_API_KEY (legacy Harvest key)."
    )


def _parse_next_url(link_header: str | None) -> str | None:
    """Parse the 'next' URL from a RFC 5988 Link header."""
    if not link_header:
        return None
    match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
    return match.group(1) if match else None


def fetch_all_jobs(
    *,
    per_page: int = 100,
    status: str | None = None,
    job_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch all jobs from Greenhouse Harvest API v3 with cursor-based pagination.

    Args:
        per_page: Number of jobs per page (1–500). Default 100.
        status: Optional filter: 'open', 'closed', or 'draft'.
        job_id: Optional filter: single job ID.

    Returns:
        List of job objects from the API.

    Requires in .env:
        - OAuth: GREENHOUSE_CLIENT_ID, GREENHOUSE_CLIENT_SECRET;
          optionally GREENHOUSE_USER_ID (numeric user id; Site Admin for list access).
        - Or legacy: GREENHOUSE_API_KEY.
    """
    if per_page < 1 or per_page > 500:
        raise ValueError("per_page must be between 1 and 500")

    token = get_greenhouse_token()
    headers = {"Authorization": f"Bearer {token}"}
    params: dict[str, str | int] = {"per_page": per_page}
    if status:
        params["status"] = status
    if job_id is not None:
        params["job_id"] = job_id

    return _fetch_list_paginated(HARVEST_JOBS_URL, headers, params)


def _fetch_list_paginated(
    url: str,
    headers: dict[str, str],
    params: dict[str, str | int],
) -> list[dict[str, Any]]:
    """Paginate through a Harvest v3 list endpoint; returns combined list."""
    all_items: list[dict[str, Any]] = []
    next_url = requests.Request("GET", url, params=params).prepare().url
    assert next_url is not None

    while next_url:
        resp = requests.get(next_url, headers=headers, timeout=30)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            raise RuntimeError(
                f"Rate limited. Retry after {retry_after}s. "
                "Consider lowering request frequency or per_page."
            )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            all_items.extend(data)
        else:
            all_items.append(data)
        next_url = _parse_next_url(resp.headers.get("Link"))

    return all_items


def fetch_all_job_posts(
    *,
    per_page: int = 100,
    job_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch all job posts from Greenhouse Harvest API v3 (cursor-based pagination).
    Job posts contain the published content (title, description, location, etc.) per board.

    Args:
        per_page: Number of posts per page (1–500). Default 100.
        job_id: Optional filter by job ID (only posts for this job).

    Returns:
        List of job post objects from the API.
    """
    if per_page < 1 or per_page > 500:
        raise ValueError("per_page must be between 1 and 500")

    token = get_greenhouse_token()
    headers = {"Authorization": f"Bearer {token}"}
    params: dict[str, str | int] = {"per_page": per_page}
    if job_id is not None:
        params["job_id"] = job_id

    return _fetch_list_paginated(HARVEST_JOB_POSTS_URL, headers, params)


def _content_to_plain_text(content: Any) -> str:
    """Convert job post content (string or rich-text blocks) to plain text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text") or block.get("content") or ""
                if isinstance(text, str):
                    parts.append(text)
                elif isinstance(text, list):
                    for t in text:
                        if isinstance(t, dict) and "text" in t:
                            parts.append(str(t["text"]))
                        else:
                            parts.append(str(t))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts).strip()
    return str(content).strip()


def fetch_all_job_descriptions(
    *,
    per_page: int = 100,
    job_id: int | None = None,
    include_metadata: bool = True,
) -> list[dict[str, Any]]:
    """
    Fetch all job descriptions from Greenhouse by loading all job posts.

    Each returned item includes the job description (content) as plain text,
    plus job post metadata (job_id, title, location, etc.) when include_metadata is True.

    Args:
        per_page: Number of job posts per page (1–500). Default 100.
        job_id: Optional filter by job ID.
        include_metadata: If True (default), include full post fields; if False, only id, job_id, title, content.

    Returns:
        List of dicts with at least: id, job_id, title, content (plain-text description).
        If include_metadata is True, full job post objects with a 'content_plain' field added.
    """
    posts = fetch_all_job_posts(per_page=per_page, job_id=job_id)
    result: list[dict[str, Any]] = []

    for post in posts:
        raw_content = post.get("content")
        plain = _content_to_plain_text(raw_content)
        if include_metadata:
            item = {**post, "content_plain": plain}
        else:
            item = {
                "id": post.get("id"),
                "job_id": post.get("job_id"),
                "title": post.get("title"),
                "content": plain,
            }
        result.append(item)

    return result


def _has_greenhouse_credentials() -> bool:
    """Return True if .env has Greenhouse credentials configured."""
    return bool(
        (os.getenv("GREENHOUSE_CLIENT_ID") and os.getenv("GREENHOUSE_CLIENT_SECRET"))
        or os.getenv("GREENHOUSE_API_KEY")
    )


if __name__ == "__main__":
    import sys
    if not _has_greenhouse_credentials():
        print(
            "Greenhouse credentials not set. Add to .env:\n"
            "  - GREENHOUSE_CLIENT_ID + GREENHOUSE_CLIENT_SECRET, or\n"
            "  - GREENHOUSE_API_KEY (legacy Harvest key)\n"
            "Then run again to fetch jobs or job descriptions."
        )
        sys.exit(0)
    if "descriptions" in sys.argv or "posts" in sys.argv:
        descriptions = fetch_all_job_descriptions(per_page=100, include_metadata=False)
        print(f"Fetched {len(descriptions)} job description(s).")
        for d in descriptions[:5]:
            title = d.get("title", "")
            content_preview = (d.get("content") or "")[:120].replace("\n", " ")
            print(f"  - job_id={d.get('job_id')}: {title!r} … {content_preview!r}…")
    else:
        jobs = fetch_all_jobs(per_page=100)
        print(f"Fetched {len(jobs)} job(s).")
        for j in jobs[:5]:
            print(f"  - {j.get('id')}: {j.get('name', '')}")

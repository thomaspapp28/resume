"""Jobright.ai job fetcher — sync version.

API base URL, pagination, and delays from config (.env / config.py):
  JOBRIGHT_BASE_URL, JOBRIGHT_MAX_COUNT, JOBRIGHT_MAX_POSITION,
  JOBRIGHT_DELAY_BETWEEN_REQUESTS, JOBRIGHT_DELAY_ON_ERROR,
  JOBRIGHT_SOURCE, JOBRIGHT_MARKET.

Auth: Cookie-based (JOBRIGHT_COOKIE in .env).
Loop: position 0 to (MAX_POSITION - 1) step MAX_COUNT.
Upserts into the jobs table, skipping duplicates by jobright_id.
"""

import hashlib
import logging
import time
from typing import Callable, Optional

import httpx
from sqlalchemy.orm import Session

from app.core import config
from app.models.job import Job, JobFetchLog, STATUS_NEW

logger = logging.getLogger(__name__)

# Optional callback for sending logs to admin UI: callback(message, level)
_log_callback: Optional[Callable[[str, str], None]] = None


def set_log_callback(callback: Optional[Callable[[str, str], None]]) -> None:
    """Set callback for admin UI logging: callback(message, level)."""
    global _log_callback
    _log_callback = callback


def _admin_log(message: str, level: str = "info") -> None:
    if _log_callback:
        try:
            _log_callback(message, level)
        except Exception:
            pass


def _build_headers(cookie: str) -> dict:
    return {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cookie": cookie,
        "referer": "https://jobright.ai/jobs",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }


def _build_params(position: int, since_ts: Optional[int] = None) -> dict:
    params = {
        "refresh": "true" if position == 0 else "false",
        "sortCondition": "1",
        "position": str(position),
        "count": str(config.JOBRIGHT_MAX_COUNT),
        "syncRerank": "false",
    }
    if since_ts is not None and config.JOBRIGHT_SINCE_PARAM:
        params[config.JOBRIGHT_SINCE_PARAM] = str(since_ts)
    return params


def _first(d: dict, *keys: str, default: str = "") -> str:
    """Return first non-empty string value from d for the given keys."""
    if not isinstance(d, dict):
        return default
    for k in keys:
        v = d.get(k)
        if v is None:
            continue
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, (int, float)) and str(v).strip():
            return str(v).strip()
    return default


def _location_str(obj) -> str:
    """Turn location object or string into a single string (e.g. city, state, country)."""
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    if isinstance(obj, dict):
        name = obj.get("name") or obj.get("displayName") or ""
        if name and str(name).strip():
            return str(name).strip()
        parts = [
            obj.get("city") or obj.get("location") or obj.get("cityName"),
            obj.get("state") or obj.get("stateCode") or obj.get("region"),
            obj.get("country") or obj.get("countryCode"),
        ]
        return ", ".join(str(p).strip() for p in parts if p and str(p).strip())
    return ""


def _salary_str(obj, job_data: dict) -> str:
    """Turn salary object or string into a display string."""
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    if isinstance(obj, dict):
        lo = obj.get("min") or obj.get("salaryMin") or obj.get("low")
        hi = obj.get("max") or obj.get("salaryMax") or obj.get("high")
        if lo is not None and hi is not None:
            return f"{lo} - {hi}"
        if lo is not None:
            return str(lo)
        if hi is not None:
            return str(hi)
        return _first(obj, "range", "display", "text", default="")
    # Fallback keys from job_data
    return _first(job_data, "salary", "salaryRange", "salaryDisplay", "payRange", "compensation", default="")


def _posted_date_str(obj) -> str:
    """Normalize posted date to a string (YYYY-MM-DD or ISO slice)."""
    if isinstance(obj, str) and obj.strip():
        s = obj.strip()
        if len(s) >= 10:
            return s[:10]
        return s
    if hasattr(obj, "isoformat"):
        return obj.isoformat()[:10]
    return ""


def _job_type_str(obj, job_data: dict) -> str:
    """Job type / location type: Remote, Hybrid, On-site, Full-time, etc."""
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    if isinstance(obj, dict):
        return _first(obj, "type", "name", "label", "workStyle", "locationType", default="")
    # Bool remote
    remote = job_data.get("remote") if isinstance(job_data, dict) else None
    if remote is True:
        return "Remote"
    if remote is False:
        return "On-site"
    return _first(
        job_data, "jobType", "type", "workStyle", "locationType", "employmentType", "workplaceType", default=""
    )


def _parse_job(item: dict, source: str, market: str, index: int = 0) -> dict:
    """Extract all available fields from a Jobright API job item.
    Swan API uses jobResult (job) and companyResult (company) on each list item.
    Prefers actual job/apply URL; falls back to Jobright detail URL.
    """
    empty = {
        "jobright_id": "", "title": "", "company": "", "location": "", "description": "",
        "url": "", "salary": "", "job_type": "", "posted_date": "", "source": source, "market": market,
    }
    if not isinstance(item, dict):
        return empty
    job_data = item.get("job") or item.get("jobResult") or item
    if not isinstance(job_data, dict):
        job_data = item
    company_result = item.get("companyResult") if isinstance(item.get("companyResult"), dict) else {}
    # Nested detail (some APIs put full description in jobDetail)
    job_detail = job_data.get("jobDetail") or job_data.get("detail") or {}
    if not isinstance(job_detail, dict):
        job_detail = {}

    # ID
    raw_id = (
        item.get("id") or item.get("jobId") or item.get("impId") or item.get("job_id") or item.get("_id")
        or job_data.get("id") or job_data.get("jobId") or job_data.get("job_id") or job_data.get("_id")
    )
    jobright_id = str(raw_id).strip() if raw_id is not None else ""

    # Title
    title = _first(job_data, "title", "jobTitle", "name") or _first(item, "title", "jobTitle")

    # Company
    company = (
        _first(job_data, "companyName", "company")
        or _first(company_result, "name", "companyName", "title")
        or (_first((job_data.get("company") or {}), "name", "companyName") if isinstance(job_data.get("company"), dict) else "")
    )

    # Actual job URL (external apply link) first; then Jobright detail URL as fallback
    url = _first(
        job_data,
        "applyUrl", "applyLink", "externalUrl", "sourceUrl", "externalLink", "applicationUrl",
        "jobUrl", "url", "link", "detailUrl", "jobLink", "canonicalUrl",
    ) or _first(
        item,
        "applyUrl", "applyLink", "externalUrl", "sourceUrl", "jobUrl", "url", "link", "detailUrl", "jobLink",
    ) or _first(job_detail, "applyUrl", "url", "jobUrl", "link")
    url = (url or "").strip()
    if not url and jobright_id and not jobright_id.startswith("gen_"):
        url = f"https://jobright.ai/jobs/info/{jobright_id}"

    # Location (string or object)
    location = (
        _location_str(job_data.get("location") or job_data.get("jobLocation"))
        or _first(job_data, "city", "workLocation", "locationName", "address")
        or _location_str(job_data.get("address"))
        or _location_str(item.get("location")) or _first(item, "city", "locationName")
        or _location_str(company_result.get("location")) or _first(company_result, "city", "address")
    )

    # Description (full job description). If missing, build from summary + coreResponsibilities + skillSummaries.
    description = (
        _first(
            job_data,
            "description", "jobDescription", "desc", "content", "fullDescription", "summary", "requirements",
        )
        or _first(
            job_detail,
            "description", "jobDescription", "content", "fullDescription", "summary", "requirements",
        )
        or _first(item, "description", "jobDescription", "content")
    )
    if not description:
        jd_parts: list[str] = []
        summary = job_data.get("jobSummary") or job_data.get("summary")
        if isinstance(summary, str) and summary.strip():
            jd_parts.append(summary.strip())
        for field in ("coreResponsibilities", "skillSummaries", "responsibilities", "requirements"):
            val = job_data.get(field)
            if isinstance(val, list):
                for line in val:
                    if isinstance(line, str) and line.strip():
                        jd_parts.append(line.strip())
        if jd_parts:
            description = "\n".join(jd_parts)

    # Salary
    salary_raw = job_data.get("salary") or job_data.get("salaryRange") or job_data.get("salaryInfo")
    salary = _salary_str(salary_raw, job_data) if salary_raw else _first(job_data, "salaryRange", "payRange", "compensation", "salaryDisplay")

    # Job type / location type (Remote, Hybrid, On-site, Full-time, etc.)
    job_type_raw = job_data.get("jobType") or job_data.get("employmentType") or job_data.get("workStyle")
    job_type = _job_type_str(job_type_raw, job_data)

    # Posted date
    posted_date = _posted_date_str(
        job_data.get("postedDate") or job_data.get("createDate") or job_data.get("publishedAt")
        or job_data.get("postDate") or job_data.get("datePosted") or job_data.get("createdAt")
        or job_data.get("posting_date") or item.get("postedDate") or item.get("createDate")
    )

    out = {
        "jobright_id": jobright_id or "",
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "url": url,
        "salary": salary,
        "job_type": job_type,
        "posted_date": posted_date,
        "source": source,
        "market": market,
    }
    if not out["jobright_id"]:
        desc_snippet = (description or "")[:150]
        unique = f"{item.get('impId')}|{item.get('pos')}|{index}"
        raw = f"{out['title']}|{out['company']}|{out['url']}|{desc_snippet}|{unique}"
        out["jobright_id"] = "gen_" + hashlib.md5(raw.encode("utf-8")).hexdigest()[:20]
    return out


def _upsert_jobs(db: Session, parsed_jobs: list[dict]) -> dict:
    """Insert new jobs, update existing ones. Returns counts.
    Dedupes within batch so same jobright_id in one page doesn't cause UNIQUE error.
    """
    counts = {"new": 0, "updated": 0, "duplicate": 0}
    added_in_batch: set[str] = set()  # jids we've already added this batch (not yet flushed)

    for data in parsed_jobs:
        jid = data["jobright_id"]
        if not jid:
            continue

        existing = db.query(Job).filter(Job.jobright_id == jid).first()
        if existing:
            changed = False
            for field in ("title", "company", "location", "description", "url",
                          "salary", "job_type", "posted_date"):
                new_val = data.get(field, "")
                if new_val and new_val != getattr(existing, field, ""):
                    setattr(existing, field, new_val)
                    changed = True
            if changed:
                counts["updated"] += 1
            else:
                counts["duplicate"] += 1
        elif jid in added_in_batch:
            # Same page returned same job twice; skip second insert
            counts["duplicate"] += 1
        else:
            job = Job(
                jobright_id=jid,
                title=data["title"],
                company=data["company"],
                location=data["location"],
                description=data["description"],
                url=data["url"],
                salary=data["salary"],
                job_type=data["job_type"],
                posted_date=data["posted_date"],
                source=data["source"],
                market=data["market"],
                status=STATUS_NEW,
            )
            db.add(job)
            added_in_batch.add(jid)
            counts["new"] += 1

    db.flush()
    return counts


def _extract_job_list(data: dict) -> list | None:
    """Get job list from API response. Tries result.jobList, result.jobs, result.list, data.*, top-level."""
    if not data or not isinstance(data, dict):
        return None
    # result.* (result already checked in fetch_page for jobList/jobs/list; try again for consistency)
    result = data.get("result")
    if isinstance(result, dict):
        for key in ("jobList", "jobs", "list", "items"):
            val = result.get(key)
            if isinstance(val, list):
                return val
    # data.*
    inner = data.get("data")
    if isinstance(inner, dict):
        for key in ("jobList", "jobs", "list", "items"):
            val = inner.get(key)
            if isinstance(val, list):
                return val
    if isinstance(inner, list):
        return inner
    # top-level
    for key in ("jobList", "jobs", "list", "items"):
        val = data.get(key)
        if isinstance(val, list):
            return val
    return None


def fetch_page(client: httpx.Client, position: int, cookie: str, since_ts: Optional[int] = None) -> list[dict] | None:
    """
    Fetch a single page from Jobright API.
    Returns list of job items, empty list for empty/error page, None on auth failure.
    """
    try:
        response = client.get(
            config.JOBRIGHT_BASE_URL,
            params=_build_params(position, since_ts),
            headers=_build_headers(cookie),
            timeout=30.0,
        )
        if response.status_code == 200:
            data = response.json()
            for key, value in data.items():
                print(key, value)

            # Response can be a top-level array (e.g. [] or list of jobs)
            if isinstance(data, list):
                if position == 0:
                    logger.info("[Jobright] DEBUG position=0 response is list len=%s", len(data))
                    if len(data) == 0:
                        logger.warning(
                            "[Jobright] First page returned empty list []. "
                            "Check JOBRIGHT_COOKIE (valid session?) and JOBRIGHT_BASE_URL. "
                            "In browser DevTools → Network, find the request that loads jobs and copy its full URL."
                        )
                logger.info("[Jobright] position=%s → %s jobs", position, len(data))
                return data

            # Diagnostic: on first page log response shape when it's a dict
            if position == 0 and isinstance(data, dict):
                top_keys = list(data.keys())[:20]
                result = data.get("result")
                result_keys = list(result.keys())[:20] if isinstance(result, dict) else None
                logger.info(
                    "[Jobright] DEBUG position=0 response: data.keys=%s result.keys=%s success=%s",
                    top_keys, result_keys, data.get("success"),
                )
                if isinstance(result, dict):
                    for k in ("jobList", "jobs", "list", "items", "data"):
                        v = result.get(k)
                        if isinstance(v, list):
                            logger.info("[Jobright] DEBUG result.%s is list len=%s", k, len(v))
                            break

            # Primary path: canonical Jobright shape { success, result: { jobList } }
            if isinstance(data, dict) and data.get("success") and data.get("result"):
                result = data["result"]
                if isinstance(result, dict):
                    job_list = result.get("jobList", result.get("jobs", result.get("list", [])))
                    if isinstance(job_list, list):
                        logger.info("[Jobright] position=%s → %s jobs", position, len(job_list))
                        return job_list
            # Fallback: other response shapes
            job_list = _extract_job_list(data)
            if job_list is not None:
                logger.info("[Jobright] position=%s → %s jobs", position, len(job_list))
                return job_list
            logger.warning(
                "[Jobright] position=%s → API returned success=false or empty result (check DEBUG log above for response shape)",
                position,
            )
            return []

        if response.status_code == 401:
            logger.error("[Jobright] 401 Unauthorized — JOBRIGHT_COOKIE may be expired")
            return None  # Signal to stop fetching

        if response.status_code == 429:
            logger.warning(
                "[Jobright] 429 Rate Limited at position=%s. Sleeping %ss",
                position, config.JOBRIGHT_DELAY_ON_ERROR * 3,
            )
            time.sleep(config.JOBRIGHT_DELAY_ON_ERROR * 3)
            return []

        try:
            body = response.text[:500] if response.text else ""
        except Exception:
            body = ""
        logger.warning(
            "[Jobright] position=%s -> HTTP %s %s",
            position, response.status_code, body,
        )
        return []

    except httpx.TimeoutException:
        logger.warning("[Jobright] Timeout at position=%s", position)
        return []
    except Exception as e:
        logger.error("[Jobright] Error at position=%s: %s", position, e)
        return []


def run_jobright_fetch(db: Session) -> dict:
    """
    Main entry point for Jobright job fetching.

    Loops position 0 to (MAX_POSITION - 1) step MAX_COUNT, calling the Jobright API.
    Parses and ingests each job into the database.

    Returns stats dict with counts.
    """
    cookie = config.JOBRIGHT_COOKIE()
    if not cookie:
        logger.error("[Jobright] JOBRIGHT_COOKIE is not set in .env")
        _admin_log("[jobright] ERROR: JOBRIGHT_COOKIE is not set", "error")
        return {"error": "JOBRIGHT_COOKIE not configured"}

    started_at = time.time()
    stats = {
        "source": config.JOBRIGHT_SOURCE,
        "market": config.JOBRIGHT_MARKET,
        "jobs_found": 0,
        "jobs_new": 0,
        "jobs_updated": 0,
        "jobs_duplicate": 0,
        "pages_fetched": 0,
        "stopped_early": False,
        "error_message": None,
    }

    # Last fetch time: used to request only jobs since then if API supports JOBRIGHT_SINCE_PARAM
    last_log = db.query(JobFetchLog).order_by(JobFetchLog.created_at.desc()).first()
    since_ts = None
    if last_log and last_log.created_at and config.JOBRIGHT_SINCE_PARAM:
        since_ts = int(last_log.created_at.timestamp())
        logger.info("[Jobright] Fetching jobs since last run: %s (ts=%s)", last_log.created_at.isoformat(), since_ts)

    max_pos = config.JOBRIGHT_MAX_POSITION
    step = config.JOBRIGHT_MAX_COUNT
    logger.info(
        "[Jobright] Starting fetch — positions 0 until empty page (max position %s), step %s",
        max_pos, step,
    )
    _admin_log("[jobright] Starting fetch (all pages until empty)...")

    with httpx.Client() as client:
        position = 0
        while position < max_pos:
            page_num = position // step + 1
            job_list = fetch_page(client, position, cookie, since_ts)

            # None = auth failure → stop
            if job_list is None:
                stats["stopped_early"] = True
                stats["error_message"] = "Auth failure (401) — check JOBRIGHT_COOKIE"
                logger.error("[Jobright] 401 Unauthorized — JOBRIGHT_COOKIE may be expired")
                _admin_log("[jobright] 401 Auth error - cookie expired?", "error")
                break

            # Empty page → reached end of results
            if not job_list:
                logger.info("[Jobright] Empty page at position=%s, stopping early", position)
                _admin_log(f"[jobright] Page {page_num}: empty, stopping")
                stats["stopped_early"] = True
                break

            stats["pages_fetched"] += 1
            stats["jobs_found"] += len(job_list)

            parsed = [
                _parse_job(item, config.JOBRIGHT_SOURCE, config.JOBRIGHT_MARKET, index=i)
                for i, item in enumerate(job_list)
            ]
            # If API returned no IDs, we use generated ids (gen_...) so jobs still get stored
            if parsed and page_num == 1 and parsed[0].get("jobright_id", "").startswith("gen_"):
                logger.info(
                    "[Jobright] API did not return job ids; using generated ids so jobs are saved to DB."
                )

            page_counts = _upsert_jobs(db, parsed)
            stats["jobs_new"] += page_counts["new"]
            stats["jobs_updated"] += page_counts["updated"]
            stats["jobs_duplicate"] += page_counts["duplicate"]

            try:
                logger.info(
                    "[Job fetch] Saving to database: page %s — %s new, %s updated, %s duplicate",
                    stats["pages_fetched"], page_counts["new"], page_counts["updated"], page_counts["duplicate"],
                )
                db.commit()
            except Exception as e:
                db.rollback()
                logger.exception("[Job fetch] Failed to commit page to database: %s", e)
                raise

            new_count = page_counts["new"]
            updated_count = page_counts["updated"]
            logger.info(
                "[Jobright] position=%s done | new=%s updated=%s dup=%s",
                position, new_count, updated_count, page_counts["duplicate"],
            )
            _admin_log(
                f"[jobright] Page {page_num}: {len(job_list)} jobs (new={new_count}, updated={updated_count})"
            )

            position += step
            time.sleep(config.JOBRIGHT_DELAY_BETWEEN)

    stats["duration_seconds"] = round(time.time() - started_at, 2)

    # Write fetch log to DB
    log = JobFetchLog(
        source=stats["source"],
        jobs_found=stats["jobs_found"],
        jobs_new=stats["jobs_new"],
        jobs_updated=stats["jobs_updated"],
        jobs_duplicate=stats["jobs_duplicate"],
        duration_seconds=int(stats["duration_seconds"]),
        error_message=stats.get("error_message") or "",
    )
    db.add(log)
    try:
        logger.info("[Job fetch] Saving fetch log to database.")
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("[Jobright] Failed to write fetch log: %s", e)
        stats["error_message"] = (stats.get("error_message") or "") + f"; commit error: {e}"

    logger.info(
        "[Jobright] Fetch complete — found=%s new=%s updated=%s duration=%ss",
        stats["jobs_found"], stats["jobs_new"], stats["jobs_updated"], stats["duration_seconds"],
    )
    _admin_log(
        f"[jobright] Complete: {stats['jobs_found']} found, {stats['jobs_new']} new, "
        f"{stats['jobs_updated']} updated in {stats['duration_seconds']}s"
    )
    return stats

"""Resume JSON schema and conversion utilities."""

from __future__ import annotations

import json
import re
from typing import Any


def json_to_text(data: dict) -> str:
    """Convert resume JSON to plain text format for AI prompt."""
    lines = []
    lines.append(data.get("name", "").strip())
    lines.append(data.get("subtitle", "").strip())
    lines.append("")
    contact = data.get("contact", {}) or {}
    email = contact.get("email", "")
    phone = contact.get("phone", "")
    location = contact.get("location", "")
    lines.append(f"{email}\t{phone}\t{location}".strip())
    lines.append("")

    summary = (data.get("summary") or "").strip()
    skills = data.get("skills") or []

    section = (data.get("section_heading") or "SUMMARY").upper()
    if summary or skills:
        lines.append(section)
        if summary:
            lines.append(summary)
        for sk in skills:
            if isinstance(sk, dict):
                cat = sk.get("category", "").strip()
                items = sk.get("items", "").strip()
                if cat and items:
                    lines.append(f"{cat}: {items}")
                elif items:
                    lines.append(items)
            elif isinstance(sk, str) and sk.strip():
                lines.append(sk.strip())
        lines.append("")

    work = data.get("work_experience") or []
    if work:
        lines.append("WORK EXPERIENCE")
        for w in work:
            jt = (w.get("job_title") or "").strip()
            co = (w.get("company") or "").strip()
            title_line = f"{jt} – {co}" if (jt and co) else (jt or co)
            if title_line:
                lines.append(title_line)
            period = (w.get("period_from") or "").strip()
            period_to = (w.get("period_to") or "Present").strip()
            loc = (w.get("location") or "").strip()
            if period or period_to or loc:
                lines.append(f"{period} – {period_to}\t{loc}".strip())
            desc = (w.get("description") or "").strip()
            if desc:
                lines.append(desc)
            for b in w.get("bullets") or []:
                bullet = (b if isinstance(b, str) else str(b)).strip()
                if bullet:
                    lines.append(f"- {bullet}")
        lines.append("")

    edu = data.get("education") or []
    if edu:
        lines.append("EDUCATION")
        for e in edu:
            inst = (e.get("institution") or "").strip()
            deg = (e.get("degree") or "").strip()
            if inst and deg:
                lines.append(f"{inst} – {deg}")
            elif inst or deg:
                lines.append(inst or deg)
            period = (e.get("period_from") or "").strip()
            period_to = (e.get("period_to") or "").strip()
            loc = (e.get("location") or "").strip()
            if period or period_to or loc:
                lines.append(f"{period} – {period_to}\t{loc}".strip())
        lines.append("")

    certs = data.get("certifications") or []
    if certs:
        lines.append("CERTIFICATIONS")
        for c in certs:
            if isinstance(c, dict):
                n = (c.get("name") or "").strip()
                i = (c.get("issuer") or "").strip()
                if n or i:
                    lines.append(f"- {n}\t{i}".strip())
            elif isinstance(c, str) and c.strip():
                lines.append(f"- {c.strip()}")
        lines.append("")

    return "\n".join(lines).rstrip()


def text_to_json(text: str) -> dict:
    """Parse resume plain text into JSON. Handles canonical format."""
    lines = [ln for ln in text.split("\n")]
    data: dict[str, Any] = {
        "name": "",
        "subtitle": "",
        "contact": {"email": "", "phone": "", "location": ""},
        "summary": "",
        "skills": [],
        "section_heading": "SUMMARY",
        "work_experience": [],
        "education": [],
        "certifications": [],
    }

    def split_contact(ln: str) -> tuple[str, str, str]:
        parts = re.split(r"\t+|  +", ln.strip())
        parts = [p.strip() for p in parts if p.strip()]
        return (
            parts[0] if parts else "",
            parts[1] if len(parts) > 1 else "",
            parts[2] if len(parts) > 2 else "",
        )

    def split_date_loc(ln: str) -> tuple[str, str]:
        parts = re.split(r"\t+|  +", ln.strip(), maxsplit=1)
        period = (parts[0].strip() if parts else "").replace(" – ", " – ")
        loc = parts[1].strip() if len(parts) > 1 else ""
        return period, loc

    i = 0
    if i < len(lines):
        data["name"] = lines[i].strip()
        i += 1
    if i < len(lines):
        data["subtitle"] = lines[i].strip()
        i += 1
    i += 1  # blank
    if i < len(lines) and lines[i].strip():
        e, p, l = split_contact(lines[i])
        data["contact"] = {"email": e, "phone": p, "location": l}
        i += 1
    i += 1  # blank

    headers = (
        "PROFILE", "SUMMARY", "SKILLS", "WORK EXPERIENCE", "EXPERIENCE",
        "PROFESSIONAL EXPERIENCE", "EDUCATION", "CERTIFICATIONS",
    )
    current_section = ""
    summary_done = False
    work_buf: dict[str, Any] | None = None
    edu_buf: dict[str, Any] | None = None

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue

        su = s.upper()
        if su in headers or (s.isupper() and len(s) > 2 and s.isalpha()):
            current_section = su
            if su in ("WORK EXPERIENCE", "EXPERIENCE", "PROFESSIONAL EXPERIENCE"):
                current_section = "WORK EXPERIENCE"
            elif su in ("PROFILE", "SUMMARY"):
                data["section_heading"] = "SUMMARY"
            i += 1
            continue

        if current_section in ("PROFILE", "SUMMARY", "SKILLS"):
            if current_section in ("PROFILE", "SUMMARY") and not summary_done:
                if ": " in s and s.upper() not in headers:
                    data["skills"].append(s)
                else:
                    data["summary"] = s
                    summary_done = True
            elif ": " in s and s.upper() not in headers:
                idx = s.index(": ")
                data["skills"].append({"category": s[: idx + 1].rstrip(":"), "items": s[idx + 2 :].strip()})
            elif s and not s.startswith(("-", "•")):
                if not data["summary"]:
                    data["summary"] = s
                    summary_done = True
                else:
                    data["skills"].append(s)
            i += 1
            continue

        if current_section == "WORK EXPERIENCE":
            if "–" in s or " - " in s:
                if any(x in s for x in ["Present", "202", "201", "200", "Remote", "FL", "CA", "USA"]):
                    period, loc = split_date_loc(s)
                    if not s.startswith("-") and period:
                        if work_buf and "job_title" in work_buf:
                            work_buf["period_from"], work_buf["period_to"] = period.split(" – ", 1) if " – " in period else (period, "Present")
                            work_buf["location"] = loc
                            work_buf = None
                        i += 1
                        if i < len(lines) and lines[i].strip() and not lines[i].strip().startswith("-"):
                            if work_buf is None:
                                work_buf = {"job_title": "", "company": "", "period_from": "", "period_to": "Present", "location": "", "description": "", "bullets": []}
                            work_buf["description"] = lines[i].strip()
                            data["work_experience"].append(work_buf)
                            work_buf = None
                            i += 1
                        continue
            next_s = lines[i + 1].strip() if i + 1 < len(lines) else ""
            if next_s and ("–" in s or " - " in s) and any(x in next_s for x in ["Present", "202", "Remote", "FL", "CA", "USA"]):
                parts = re.split(r"\s*[–-]\s*", s, maxsplit=1)
                jt = parts[0].strip() if parts else ""
                co = parts[1].strip() if len(parts) > 1 else ""
                work_buf = {"job_title": jt, "company": co, "period_from": "", "period_to": "Present", "location": "", "description": "", "bullets": []}
                i += 1
                if i < len(lines):
                    period, loc = split_date_loc(lines[i])
                    if " – " in period:
                        pf, pt = period.split(" – ", 1)
                        work_buf["period_from"] = pf.strip()
                        work_buf["period_to"] = pt.strip()
                    else:
                        work_buf["period_from"] = period
                    work_buf["location"] = loc
                    i += 1
                if i < len(lines) and lines[i].strip() and not lines[i].strip().startswith("-"):
                    work_buf["description"] = lines[i].strip()
                    i += 1
                data["work_experience"].append(work_buf)
                work_buf = None
                continue
            if s.startswith("-") or s.startswith("•"):
                bullet = s.lstrip("-• \t")
                if data["work_experience"]:
                    data["work_experience"][-1].setdefault("bullets", []).append(bullet)
                i += 1
                continue

        if current_section == "EDUCATION":
            if "–" in s or " - " in s:
                parts = re.split(r"\s*[–-]\s*", s, maxsplit=1)
                inst = parts[0].strip() if parts else ""
                deg = parts[1].strip() if len(parts) > 1 else ""
                edu_buf = {"institution": inst, "degree": deg, "period_from": "", "period_to": "", "location": ""}
                i += 1
                if i < len(lines) and lines[i].strip():
                    period, loc = split_date_loc(lines[i])
                    if " – " in period:
                        pf, pt = period.split(" – ", 1)
                        edu_buf["period_from"] = pf.strip()
                        edu_buf["period_to"] = pt.strip()
                    else:
                        edu_buf["period_from"] = period
                    edu_buf["location"] = loc
                    i += 1
                data["education"].append(edu_buf)
                continue
            i += 1
            continue

        if current_section == "CERTIFICATIONS":
            if s.startswith("-") or s.startswith("•"):
                content = s.lstrip("-• \t")
                sub = re.split(r"\t|  +", content, maxsplit=1)
                data["certifications"].append({"name": sub[0].strip() if sub else "", "issuer": sub[1].strip() if len(sub) > 1 else ""})
            i += 1
            continue

        i += 1

    return data


def json_to_lines(data: dict) -> list[str]:
    """Convert resume JSON to lines array (same as text.split('\\n')). For DOCX builder."""
    return json_to_text(data).split("\n")

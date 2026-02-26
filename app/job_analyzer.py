"""Analyze job description: remote?, clearance?"""

import re
from dataclasses import dataclass


@dataclass
class JobAnalysis:
    is_remote: bool
    requires_clearance: bool
    is_eligible: bool


REMOTE_PATTERNS = re.compile(
    r"\b(remote|work from home|work remotely|distributed team|anywhere in the world|"
    r"fully remote|remote first|remote-first|work from anywhere)\b",
    re.IGNORECASE,
)

CLEARANCE_PATTERNS = re.compile(
    r"\b(security clearance|secret clearance|top secret|TS/SCI|TS-SCI|"
    r"clearance required|must have clearance|active clearance|DOD clearance)\b",
    re.IGNORECASE,
)


def analyze_job(job_description: str) -> JobAnalysis:
    is_remote = bool(REMOTE_PATTERNS.search(job_description))
    requires_clearance = bool(CLEARANCE_PATTERNS.search(job_description))
    is_eligible = is_remote and not requires_clearance
    return JobAnalysis(
        is_remote=is_remote,
        requires_clearance=requires_clearance,
        is_eligible=is_eligible,
    )

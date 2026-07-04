"""Curated list of Azerbaijani universities and their email domains.

The canonical names must stay in sync with src/lib/universities.ts on the
frontend — filters compare profile.university against these exact strings.
Domains are used to derive the university from a Google SSO email; subdomains
(e.g. student.bsu.edu.az) match their parent domain.
"""

from __future__ import annotations


AZERBAIJAN_UNIVERSITIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Baku State University", ("bsu.edu.az",)),
    ("ADA University", ("ada.edu.az",)),
    ("Azerbaijan State University of Economics", ("unec.edu.az",)),
    ("Azerbaijan Technical University", ("aztu.edu.az",)),
    ("Azerbaijan State Oil and Industry University", ("asoiu.edu.az",)),
    ("Baku Higher Oil School", ("bhos.edu.az",)),
    ("Khazar University", ("khazar.org",)),
    ("Baku Engineering University", ("beu.edu.az",)),
    ("Azerbaijan Medical University", ("amu.edu.az",)),
    ("Azerbaijan University of Languages", ("adu.edu.az",)),
    ("Azerbaijan State Pedagogical University", ("adpu.edu.az",)),
    ("Azerbaijan University of Architecture and Construction", ("azmiu.edu.az",)),
    ("French-Azerbaijani University", ("ufaz.az",)),
    ("Azerbaijan State Agrarian University", ("adau.edu.az",)),
    ("National Aviation Academy", ("naa.edu.az",)),
    ("Nakhchivan State University", ("ndu.edu.az",)),
    ("Ganja State University", ("gdu.edu.az",)),
    ("Sumgait State University", ("sdu.edu.az",)),
    ("Lankaran State University", ("lsu.edu.az",)),
    ("Western Caspian University", ("wcu.edu.az",)),
)


UNIVERSITY_NAMES: tuple[str, ...] = tuple(name for name, _ in AZERBAIJAN_UNIVERSITIES)


def university_for_email(email: str) -> str | None:
    """Map a university email address to its canonical university name."""
    _, _, domain = email.strip().lower().rpartition("@")
    if not domain:
        return None
    for name, domains in AZERBAIJAN_UNIVERSITIES:
        for known in domains:
            if domain == known or domain.endswith(f".{known}"):
                return name
    return None

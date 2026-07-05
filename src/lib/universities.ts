// Curated list of Azerbaijani universities. Canonical names must stay in sync
// with backend/app/core/universities.py — SSO-created profiles store these
// exact strings, and the university filters compare against them.

export interface UniversityInfo {
  name: string;
  short: string;
}

export const AZ_UNIVERSITIES: UniversityInfo[] = [
  { name: "Baku State University", short: "BSU" },
  { name: "ADA University", short: "ADA" },
  { name: "Azerbaijan State University of Economics", short: "UNEC" },
  { name: "Azerbaijan Technical University", short: "AzTU" },
  { name: "Azerbaijan State Oil and Industry University", short: "ASOIU" },
  { name: "Baku Higher Oil School", short: "BHOS" },
  { name: "Khazar University", short: "Khazar" },
  { name: "Baku Engineering University", short: "BEU" },
  { name: "Azerbaijan Medical University", short: "AMU" },
  { name: "Azerbaijan University of Languages", short: "AUL" },
  { name: "Azerbaijan State Pedagogical University", short: "ADPU" },
  { name: "Azerbaijan University of Architecture and Construction", short: "AzMIU" },
  { name: "French-Azerbaijani University", short: "UFAZ" },
  { name: "Azerbaijan State Agrarian University", short: "ADAU" },
  { name: "National Aviation Academy", short: "NAA" },
  { name: "Nakhchivan State University", short: "NDU" },
  { name: "Ganja State University", short: "GDU" },
  { name: "Sumgait State University", short: "SDU" },
  { name: "Lankaran State University", short: "LSU" },
  { name: "Western Caspian University", short: "WCU" },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

// Free-text profile values may embed the university inside a longer string
// ("Baku State University - Faculty of ..."), so containment counts as a match.
export function universityKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalize(value);
  if (!normalized) {
    return null;
  }

  for (const university of AZ_UNIVERSITIES) {
    const name = normalize(university.name);
    if (normalized === name || normalized.includes(name) || normalized === normalize(university.short)) {
      return university.name;
    }
  }

  return value.trim();
}

export interface UniversityFilterOption {
  value: string;
  label: string;
}

export function universityFilterOptions(
  values: Array<string | null | undefined>,
): UniversityFilterOption[] {
  const present = new Set<string>();
  for (const value of values) {
    const key = universityKey(value);
    if (key) {
      present.add(key);
    }
  }

  const curated: UniversityFilterOption[] = [];
  for (const university of AZ_UNIVERSITIES) {
    if (present.delete(university.name)) {
      curated.push({ value: university.name, label: university.short });
    }
  }

  const others = [...present]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value.length > 28 ? `${value.slice(0, 27)}…` : value }));

  return [...curated, ...others];
}

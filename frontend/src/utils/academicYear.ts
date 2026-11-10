/**
 * Academic Year Utilities
 * Automatically calculates dynamic rolling academic years (e.g., 2025-26, 2026-27, 2027-28)
 * based on the current calendar date and academic cycle (June - May).
 */

export const getCurrentAcademicYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 5 = June
  const startYear = month >= 5 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(2);
  return `${startYear}-${endYearShort}`;
};

export const getAcademicYearOptions = (pastYears = 2, futureYears = 4): string[] => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth();
  const baseStartYear = month >= 5 ? currentYear : currentYear - 1;

  const options: string[] = [];
  const startFrom = baseStartYear - pastYears;
  const endAt = baseStartYear + futureYears;

  for (let y = startFrom; y <= endAt; y++) {
    const endYearShort = String(y + 1).slice(2);
    options.push(`${y}-${endYearShort}`);
  }

  return options;
};

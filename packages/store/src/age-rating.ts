export interface CertificationInfo {
  certification: string;
  meaning: string;
  order: number;
}

export const KIDS_ALLOWED_CERTIFICATIONS: Record<string, string[]> = {
  US: ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'],
  GB: ['U', 'PG', 'TV-Y', 'TV-G'],
  DE: ['0', '6', 'FSK 0', 'FSK 6'],
  JP: ['G', 'G rating'],
  AU: ['G', 'PG', 'P', 'C'],
  CA: ['G', 'PG', 'Exempt'],
  FR: ['TP', 'Tous publics'],
  IT: ['T', 'NR'],
  ES: ['A', 'TP'],
  BR: ['L', '10'],
  IN: ['U', 'U/A 7+'],
  KR: ['All', 'Exempt'],
};

export function buildKidsFilterParams(): string {
  return '&certification_country=US&certification.lte=PG&include_adult=false';
}

export function isContentAppropriateForKids(
  certification: string | undefined,
  country: string = 'US'
): boolean {
  if (!certification) return true;

  const allowed = KIDS_ALLOWED_CERTIFICATIONS[country] || KIDS_ALLOWED_CERTIFICATIONS.US;
  const normalizedCert = certification.toUpperCase().trim();

  return allowed.some(
    (allowedCert) => normalizedCert === allowedCert.toUpperCase()
  );
}

export function getCertificationOrder(
  certification: string,
  country: string = 'US'
): number {
  const certs = KIDS_ALLOWED_CERTIFICATIONS[country];
  if (!certs) return 0;

  const index = certs.findIndex(
    (c) => c.toUpperCase() === certification.toUpperCase()
  );
  return index >= 0 ? index : 999;
}

export function getKidsFilterForCountry(country: string): string {
  const allowed = KIDS_ALLOWED_CERTIFICATIONS[country] || KIDS_ALLOWED_CERTIFICATIONS.US;
  const primaryCert = allowed[0] || 'G';
  return `&certification_country=${country}&certification.lte=${primaryCert}&include_adult=false`;
}

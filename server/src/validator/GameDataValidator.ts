import { GameData, TeamCode } from '@beastleague/shared';

const VALID_STATUSES = ['scheduled', 'live', 'finished', 'cancelled', 'postponed'];

const VALID_TEAM_CODES: TeamCode[] = [
  'KT', 'LG', 'SSG', 'NC', 'KIA',
  '두산', '롯데', '삼성', '한화', '키움',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateGameData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['데이터가 객체가 아님'] };
  }

  if (typeof data['gameId'] !== 'string' || data['gameId'].trim() === '') {
    errors.push('gameId: string 필수');
  }

  if (typeof data['date'] !== 'string' || !DATE_RE.test(data['date'])) {
    errors.push('date: YYYY-MM-DD 형식 필수');
  }

  if (!VALID_TEAM_CODES.includes(data['homeTeam'] as TeamCode)) {
    errors.push(`homeTeam: 유효하지 않은 TeamCode (${String(data['homeTeam'])})`);
  }

  if (!VALID_TEAM_CODES.includes(data['awayTeam'] as TeamCode)) {
    errors.push(`awayTeam: 유효하지 않은 TeamCode (${String(data['awayTeam'])})`);
  }

  if (!VALID_STATUSES.includes(data['status'] as string)) {
    errors.push(`status: 유효하지 않은 값 (${String(data['status'])})`);
  }

  // batterRecords 검증 (선택)
  if (data['batterRecords'] !== undefined) {
    if (!isObject(data['batterRecords'])) {
      errors.push('batterRecords: 객체 필수');
    } else {
      const br = data['batterRecords'] as Record<string, unknown>;
      if (!Array.isArray(br['away'])) {
        errors.push('batterRecords.away: 배열 필수');
      }
      if (!Array.isArray(br['home'])) {
        errors.push('batterRecords.home: 배열 필수');
      }
    }
  }

  // events 검증 (선택)
  if (data['events'] !== undefined && !Array.isArray(data['events'])) {
    errors.push('events: 배열 필수');
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeGameData(data: unknown): GameData | null {
  const { valid } = validateGameData(data);
  if (!valid) return null;
  return data as GameData;
}

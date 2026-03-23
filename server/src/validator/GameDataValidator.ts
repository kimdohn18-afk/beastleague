import {
  GameData,
  GameStatus,
  TeamCode,
  BatterGroupType,
} from '@beastleague/shared';

const VALID_STATUSES: GameStatus[] = [
  'scheduled', 'live', 'finished', 'cancelled', 'postponed',
];

const VALID_TEAM_CODES: TeamCode[] = [
  '광주', '대구', '서울L', '서울D', '수원', '인천', '대전', '부산', '창원', '서울K',
];

const VALID_GROUP_TYPES: BatterGroupType[] = [
  'leadoff', 'cleanup', 'lower', 'starter_pitcher',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BATTER_STAT_KEYS = ['AB', 'H', '2B', '3B', 'HR', 'RBI', 'RUN', 'SB', 'BB', 'K'] as const;
const PITCHER_STAT_KEYS = ['IP', 'PITCH', 'H', 'K', 'BB', 'ER'] as const;

// ── 타입 가드 ──────────────────────────────────────────────
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── 공개 API ───────────────────────────────────────────────

export function validateGameData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['데이터가 객체가 아님'] };
  }

  // gameId
  if (typeof data['gameId'] !== 'string' || data['gameId'].trim() === '') {
    errors.push('gameId: string 필수');
  }

  // date
  if (typeof data['date'] !== 'string' || !DATE_RE.test(data['date'])) {
    errors.push('date: YYYY-MM-DD 형식 필수');
  }

  // homeTeam / awayTeam
  if (!VALID_TEAM_CODES.includes(data['homeTeam'] as TeamCode)) {
    errors.push(`homeTeam: 유효하지 않은 TeamCode (${String(data['homeTeam'])})`);
  }
  if (!VALID_TEAM_CODES.includes(data['awayTeam'] as TeamCode)) {
    errors.push(`awayTeam: 유효하지 않은 TeamCode (${String(data['awayTeam'])})`);
  }

  // status
  if (!VALID_STATUSES.includes(data['status'] as GameStatus)) {
    errors.push(`status: 유효하지 않은 값 (${String(data['status'])})`);
  }

  // batterGroups
  // scheduled/postponed/cancelled 경기는 빈 배열 허용
  const allowEmptyGroups = ['scheduled', 'postponed', 'cancelled'].includes(
    data['status'] as string
  );
  if (!Array.isArray(data['batterGroups']) || (!allowEmptyGroups && data['batterGroups'].length === 0)) {
    errors.push('batterGroups: 비어있지 않은 배열 필수 (경기 종료/진행 중 상태)');
  } else {
    (data['batterGroups'] as unknown[]).forEach((g, i) => {
      if (!isObject(g)) {
        errors.push(`batterGroups[${i}]: 객체가 아님`);
        return;
      }

      if (!VALID_TEAM_CODES.includes(g['team'] as TeamCode)) {
        errors.push(`batterGroups[${i}].team: 유효하지 않은 TeamCode`);
      }
      if (!VALID_GROUP_TYPES.includes(g['groupType'] as BatterGroupType)) {
        errors.push(`batterGroups[${i}].groupType: 유효하지 않은 값 (${String(g['groupType'])})`);
      }

      if (!isObject(g['stats'])) {
        errors.push(`batterGroups[${i}].stats: 객체 필수`);
      } else {
        const stats = g['stats'] as Record<string, unknown>;
        for (const key of BATTER_STAT_KEYS) {
          if (typeof stats[key] !== 'number' || (stats[key] as number) < 0) {
            errors.push(`batterGroups[${i}].stats.${key}: 0 이상 number 필수`);
          }
        }

        // 논리 검증: H >= 2B + 3B + HR
        const H = (stats['H'] as number) ?? 0;
        const doubles = (stats['2B'] as number) ?? 0;
        const triples = (stats['3B'] as number) ?? 0;
        const hr = (stats['HR'] as number) ?? 0;
        if (H < doubles + triples + hr) {
          errors.push(
            `batterGroups[${i}].stats: 단타가 음수가 됨 (H=${H} < 2B+3B+HR=${doubles + triples + hr})`
          );
        }
      }
    });
  }

  // pitchers (선택)
  if (data['pitchers'] !== undefined) {
    if (!Array.isArray(data['pitchers'])) {
      errors.push('pitchers: 배열 필수');
    } else {
      (data['pitchers'] as unknown[]).forEach((p, i) => {
        if (!isObject(p)) {
          errors.push(`pitchers[${i}]: 객체가 아님`);
          return;
        }
        if (!VALID_TEAM_CODES.includes(p['team'] as TeamCode)) {
          errors.push(`pitchers[${i}].team: 유효하지 않은 TeamCode`);
        }
        if (p['role'] !== 'starter') {
          errors.push(`pitchers[${i}].role: 'starter'만 허용`);
        }
        if (!isObject(p['stats'])) {
          errors.push(`pitchers[${i}].stats: 객체 필수`);
        } else {
          const stats = p['stats'] as Record<string, unknown>;
          for (const key of PITCHER_STAT_KEYS) {
            if (typeof stats[key] !== 'number' || (stats[key] as number) < 0) {
              errors.push(`pitchers[${i}].stats.${key}: 0 이상 number 필수`);
            }
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeGameData(data: unknown): GameData | null {
  const { valid } = validateGameData(data);
  if (!valid) return null;
  return data as GameData;
}

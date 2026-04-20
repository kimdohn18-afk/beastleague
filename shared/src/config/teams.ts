// shared/src/config/teams.ts

import { TeamCode } from '../types/GameData';

export interface TeamInfo {
  code: TeamCode;       // 내부 코드 (기존 유지)
  displayName: string;  // UI에 표시할 가상 팀명
  city: string;         // 연고지
  color: string;        // 팀 대표 컬러 (UI용)
}

export const TEAM_MAP: Record<TeamCode, TeamInfo> = {
  '한화':  { code: '한화',  displayName: '독수리', city: '대전', color: '#FF6600' },
  '삼성':  { code: '삼성',  displayName: '사자',   city: '대구', color: '#074CA1' },
  'KIA':   { code: 'KIA',   displayName: '호랑이', city: '광주', color: '#EA0029' },
  '두산':  { code: '두산',  displayName: '곰',     city: '서울', color: '#131230' },
  '키움':  { code: '키움',  displayName: '영웅',   city: '고척', color: '#820024' },
  'LG':    { code: 'LG',    displayName: '쌍둥이', city: '잠실', color: '#C30452' },
  '롯데':  { code: '롯데',  displayName: '거인',   city: '부산', color: '#041E42' },
  'NC':    { code: 'NC',    displayName: '공룡',   city: '창원', color: '#315288' },
  'KT':    { code: 'KT',    displayName: '마법사', city: '수원', color: '#000000' },
  'SSG':   { code: 'SSG',   displayName: '착륙자', city: '인천', color: '#CE0E2D' },
};

export function getDisplayName(code: TeamCode): string {
  return TEAM_MAP[code]?.displayName ?? code;
}

export function getTeamInfo(code: TeamCode): TeamInfo | undefined {
  return TEAM_MAP[code];
}

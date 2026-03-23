import { STAT_RULES, STAT_RULE_MAP } from '../config/statRules';

const REQUIRED_EVENTS = [
  'HR', '3B', '2B', 'H', 'MULTI_HIT', 'SB', 'RUN', 'BB', 'K', 'PA', 'IP',
];

describe('STAT_RULES', () => {
  it('필수 이벤트가 모두 정의되어 있어야 한다', () => {
    const defined = STAT_RULES.map((r) => r.event);
    REQUIRED_EVENTS.forEach((event) => {
      expect(defined).toContain(event);
    });
  });

  it('모든 effects 값이 number 타입이어야 한다', () => {
    STAT_RULES.forEach((rule) => {
      Object.values(rule.effects).forEach((val) => {
        expect(typeof val).toBe('number');
      });
    });
  });

  it('STAT_RULE_MAP이 이벤트명으로 빠르게 조회 가능해야 한다', () => {
    expect(STAT_RULE_MAP['HR'].effects.power).toBe(3);
    expect(STAT_RULE_MAP['K'].effects.mind).toBe(-0.5);
  });
});

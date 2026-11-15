/**
 * 진열장용 캠페인 흉내. 메뉴 화면이 진행 자료 없이도 돌아가는지 보려고 만든 가짜 CampaignModel이다.
 * 진짜 게임에서는 저장 데이터와 규칙을 감싼 CampaignModel이 이 자리에 들어온다(adapter/).
 */
import type { CampaignModel, UpgradeUnit } from '@engine/src/v2/menus/model';
import type { Sample } from '../pack-fixture';

export function mockCampaign(sample: Sample): CampaignModel {
  let funds = 48000;
  const stat = (id: string, label: string, base: number, step: number, level = 0): UpgradeUnit['stats'][number] => ({ id, label, level, max: 10, value: base + step * level, next: base + step * (level + 1), cost: 4000 + level * 3000 });
  const units: UpgradeUnit[] = [
    { id: 'gpi', name: '옴니 루나', pilot: '지피짱', image: sample.images['mech-gpi-generation-1'], stats: [stat('hp', 'HP', 6500, 350, 2), stat('en', 'VRAM', 120, 10, 1), stat('mobility', '운동성', 105, 5), stat('armor', '장갑', 1200, 80, 3), stat('weapon', '무기', 0, 100)] },
    { id: 'user', name: '프롬프트 커맨더', pilot: '유저', image: sample.images['mech-commander-sd'], stats: [stat('hp', 'HP', 6000, 350), stat('en', 'VRAM', 120, 10), stat('mobility', '운동성', 110, 5, 1), stat('armor', '장갑', 1100, 80), stat('weapon', '무기', 0, 100)] },
  ];
  return {
    hub: () => ({ chapter: '제1화', next: '제2화', funds }),
    entries: () => [
      { id: 'sortie', label: '다음 화로', about: '준비를 마치고 다음 화를 시작합니다.' },
      { id: 'upgrade', label: '기체 개조', about: '자금을 써서 기체의 능력치를 단계별로 올립니다.' },
      { id: 'parts', label: '강화 파츠', about: '얻은 파츠를 기체에 장착합니다.' },
      { id: 'pilot', label: '파일럿', about: '파일럿의 능력과 정신기를 확인하고 육성합니다.' },
      { id: 'shop', label: '상점', about: '자금으로 파츠와 소모품을 삽니다.' },
      { id: 'save', label: '저장', about: '지금까지의 진행을 저장합니다.' },
      { id: 'load', label: '불러오기', about: '저장해 둔 진행을 불러옵니다.' },
      { id: 'settings', label: '설정', about: '소리 크기와 연출 속도를 바꿉니다.' },
    ],
    funds: () => funds,
    upgradeUnits: () => units.map(u => ({ ...u, stats: u.stats.map(s => ({ ...s })) })),
    upgrade: (unitId, statId) => {
      const target = units.find(u => u.id === unitId)?.stats.find(s => s.id === statId);
      if (!target || target.cost === undefined || target.cost > funds) return false;
      funds -= target.cost;
      const step = (target.next ?? target.value) - target.value;
      target.level++; target.value += step;
      if (target.level >= target.max) { target.cost = undefined; target.next = undefined; } else { target.next = target.value + step; target.cost += 3000; }
      return true;
    },
  };
}

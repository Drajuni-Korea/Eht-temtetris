export const specialBySlot = {
  weapon: [['field','필드무기'],['colo','콜로무기'],['world','월드보스무기'],['devilWeapon','대악마무기']],
  helmet: [
    ['normal','일반'],['juggernaut','저거너트 헬름'],['blueHelm','콜로 블루 투구'],
    ['pumpkin','호박 머리 모자'],['insight','통찰의 투구'],['trueInsight','진 통찰의 투구'],['dragonLord','드래곤 로드 크라운']
  ],
  gloves: [
    ['normal','일반'],['blood','블러디 피스트'],['trueBlood','진 블러디 피스트'],
    ['hecate','헤카테의 장갑'],['midas','마이다스의 손']
  ],
  boots: [
    ['normal','일반'],['gale','질풍의 경갑'],['trueGale','진 질풍의 경갑'],
    ['indomitable','불굴의 경갑'],['vampire','뱀파이어 부츠']
  ],
  necklace: [
    ['normal','일반'],['hades','하데스의 목걸이'],['trueHades','진 하데스의 목걸이'],
    ['guard','경비대장의 목걸이'],['dragon','용의 가호 목걸이']
  ],
  ring: [
    ['normal','일반'],['cyclone','싸이클론 링'],['trueCyclone','진 싸이클론 링'],
    ['trinity','트리니티 링'],['sacrifice','수호자의 희생 반지']
  ],
  belt: [
    ['normal','일반'],['thunder','뇌룡의 허리띠'],['trueThunder','진 뇌룡의 허리띠'],
    ['alchemy','연금술사의 벨트'],['sylph','실프의 허리띠'],['dual','듀얼 허리띠']
  ],
  armor: [
    ['normal','일반'],['frost','서리거인의 흉갑'],['trueFrost','진 서리거인의 흉갑'],
    ['absorb','흡수의 갑옷'],['masochist','피학자의 갑옷']
  ]
};

export const specialAliases = {
  blood:['블러디피스트','블러드피스트'],
  trueBlood:['진블러디피스트','진블러드피스트'],
  pumpkin:['호박머리모자'],
  insight:['통찰의투구'],
  hecate:['헤카테의장갑'],
  indomitable:['불굴의경갑'],
  sylph:['실프의허리띠']
};

export const fixedSpecial = {
  gale: ['movespd'],
  trueGale: ['movespd'],
  juggernaut: ['hp'],
  juggernautUnique: ['hp'] // Legacy saved key; same helmet, never a belt.
};

// Source: six user-provided Abyss (L) reference images, 2026-09-22.
export const abyssUniques = {
  "trueFrost": {
    "special": "trueFrost",
    "slot": "armor",
    "name": "진 서리거인의 흉갑",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "피격 시 10~25% 확률로 강화된 서리파동 시전",
    "skill": "강화된 서리파동"
  },
  "absorb": {
    "special": "absorb",
    "slot": "armor",
    "name": "흡수의 갑옷",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "피해를 흡수하는 보호막 적용 시 6초간 받는 피해 15~30% 감소",
    "skill": null
  },
  "trueBlood": {
    "special": "trueBlood",
    "slot": "gloves",
    "name": "진 블러디피스트",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "강화된 블러디 버서크 1~3단계 상시 발동",
    "skill": "강화된 블러디 버서크"
  },
  "midas": {
    "special": "midas",
    "slot": "gloves",
    "name": "마이다스의 손",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "헌터가 얻는 골드량 35~50% 증가",
    "skill": null
  },
  "trueGale": {
    "special": "trueGale",
    "slot": "boots",
    "name": "진 질풍의 경갑",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 3,
    "fixedOptions": [
      {
        "key": "movespd",
        "min": 17,
        "max": 32,
        "unit": "%"
      }
    ],
    "effect": "이동속도 증가량의 3~10%만큼 공격력 증폭 (40% 제한); 이동속도 17~32% 증가",
    "skill": null
  },
  "vampire": {
    "special": "vampire",
    "slot": "boots",
    "name": "뱀파이어 부츠",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "블러드 익스플로전 1~3단계 시전 가능",
    "skill": "블러드 익스플로전"
  },
  "trueHades": {
    "special": "trueHades",
    "slot": "necklace",
    "name": "진 하데스의 목걸이",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "강화된 지하세계의 왕 1~3단계 상시 발동",
    "skill": "강화된 지하세계의 왕"
  },
  "dragon": {
    "special": "dragon",
    "slot": "necklace",
    "name": "용의 가호 목걸이",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "용의 가호 1~3단계 상시 발동",
    "skill": "용의 가호"
  },
  "trueCyclone": {
    "special": "trueCyclone",
    "slot": "ring",
    "name": "진 싸이클론 링",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "싸이클론 스킬 지속시간 4~6초 증가",
    "skill": "싸이클론"
  },
  "sacrifice": {
    "special": "sacrifice",
    "slot": "ring",
    "name": "수호자의 희생 반지",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "희생의 오라 1~3단계 시전 가능",
    "skill": "희생의 오라"
  },
  "trueInsight": {
    "special": "trueInsight",
    "slot": "helmet",
    "name": "진 통찰의 투구",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "2, 3차 직업 스킬 레벨 3~5 증가",
    "skill": null
  },
  "dragonLord": {
    "special": "dragonLord",
    "slot": "helmet",
    "name": "드래곤 로드 크라운",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "고대의 숨결 1~3단계 상시 발동",
    "skill": "고대의 숨결"
  },
  "trueThunder": {
    "special": "trueThunder",
    "slot": "belt",
    "name": "진 뇌룡의 허리띠",
    "tier": "abyss",
    "grade": "L",
    "isTrue": true,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "강화된 뇌룡의 분노 1~3단계 상시 발동",
    "skill": "강화된 뇌룡의 분노"
  },
  "dual": {
    "special": "dual",
    "slot": "belt",
    "name": "듀얼 허리띠",
    "tier": "abyss",
    "grade": "L",
    "isTrue": false,
    "randomOptionCount": 4,
    "fixedOptions": [],
    "effect": "피격 시 10~25% 확률로 빛 폭발 시전",
    "skill": "빛 폭발"
  }
};

// Match the complete, longest name first: normal names are substrings of true names.
const compact = text => String(text || '').replace(/\s+/g, '');
export function matchEquipment(text, slot) {
  const input = compact(text);
  const candidates = Object.entries(specialBySlot).flatMap(([part, entries]) =>
    entries.filter(([key]) => key !== 'normal' && (!slot || slot === part)).flatMap(([special, name]) =>
      [name, ...(specialAliases[special] || [])].map(alias => ({special, slot:part, name, alias:compact(alias)}))));
  candidates.sort((a,b) => b.alias.length - a.alias.length);
  const match = candidates.find(entry => input.includes(entry.alias));
  return match ? {...match, ...(abyssUniques[match.special] || {})} : null;
}
export function detectSpecial(text, slot) {
  const match = matchEquipment(text, slot);
  if (match) return match.special;
  if (slot === 'belt') {
    if (/진\s*뇌룡|뇌룡.*진/.test(text)) return 'trueThunder';
    if (/뇌룡/.test(text)) return 'thunder';
    if (/연금술사/.test(text)) return 'alchemy';
  }
  if (slot === 'weapon') {
    if (/월드\s*보스/.test(text)) return 'world';
    if (/콜로/.test(text)) return 'colo';
    if (/대악마/.test(text)) return 'devilWeapon';
    return 'field';
  }
  return 'normal';
}
export function mergeEquipmentOptions(special, found) {
  return [...new Set([...(fixedSpecial[special] || []), ...found])];
}

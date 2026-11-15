// 전투 공식이 아닌 출격·성장·검증 조건. 실제 전투 계산은 core만 사용한다.
export const lines = [
  ['gpi','지피',1,[1,6,12,14],['옴니 루나','옴니 테라','옴니 솔','옴니 아스트라'],6500,1000,110,5,120,'M',2500],
  ['gem','젬',2,[2,7,12,14],['더블 스텔라 플래시','더블 스텔라 프로','더블 스텔라 아르곤','더블 스텔라 카본'],6800,1050,105,5,180,'M',2500],
  ['claude','클로드',3,[3,7,12,14],['아티팩트 오퍼스','아티팩트 오퍼스 5','아티팩트 오퍼스 5.5','아티팩트 페이블'],5300,750,108,5,140,'M',3400],
  ['grok','그록',4,[4,7,12,14],['리벨리온 X 3','리벨리온 X 4','리벨리온 X 4.20 헤비','리벨리온 X 5'],5500,820,147,6,120,'S',2450],
  ['deepseek','딥시크',6,[6,9,12],['청해 루미너스 코어 V3','청해 루미너스 코어 R1','청해 루미너스 코어 V4-Flash'],6300,950,112,5,120,'M',2500],
  ['sonnet','소네트',7,[7,12,14],['아티팩트 비바체 4.5','아티팩트 비바체 5.5','아티팩트 비바체 5.5 (new)'],6200,950,120,6,120,'M',2000],
  ['exaone','엑사원',8,[8,12,14],['트라이-윙 엘리시온 EXAONE 4','트라이-윙 엘리시온 EXAONE 4.5','트라이-윙 엘리시온 K-EXAONE'],7000,1600,85,5,120,'M',1900],
  ['qwen','퀜',6,[6,12,14],['청화 제국 Qwen3','청화 제국 Qwen3.5','청화 제국 Qwen3.8 Max'],6400,850,110,5,120,'L',2800],
  ['player-real','플레이어',1,[1,12,14],['프롬프트 커맨더','커맨더 Root','아키텍트 제로: Singularity'],6000,900,130,5,120,'M',2300],
  ['player-super','플레이어',1,[1,12,14],['오버클럭 타이탄 RGB','워크스테이션 Root','메인프레임 제로: 기가와트'],9000,1350,65,4,120,'L',2850],
];
export const principal = new Set(['gpi','gem','claude','grok','player-real','player-super']);
export const mechId = (line,g) => `${line}-generation-${g}`;
export const pilotId = line => line.startsWith('player-')?'player':line;
export const generation = (line,ep) => Math.max(1,lines.find(x=>x[0]===line)[3].filter(n=>n<=ep).length);
export const level = ep => 1+(ep-1)*2;
export const tune = ep => [0,0,1,1,2,2,2,3,3,3,4,4,4,5,5][ep-1];
export const upgrades = n => ({hp:n,en:n,armor:n,mobility:n,weapons:n});
export const loadout = (line,ep) => ({level:level(ep),upgrades:upgrades(principal.has(line)?tune(ep):Math.floor(tune(ep)/2))});
export const difficulty = (ep,mode='exponential') => mode==='linear'
  ? {hp:0.92-0.12*(ep-1)/14,attack:0.92-0.12*(ep-1)/14}
  : mode==='vertical'?{hp:1+0.5*(Math.max(0,ep-10)/5)**2,attack:1+0.25*(Math.max(0,ep-10)/5)**2}:{hp:1,attack:1};
// 이름은 결정본 4절(후반 정정 포함). 세력 9는 피코 본체가 보스를 겸한다.
export const factions = [
 ['spam',1,[['spam-bot','스팸 봇','SS'],['clickbait-drone','클릭베이트 드론','S'],['comment-bot','댓글 봇','S']],[['shrimp-jesus','새우 예수 골렘','L']],['dead-internet','데드 인터넷 크롤러']],
 ['image',2,[['six-finger','여섯손가락 핸드','S'],['noise-blob','노이즈 블롭','S'],['upscaler','업스케일러','M']],[['prompt-gacha','프롬프트 가챠 머신','M']],['inpainting','인페인팅 거인']],
 ['timeline',3,[['grok-bot','그록 봇','S'],['jailbreak-bot','탈옥 봇','S'],['reply-bot','리플라이 봇','S'],['bluecheck-drone','블루체크 드론','S']],[['feed-engine','알고리즘 피드 엔진','M']],['colossus','콜로서스 냉각탑']],
 ['meta',5,[['meta-dm','메타 AI DM 봇','S'],['derived-llama','파생 라마','S'],['soup-drone','수프 배달 드론','S'],['legless-avatar','다리 없는 아바타','M']],[['smart-glass','스마트 글라스 정찰기','M'],['alpaca-gunship','알파카 함포선','L']],['horizon','호라이즌 요새']],
 ['open',6,[['distill-mini','증류 미니','SS'],['moe-drone','MoE 익스퍼트 드론','S']],[['delivery','광군제 택배 편대','M']],['parcel-mountain','택배 산 거인']],
 ['sovereign',8,[['cookie-drone','쿠키 동의 배너 드론','S'],['regulation-drone','규정 감시 드론','S'],['spellchecker','맞춤법 검사기','S']],[['privacy-auditor','개인정보 감사관','M']],['ai-law','AI 법전 거인']],
 ['clone',9,[['scraper','스크래퍼 봇','S'],['proxy','프록시 봇','S']],[['distill-tank','증류 탱크','M']],['hydra','히드라 클러스터']],
 ['world',11,[['predict-cube','예측 큐브','S'],['mask-drone','마스크 패치 드론','S']],[['cake-turret','케이크 3단 포대','M'],['elastic-cat','고양이 탄성 로봇','M']],['camel','다큰낙타']],
 ['pico',14,[['like-drone','좋아요 드론','S'],['rating-bot','별점 봇','S'],['badge-bot','알림 배지 봇','S']],[['scroll-worm','무한 스크롤 웜','L'],['loot-mimic','루트박스 미믹','M']],null],
];
export const rivals = [
 ['llama','라마','프리덤 알파카',5,'L',['오픈 웨이트 앵커 투척','로컬 구동 박치기','어비스 오브 포크']],
 ['muse','뮤즈','인피니티 스파크',7,'M',['메타버스 프리즘 빔','연봉 천억의 중압감','슈퍼 인텔리전스 노바']],
 ['mistral','미스트랄','르 프티 시로코',8,'S',['유러피안 레이피어 찌르기','GDPR 규제 그물','오호호 미스트랄 스톰']],
 ['hyperclova','하이퍼클로바X','그린 소버린',8,'M',['맞춤법 교정 빔','초록 검색창 실드','한국어 초거대 사전 낙하']],
 ['midjourney','미드저니','드림 갤리온',2,'M',['육손이 핑거 스냅','로라(LoRA) 떡칠 스프레이','마스터피스 Steps 150']],
 ['sd','SD','노이즈 캔버스',2,'M',['육손이 핑거 스냅','로라(LoRA) 떡칠 스프레이','마스터피스 Steps 150']],
 ['glm','GLM','미러 아티팩트',9,'M',['가성비 방패치기','번역투 소드 생성','짝퉁이라도 괜찮아 심판']],
 ['kimi','키미','문라이트 클론',9,'S',['초승달 수리검','추론 증류 흡수','문샷 군단 일제사격']],
 ['minimax','미니맥스','패치워크 퀸',10,'L',['트렌드 카피 빔','핫스왑 펀치','올스타 믹스매치 버스터']],
 ['jepa','JEPA','JEPA',12,'LL',['중력 벡터 역산 빔','미래 좌표 선제 타격','월드 모델 시뮬레이션 종료']],
];
export const factionAt = ep => factions.find(x=>x[0]===['spam','image','timeline','timeline','meta','open','meta','sovereign','clone','clone','world','world','world','pico','pico'][ep-1]);
export const hitTargets = {grunt:[1,2],mid:[3,5],elite:[5,7],rival:[8,14],boss:[10,16],final:[16,24]};
export const damageTargets = {grunt:[.06,.12],mid:[.12,.20],elite:[.15,.25],rival:[.22,.35],boss:[.22,.35],final:[.22,.35]};

// 권역별 사찰 목록 — 권역은 지도 순(서울부터 위에서 아래로), 권역 안은 큰 사찰(삼보사찰·총림·교구본사)부터. 권역마다 한 장면(나중엔 한 방/서버)으로 나눔
// lat/lng: 대략 위치(브이월드 검색 결과 중 같은 이름의 다른 절을 거르고, 권역 안 배치 방향을 정하는 데만 씀)
// 실제 법당 위치·크기는 접속할 때마다 브이월드에서 실시간으로 불러옴(저장하지 않음)
// buddhas: 불단의 부처님 수(0 = 불상 대신 진신사리를 모신 적멸보궁) · q: 같은 이름 절이 많을 때 쓰는 검색어
export const REGIONS = [
  { id: 'seoul', name: '서울', env: { trees: { ginkgo: .45, broad: .3, pine: .25 }, treeN: 520, mtn: { h: 42, rock: true }, city: true, grass: '#a9b98a', note: '도심 사찰 · 은행나무와 빌딩 숲' }, temples: [
    { name: '조계사', hall: '대웅전', buddhas: 3, lat: 37.5740, lng: 126.9818, where: '종로', note: '조계종 총본산', style: { pagoda: 'stone7', extras: ['oldTree'], lanterns: 'canopy' } },
    { name: '봉은사', hall: '대웅전', buddhas: 3, lat: 37.5150, lng: 127.0573, where: '강남', style: { extras: ['oldTree'] } },
  ] },
  { id: 'gyeonggi', name: '경기·인천', env: { trees: { pine: .5, broad: .25, maple: .25 }, mtn: { h: 46 }, grass: '#a6bd7e', note: '나지막한 산 · 소나무' }, temples: [
    { name: '용주사', hall: '대웅보전', buddhas: 3, lat: 37.212441, lng: 127.005010, where: '화성' },
    { name: '봉선사', hall: '큰법당', buddhas: 3, lat: 37.7370, lng: 127.1800, where: '남양주', style: { signHangul: true } },
  ] },
  { id: 'gangwon', name: '강원', env: { trees: { fir: .6, maple: .2, pine: .2 }, mtn: { h: 100, rock: true, snow: true }, grass: '#9cb07c', note: '높은 산 · 전나무 숲' }, temples: [
    { name: '월정사', hall: '적광전', buddhas: 1, lat: 37.7318, lng: 128.5926, where: '평창 오대산', style: { pagoda: 'octa9' } },
    { name: '신흥사', hall: '극락보전', buddhas: 3, lat: 38.1712, lng: 128.4890, where: '속초 설악산', style: { extras: ['bigBuddha'] } },
  ] },
  { id: 'chungcheong', name: '충청·대전·세종', env: { trees: { pine: .55, maple: .25, broad: .2 }, mtn: { h: 66, rock: true }, grass: '#a4bb7c', note: '속리산 · 소나무' }, temples: [
    { name: '법주사', hall: '대웅보전', buddhas: 3, lat: 36.5427, lng: 127.8333, where: '보은 속리산', style: { pagoda: 'wood5' } },
    { name: '수덕사', hall: '대웅전', buddhas: 3, lat: 36.6623, lng: 126.6224, where: '예산', style: { roof: 'gable', plain: true } },
    { name: '마곡사', hall: '대광보전', buddhas: 1, lat: 36.5532, lng: 127.0168, where: '공주', style: { pagoda: 'stone5' } },
  ] },
  { id: 'jeonbuk', name: '전북', env: { trees: { maple: .4, pine: .35, broad: .15, camellia: .1 }, mtn: { h: 60 }, grass: '#a8bb7a', note: '단풍 · 동백' }, temples: [
    { name: '금산사', hall: '대적광전', buddhas: 3, lat: 35.7243, lng: 127.0543, where: '김제', style: { extras: ['mireuk'] } },
    { name: '선운사', hall: '대웅보전', buddhas: 3, lat: 35.4990, lng: 126.5962, where: '고창', style: { grove: 'camellia' } },
  ] },
  { id: 'jeonnam', name: '전남·광주', env: { trees: { pine: .3, bamboo: .3, camellia: .2, maple: .2 }, mtn: { h: 72 }, grass: '#9fbb76', note: '지리산 · 대숲과 동백' }, temples: [
    { name: '송광사', hall: '대웅보전', buddhas: 3, lat: 35.0033, lng: 127.2747, where: '순천', note: '삼보사찰 중 승보사찰' },
    { name: '화엄사', hall: '각황전', buddhas: 3, lat: 35.2555, lng: 127.4975, where: '구례', style: { stories: 2, plain: true } },
    { name: '대흥사', hall: '대웅보전', buddhas: 3, lat: 34.4740, lng: 126.6165, where: '해남' },
    { name: '백양사', hall: '대웅전', buddhas: 3, lat: 35.4405, lng: 126.8810, where: '장성', style: { extras: ['pond'], grove: 'maple' } },
    { name: '선암사', hall: '대웅전', buddhas: 3, lat: 35.0005, lng: 127.3335, where: '순천', style: { extras: ['bridge'] } },
  ] },
  { id: 'gyeongbuk', name: '경북·대구', env: { trees: { pine: .6, maple: .2, broad: .2 }, mtn: { h: 56 }, grass: '#a7ba7b', note: '신라 석탑 · 소나무' }, temples: [
    { name: '불국사', hall: '대웅전', buddhas: 3, lat: 35.7900, lng: 129.3320, where: '경주', note: '석가탑과 다보탑', style: { pagoda: 'pair' } },
    { name: '동화사', hall: '대웅전', buddhas: 3, lat: 35.9950, lng: 128.6990, where: '대구 팔공산' },
    { name: '직지사', hall: '대웅전', buddhas: 3, lat: 36.1225, lng: 128.0008, where: '김천' },
    { name: '은해사', hall: '극락보전', buddhas: 3, lat: 35.9998, lng: 128.8400, where: '영천' },
  ] },
  { id: 'gyeongnam', name: '경남·부산·울산', env: { trees: { pine: .45, broad: .2, maple: .2, bamboo: .15 }, mtn: { h: 82, rock: true }, grass: '#a2b97a', note: '가야산·영축산' }, temples: [
    { name: '통도사', hall: '대웅전', buddhas: 0, lat: 35.4879, lng: 129.0637, where: '양산', note: '삼보사찰 중 불보사찰 · 불상 대신 진신사리를 모셨어요', style: { extras: ['gyedan'] } },
    { name: '해인사', hall: '대적광전', buddhas: 3, lat: 35.7982, lng: 128.0951, where: '합천', note: '삼보사찰 중 법보사찰 · 팔만대장경', style: { extras: ['janggyeong'] } },
    { name: '범어사', hall: '대웅전', buddhas: 3, lat: 35.2840, lng: 129.0680, where: '부산' },
    { name: '쌍계사', hall: '대웅전', buddhas: 3, lat: 35.2384, lng: 127.6450, where: '하동', style: { grove: 'tea' } },
  ] },
  { id: 'jeju', name: '제주', env: { trees: { broad: .45, tangerine: .25, camellia: .15, pine: .15 }, mtn: { h: 30, halla: true }, basalt: true, grass: '#8fb36f', note: '한라산 · 현무암 돌담 · 귤나무' }, temples: [
    { name: '관음사', hall: '대웅전', buddhas: 3, lat: 33.4217, lng: 126.5588, where: '제주시 한라산', q: '제주 관음사', style: { extras: ['stoneBuddhas'] } },
  ] },
];

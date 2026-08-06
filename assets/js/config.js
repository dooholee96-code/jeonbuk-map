/* 전북 농촌유학·학교 통합지도 — 전역 설정 및 레지스트리 */
window.JB = window.JB || {};

/* 카카오맵 JavaScript 앱 키.
   내 도메인에서 쓰려면 https://developers.kakao.com 에서
   [내 애플리케이션 > 플랫폼 > Web]에 사이트 도메인을 등록해야 합니다. */
JB.KAKAO_KEY = 'ee00ac93b075fc1e56de1a0dc90ccaf3';

/* 학교급 정의 */
JB.TYPES = {
  elem: { label: '초등학교', short: '초', dot: '#3b82f6', text: '#1e3a8a', rank: 1 },
  mid:  { label: '중학교',   short: '중', dot: '#ef4444', text: '#7f1d1d', rank: 2 },
  high: { label: '고등학교', short: '고', dot: '#8b5cf6', text: '#4c1d95', rank: 3 }
};

/* 농촌유학 상태 정의 */
JB.RURAL = {
  op:   { label: '농촌유학 운영학교', mark: '★', dot: '#00e676', text: '#006400', rank: 5 },
  hope: { label: '농촌유학 희망학교', mark: '☆', dot: '#ff9100', text: '#e65100', rank: 4 }
};

/* 14개 시군. priority 낮을수록 먼저 정비. status: ready | seed | planned */
JB.REGIONS = [
  { key: 'jinan',    name: '진안군', center: [35.79, 127.44], level: 9,  priority: 1 },
  { key: 'imsil',    name: '임실군', center: [35.61, 127.26], level: 9,  priority: 2 },
  { key: 'jeongeup', name: '정읍시', center: [35.61, 126.92], level: 9,  priority: 3 },
  { key: 'sunchang', name: '순창군', center: [35.42, 127.10], level: 9,  priority: 4 },
  { key: 'namwon',   name: '남원시', center: [35.43, 127.42], level: 9,  priority: 5 },
  { key: 'jangsu',   name: '장수군', center: [35.65, 127.53], level: 9,  priority: 6 },
  { key: 'muju',     name: '무주군', center: [35.93, 127.72], level: 9,  priority: 7 },
  { key: 'gochang',  name: '고창군', center: [35.44, 126.60], level: 9,  priority: 8 },
  { key: 'buan',     name: '부안군', center: [35.69, 126.60], level: 10, priority: 9 },
  { key: 'wanju',    name: '완주군', center: [35.87, 127.19], level: 10, priority: 10 },
  { key: 'gimje',    name: '김제시', center: [35.79, 126.88], level: 9,  priority: 11 },
  { key: 'jeongju',  name: '전주시', center: [35.82, 127.13], level: 8,  priority: 12 },
  { key: 'iksan',    name: '익산시', center: [36.02, 126.99], level: 9,  priority: 13 },
  { key: 'gunsan',   name: '군산시', center: [35.95, 126.72], level: 10, priority: 14 }
];

/* ── 시군 데이터 레지스트리 ────────────────────────────────
   data/regions/<key>.js 가 JB.registerRegion(key, payload) 로 등록합니다.
   payload = {
     updated:  'YYYY-MM-DD',
     verified: true | false,      // 좌표·목록 검수 완료 여부
     note:     '데이터 출처/주의사항',
     schools:  [ { n, t, ph, rural, lat, lng, approx, ox, oy, addr, tel, stu, cls, tags, desc } ]
   }
   n=이름 t=학교급(elem|mid|high) ph=읍면동 rural='운영'|'희망'
   approx=true 면 좌표 미확정(읍면 중심 임시값) ox/oy=라벨 수동 오프셋(px)
   ──────────────────────────────────────────────────────── */
JB.DATA = {};
JB.registerRegion = function (key, payload) {
  payload.schools = payload.schools || [];
  JB.DATA[key] = payload;
};

JB.regionByKey = function (key) {
  return JB.REGIONS.filter(function (r) { return r.key === key; })[0] || null;
};

/* 전북 학교·농촌유학 지도 — 전역 설정 및 레지스트리 */
window.JB = window.JB || {};

/* ── 배경지도 타일 ────────────────────────────────────────
   OpenStreetMap 을 씁니다. API 키도, 도메인 등록도 필요 없습니다.

   OSM 공식 타일은 사용 정책(https://operations.osmfoundation.org/policies/tiles/)상
   대규모 트래픽에는 맞지 않습니다. 방문자가 많아지면 아래 TILE 만 다른
   제공자로 바꾸세요. 지도 코드는 손댈 필요가 없습니다.
   ──────────────────────────────────────────────────────── */
JB.TILE = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
  maxZoom: 19
};

/* 배경을 흑백으로 깔아 학교 마커가 도드라지게 한다 (false 면 원래 색) */
JB.TILE_GRAYSCALE = true;

/* 학교급 정의 */
JB.TYPES = {
  elem: { label: '초등학교', short: '초', dot: '#3b82f6', text: '#1e3a8a', rank: 1 },
  mid:  { label: '중학교',   short: '중', dot: '#ef4444', text: '#7f1d1d', rank: 2 },
  high: { label: '고등학교', short: '고', dot: '#8b5cf6', text: '#4c1d95', rank: 3 }
};

/* 농촌유학 상태 정의 */
JB.RURAL = {
  op:   { label: '농촌유학 운영학교', mark: '★', dot: '#00c853', text: '#006400', rank: 5 },
  hope: { label: '농촌유학 희망학교', mark: '☆', dot: '#ff9100', text: '#e65100', rank: 4 }
};

/* 14개 시군 */
JB.REGIONS = [
  { key: 'jinan',    name: '진안군' },
  { key: 'imsil',    name: '임실군' },
  { key: 'jeongeup', name: '정읍시' },
  { key: 'sunchang', name: '순창군' },
  { key: 'namwon',   name: '남원시' },
  { key: 'jangsu',   name: '장수군' },
  { key: 'muju',     name: '무주군' },
  { key: 'gochang',  name: '고창군' },
  { key: 'buan',     name: '부안군' },
  { key: 'wanju',    name: '완주군' },
  { key: 'gimje',    name: '김제시' },
  { key: 'jeongju',  name: '전주시' },
  { key: 'iksan',    name: '익산시' },
  { key: 'gunsan',   name: '군산시' }
];

/* ── 시군 데이터 레지스트리 ────────────────────────────────
   data/regions/<key>.js 가 JB.registerRegion(key, payload) 로 등록합니다.
   payload = {
     updated:  'YYYY-MM-DD',
     verified: true | false,      // 좌표·목록 검수 완료 여부
     note:     '데이터 출처/주의사항',
     schools:  [ { n, t, ph, rural, lat, lng, approx, ox, oy, addr, tel, stu, cls } ]
   }
   n=이름 t=학교급(elem|mid|high) ph=읍면동 rural='운영'|'희망'
   approx=true 면 좌표 미확정 ox/oy=라벨 수동 오프셋(px)
   ──────────────────────────────────────────────────────── */
JB.DATA = {};
JB.registerRegion = function (key, payload) {
  payload.schools = payload.schools || [];
  JB.DATA[key] = payload;
};

JB.regionByKey = function (key) {
  return JB.REGIONS.filter(function (r) { return r.key === key; })[0] || null;
};

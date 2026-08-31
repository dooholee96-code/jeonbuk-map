/* 전북 학교·농촌유학 지도 — 전역 설정 및 레지스트리 */
window.JB = window.JB || {};

/* ── 배경지도 타일 ────────────────────────────────────────
   키가 필요 없는 tile.openstreetmap.org 하나만 씁니다.
   "단순" 배경은 별도 제공자가 아니라, 같은 타일에 CSS 필터를 걸어
   회색으로 눌러 놓은 것입니다. 그래서 제공자 정책이 바뀌어도 안 깨집니다.

   CARTO(basemaps.cartocdn.com)는 2026년부터 키를 요구합니다.
   키 없이 부르면 오류가 아니라 "API KEY REQUIRED" 워터마크가 박힌
   정상 이미지를 돌려주기 때문에 자동 감지가 되지 않습니다. 그래서 뺐습니다.

   키를 발급받아 다른 제공자를 쓰려면 아래 형식으로 항목을 더하세요.
     mine: { label: '내 타일', url: 'https://.../{z}/{x}/{y}.png?key=발급키',
             attribution: '&copy; 제공자', maxZoom: 20, cls: '' }
   ──────────────────────────────────────────────────────── */
var OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자';

JB.TILE_PRESETS = {
  plain: {
    label: '단순 (연회색)',
    url: OSM_URL, attribution: OSM_ATTR, maxZoom: 19, cls: 'jb-tiles-plain'
  },
  soft: {
    label: '아주 연하게',
    url: OSM_URL, attribution: OSM_ATTR, maxZoom: 19, cls: 'jb-tiles-soft'
  },
  osm: {
    label: '원색 (지명 잘 보임)',
    url: OSM_URL, attribution: OSM_ATTR, maxZoom: 19, cls: ''
  },
  none: {
    label: '배경 없음',
    url: null, attribution: '', maxZoom: 19, cls: ''
  }
};

JB.TILE_DEFAULT = 'plain';
JB.TILE_STORE = 'jb.tile';

JB.tileKey = function () {
  var k;
  try { k = localStorage.getItem(JB.TILE_STORE); } catch (e) { /* 사생활 보호 모드 */ }
  return JB.TILE_PRESETS[k] ? k : JB.TILE_DEFAULT;   // 없어진 배경(carto 등)은 기본값으로
};
JB.setTileKey = function (k) {
  try { localStorage.setItem(JB.TILE_STORE, k); } catch (e) { /* 무시 */ }
};

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

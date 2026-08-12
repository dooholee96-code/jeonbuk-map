/* 전북 학교·농촌유학 지도 — 전역 설정 및 레지스트리 */
window.JB = window.JB || {};

/* ── 배경지도 타일 ────────────────────────────────────────
   전부 API 키 없이 쓰는 타일입니다. 화면 오른쪽 위 [배경] 선택창에서
   바꿔 볼 수 있고, 고른 값은 그 브라우저에 저장됩니다.
   기본값을 바꾸려면 아래 JB.TILE_DEFAULT 를 고치세요.

   OSM 공식 타일과 CARTO 무료 타일 모두 사용 정책이 있습니다
   (https://operations.osmfoundation.org/policies/tiles/ ,
    https://carto.com/attributions ).
   방문자가 크게 늘면 MapTiler 같은 유료 제공자로 url 을 바꾸세요.
   ──────────────────────────────────────────────────────── */
var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자';
var CARTO_ATTR = OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

JB.TILE_PRESETS = {
  plain: {
    label: '단순 (밝은 회색)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, gray: false
  },
  nolabel: {
    label: '아주 단순 (지명 없음)',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, gray: false
  },
  osm: {
    label: '기본 OSM (지명 많음)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR, maxZoom: 19, gray: true
  },
  dark: {
    label: '어두운 배경',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 20, gray: false
  },
  none: {
    label: '배경 없음',
    url: null, attribution: '', maxZoom: 20, gray: false
  }
};

JB.TILE_DEFAULT = 'plain';
JB.TILE_STORE = 'jb.tile';

JB.tileKey = function () {
  var k;
  try { k = localStorage.getItem(JB.TILE_STORE); } catch (e) { /* 사생활 보호 모드 */ }
  return JB.TILE_PRESETS[k] ? k : JB.TILE_DEFAULT;
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

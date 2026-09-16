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
  kinder:  { label: '유치원',   short: '유', dot: '#f59e0b', text: '#92400e', rank: 0 },
  elem:    { label: '초등학교', short: '초', dot: '#3b82f6', text: '#1e3a8a', rank: 1 },
  mid:     { label: '중학교',   short: '중', dot: '#ef4444', text: '#7f1d1d', rank: 2 },
  high:    { label: '고등학교', short: '고', dot: '#8b5cf6', text: '#4c1d95', rank: 3 },
  special: { label: '특수학교', short: '특', dot: '#0ea5e9', text: '#075985', rank: 4 }
};

/* 농촌유학 상태 정의 */
JB.RURAL = {
  op:   { label: '농촌유학 운영학교', mark: '★', dot: '#00c853', text: '#006400', rank: 5 },
  hope: { label: '농촌유학 희망학교', mark: '☆', dot: '#ff9100', text: '#e65100', rank: 4 }
};

/* 유치원 설립 유형 */
JB.KINDER_KIND = {
  '단설': { label: '단설유치원', dot: '#d97706', text: '#7c2d12' },
  '병설': { label: '병설유치원', dot: '#f59e0b', text: '#92400e' },
  '사립': { label: '사립유치원', dot: '#a3a3a3', text: '#404040' }
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

/* ── 데이터 묶음(set) ──────────────────────────────────────
   같은 지도 엔진 위에 성격이 다른 학교 목록을 얹기 위한 칸입니다.
     sch    : 초·중·고        data/regions/<key>.js  (= JB.DATA, 예전 이름 유지)
     kinder : 유치원          data/kinder/<key>.js
     special: 특수학교        data/special/<key>.js
   유치원·특수학교 파일은 JB.registerSet(setKey, regionKey, payload) 로 등록합니다.
   ──────────────────────────────────────────────────────── */
JB.SETS = { sch: JB.DATA, kinder: {}, special: {} };

JB.SET_PATH = { sch: 'data/regions/', kinder: 'data/kinder/', special: 'data/special/' };

JB.registerSet = function (setKey, regionKey, payload) {
  payload.schools = payload.schools || [];
  (JB.SETS[setKey] = JB.SETS[setKey] || {})[regionKey] = payload;
};

JB.setData = function (setKey, regionKey) {
  return (JB.SETS[setKey] || {})[regionKey] || null;
};

JB.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

/* ── 지도 종류 ─────────────────────────────────────────────
   한 벌의 지도 엔진(경계·라벨·시트)을 그대로 쓰고, 어떤 자료를 어떤
   색·범례·요약으로 보여 줄지만 여기서 갈라 놓습니다. 브랜치를 나누지
   않는 이유이기도 합니다 — 엔진을 고치면 세 지도에 한 번에 반영됩니다.

   each = {
     label, title, headline  화면에 쓰는 이름
     sets                    쓸 데이터 묶음 (앞쪽이 먼저 그려짐)
     include(s, setKey)      그 묶음에서 이 지도에 넣을 학교인지
     filters                 [형태] 선택창 항목
     match(s, kind)          [형태] 필터
     style(s)                마커·라벨 스타일
     labelPick(s)            전북 전체에서 자동으로 이름을 띄울 대상
     legend()                범례 HTML
     stats(list)             요약 숫자 [{v,label,cls}]
     tags(s)                 목록 카드의 태그 HTML
     rows(s)                 상세카드 추가 줄 HTML
   }
   ──────────────────────────────────────────────────────── */
(function () {
'use strict';
var esc = JB.esc;

function baseStyle(s) {
  var t = JB.TYPES[s.t] || JB.TYPES.elem;
  return { cls: s.t, dot: t.dot, text: t.text, mark: '', weight: t.rank * 10, boxed: false, size: 17 };
}
function num(v) { return (v || 0).toLocaleString('ko-KR'); }

JB.MAPS = {
  /* ① 농촌유학 — 지금까지의 지도 그대로 */
  rural: {
    label: '농촌유학',
    title: '학교·농촌유학 지도',
    keyLabel: '농촌유학만',
    headline: '14개 시군 초·중·고와 농촌유학 운영·희망학교',
    sets: ['sch'],
    include: function () { return true; },
    filters: [['', '= 형태 전체 ='], ['elem', '초등학교'], ['mid', '중학교'], ['high', '고등학교'],
              ['op', '★ 농촌유학 운영학교'], ['hope', '☆ 농촌유학 희망학교'], ['rural', '농촌유학 운영＋희망']],
    match: function (s, k) {
      if (k === 'op') return s.rural === '운영';
      if (k === 'hope') return s.rural === '희망';
      if (k === 'rural') return !!s.rural;
      return !k || s.t === k;
    },
    style: function (s) {
      if (s.rural === '운영') return { cls: 'rural-op', dot: JB.RURAL.op.dot, text: JB.RURAL.op.text, mark: '★', weight: 100, boxed: true, size: 21 };
      if (s.rural === '희망') return { cls: 'rural-hope', dot: JB.RURAL.hope.dot, text: JB.RURAL.hope.text, mark: '☆', weight: 90, boxed: true, size: 21 };
      return baseStyle(s);
    },
    labelPick: function (s) { return !!s.rural; },
    bump: function (s) { return s.rural ? 50 : 0; },
    legend: function () {
      return dots([['#3b82f6', '초등학교'], ['#ef4444', '중학교'], ['#8b5cf6', '고등학교']]) + '<hr>' +
        '<div class="lg"><i style="background:#00e676;width:17px;height:17px"></i> <b style="color:#006400">★ 농촌유학 운영</b></div>' +
        '<div class="lg"><i style="background:#ff9100;width:17px;height:17px"></i> <b style="color:#e65100">☆ 농촌유학 희망</b></div>';
    },
    stats: function (l) {
      return [cnt(l, function (s) { return s.t === 'elem'; }, '초', 'elem'),
              cnt(l, function (s) { return s.t === 'mid'; }, '중', 'mid'),
              cnt(l, function (s) { return s.t === 'high'; }, '고', 'high'),
              cnt(l, function (s) { return s.rural === '운영'; }, '농촌유학 운영', 'op'),
              cnt(l, function (s) { return s.rural === '희망'; }, '희망', 'hope')];
    },
    tags: function (s) {
      return (s.rural ? tag(s.rural === '운영' ? 'op' : 'hope',
               (s.rural === '운영' ? '★' : '☆') + ' 농촌유학 ' + s.rural) : '') +
             (s.branch ? tag('etc', '분교') : '');
    },
    rows: function (s) {
      return (s.rural ? '<div class="d-rural ' + (s.rural === '운영' ? 'op' : 'hope') + '">농촌유학 ' + s.rural + '학교</div>' : '');
    }
  },

  /* ② 특수교육 — 특수학교 + 특수학급을 둔 유치원·초·중·고 */
  special: {
    label: '특수교육',
    title: '특수학교·특수학급 지도',
    keyLabel: '특수학교만',
    headline: '특수학교와 특수학급을 운영하는 유치원·초·중·고',
    sets: ['special', 'sch', 'kinder'],
    include: function (s, setKey) { return setKey === 'special' || s.sp > 0; },
    filters: [['', '= 형태 전체 ='], ['sch', '특수학교'], ['cls', '특수학급 설치교'],
              ['kinder', '유치원 특수학급'], ['elem', '초등 특수학급'],
              ['mid', '중등 특수학급'], ['high', '고등 특수학급']],
    match: function (s, k) {
      if (k === 'sch') return s.t === 'special';
      if (k === 'cls') return s.t !== 'special';
      return !k || s.t === k;
    },
    style: function (s) {
      if (s.t === 'special') {
        return { cls: 'special', dot: JB.TYPES.special.dot, text: JB.TYPES.special.text,
                 mark: '◆', weight: 120, boxed: true, size: 21 };
      }
      return baseStyle(s);
    },
    labelPick: function (s) { return s.t === 'special'; },
    bump: function (s) { return s.t === 'special' ? 60 : Math.min((s.sp || 0) * 4, 20); },
    legend: function () {
      return '<div class="lg"><i style="background:#0ea5e9;width:17px;height:17px"></i> <b style="color:#075985">◆ 특수학교</b></div><hr>' +
        '<div class="lg-note">아래는 특수학급을 둔 학교 — 점 색은 학교급</div>' +
        dots([['#f59e0b', '유치원'], ['#3b82f6', '초등학교'], ['#ef4444', '중학교'], ['#8b5cf6', '고등학교']]);
    },
    stats: function (l) {
      var cls = l.filter(function (s) { return s.t !== 'special'; });
      var sum = function (f) { return cls.reduce(function (a, s) { return a + (f(s) || 0); }, 0); };
      return [cnt(l, function (s) { return s.t === 'special'; }, '특수학교', 'special'),
              { v: cls.length, label: '특수학급 설치교', cls: '' },
              { v: sum(function (s) { return s.sp; }), label: '특수학급', cls: '' },
              { v: num(sum(function (s) { return s.spStu; })), label: '특수학급 학생', cls: '' }];
    },
    tags: function (s) {
      return s.t === 'special'
        ? tag('special', '◆ 특수학교') + (s.found ? tag('etc', s.found) : '')
        : tag('sp', '특수학급 ' + s.sp + '학급 · ' + (s.spStu || 0) + '명');
    },
    rows: function (s) {
      if (s.t === 'special') {
        var lv = Object.keys(s.lv || {}).map(function (k) { return k + ' ' + s.lv[k] + '학급'; }).join(' · ');
        return '<div class="d-rural special">◆ 특수학교' + (s.found ? ' (' + s.found + ')' : '') + '</div>' +
               (lv ? '<p class="d-row"><b>과정</b> ' + esc(lv) + '</p>' : '');
      }
      return '<p class="d-row"><b>특수학급</b> ' + s.sp + '학급 · ' + (s.spStu || 0) + '명</p>';
    }
  },

  /* ③ 유치원 */
  kinder: {
    label: '유치원',
    title: '유치원 지도',
    keyLabel: '단설유치원만',
    headline: '14개 시군 공·사립 유치원',
    sets: ['kinder'],
    include: function () { return true; },
    filters: [['', '= 형태 전체 ='], ['단설', '단설유치원'], ['병설', '병설유치원'], ['사립', '사립유치원'],
              ['pub', '공립(단설＋병설)'], ['sp', '특수학급 운영'], ['closed', '휴원']],
    match: function (s, k) {
      if (!k) return !s.closed;                       // 기본은 운영 중인 원만
      if (k === 'pub') return s.found === '공립' && !s.closed;
      if (k === 'sp') return s.sp > 0;
      if (k === 'closed') return !!s.closed;
      return s.kind === k && !s.closed;
    },
    style: function (s) {
      var kk = JB.KINDER_KIND[s.kind] || JB.KINDER_KIND['사립'];
      if (s.closed) return { cls: 'closed', dot: '#cbd5e1', text: '#64748b', mark: '', weight: 5, boxed: false, size: 15 };
      return { cls: 'k-' + ({ '단설': 'dan', '병설': 'byeong', '사립': 'sarip' }[s.kind] || 'sarip'),
               dot: kk.dot, text: kk.text, mark: '', weight: s.kind === '단설' ? 60 : 20, boxed: false, size: 17 };
    },
    labelPick: function (s) { return s.kind === '단설' && !s.closed; },
    bump: function (s) { return s.sp > 0 ? 25 : 0; },
    legend: function () {
      return dots([['#d97706', '단설유치원'], ['#f59e0b', '병설유치원'], ['#a3a3a3', '사립유치원'],
                   ['#cbd5e1', '휴원']]);
    },
    stats: function (l) {
      var stu = l.reduce(function (a, s) { return a + (s.stu || 0); }, 0);
      return [cnt(l, function (s) { return s.kind === '단설'; }, '단설', ''),
              cnt(l, function (s) { return s.kind === '병설'; }, '병설', ''),
              cnt(l, function (s) { return s.kind === '사립'; }, '사립', ''),
              cnt(l, function (s) { return s.sp > 0; }, '특수학급 운영', 'special'),
              { v: num(stu), label: '원아', cls: '' }];
    },
    tags: function (s) {
      return tag('k', (JB.KINDER_KIND[s.kind] || {}).label || s.kind) +
             (s.sp > 0 ? tag('sp', '특수학급 ' + s.sp) : '') +
             (s.closed ? tag('warn', '휴원') : '');
    },
    rows: function (s) {
      return '<p class="d-row"><b>설립</b> ' + esc(s.found || '') + ' · ' +
             esc((JB.KINDER_KIND[s.kind] || {}).label || s.kind || '') + '</p>' +
             (s.sp > 0 ? '<p class="d-row"><b>특수학급</b> ' + s.sp + '학급 · ' + (s.spStu || 0) + '명</p>' : '') +
             (s.closed ? '<div class="d-rural closed">휴원 중 (원아 없음)</div>' : '');
    }
  }
};

function dots(rows) {
  return rows.map(function (r) {
    return '<div class="lg"><i style="background:' + r[0] + '"></i> ' + r[1] + '</div>';
  }).join('');
}
function tag(cls, text) { return '<span class="tag t-' + cls + '">' + esc(text) + '</span>'; }
function cnt(list, f, label, cls) { return { v: list.filter(f).length, label: label, cls: cls }; }
})();

JB.MAP_ORDER = ['rural', 'special', 'kinder'];
JB.MAP_STORE = 'jb.map';

JB.mapKey = function () {
  var q = null;
  try { q = new URLSearchParams(location.search).get('map'); } catch (e) { /* 구형 */ }
  if (JB.MAPS[q]) { JB.setMapKey(q); return q; }
  var k = null;
  try { k = localStorage.getItem(JB.MAP_STORE); } catch (e) { /* 사생활 보호 모드 */ }
  return JB.MAPS[k] ? k : 'rural';
};
JB.setMapKey = function (k) {
  try { localStorage.setItem(JB.MAP_STORE, k); } catch (e) { /* 무시 */ }
};

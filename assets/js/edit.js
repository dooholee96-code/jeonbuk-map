/* 편집 모드 — 폼·검증·내보내기
   주소 뒤에 ?edit=1 을 붙이면 켜지고, ?edit=0 이면 꺼집니다.
   서버가 없으므로 편집 내용은 이 브라우저에만 쌓이고,
   [내보내기]로 받은 파일을 저장소의 같은 경로에 덮어써야 확정됩니다.
   초·중·고(data/regions)·유치원(data/kinder)·특수학교(data/special)를
   모두 같은 방식으로 다룹니다. */
window.JB = window.JB || {};

(function () {
  'use strict';

  var STORE = 'jb.edits.v2';
  var STORE_V1 = 'jb.edits.v1';      // 초·중·고만 있던 시절의 저장분

  /* 편집 대상은 "묶음:시군" 한 쌍으로 가리킨다. 예) 'kinder:jinan' */
  function idOf(setKey, regionKey) { return setKey + ':' + regionKey; }
  function split(id) { var i = id.indexOf(':'); return [id.slice(0, i), id.slice(i + 1)]; }

  /* ── 편집 모드 on/off ─────────────────────────────── */
  JB.editMode = (function () {
    var q = null;
    try { q = new URLSearchParams(location.search).get('edit'); } catch (e) { /* 구형 */ }
    try {
      if (q === '1') localStorage.setItem('jb.edit', '1');
      if (q === '0') localStorage.removeItem('jb.edit');
      return localStorage.getItem('jb.edit') === '1';
    } catch (e) { return q === '1'; }
  })();

  /* ── 변경분 저장소 ────────────────────────────────
     "묶음:시군"별로 schools 배열 통째를 담는다.
     원본 파일의 updated 값을 함께 적어 두어, 파일이 갱신되면
     묵은 편집분이 새 데이터를 덮어쓰지 않도록 막는다. */
  function load() {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { all = {}; }
    if (Object.keys(all).length) return all;

    // 예전 저장분(시군 키만 있던 v1)을 'sch:<시군>' 으로 옮겨 온다
    var old = {};
    try { old = JSON.parse(localStorage.getItem(STORE_V1) || '{}'); } catch (e) { return all; }
    Object.keys(old).forEach(function (k) { all[idOf('sch', k)] = old[k]; });
    if (Object.keys(all).length) {          // 옮겼으면 바로 굳혀 둔다
      try { localStorage.setItem(STORE, JSON.stringify(all)); localStorage.removeItem(STORE_V1); }
      catch (e) { /* 저장 못 해도 이번 판에서는 그대로 쓴다 */ }
    }
    return all;
  }
  function save(all) {
    try { localStorage.setItem(STORE, JSON.stringify(all)); return true; }
    catch (e) { alert('브라우저 저장 공간이 부족해 변경사항을 담지 못했습니다.\n[내보내기]로 먼저 파일을 받아 두세요.'); return false; }
  }

  JB.edits = load();

  JB.dirtySets = function () {
    return Object.keys(JB.edits).filter(function (id) {
      var p = split(id); return !!JB.setData(p[0], p[1]);
    });
  };

  JB.saveSet = function (setKey, regionKey) {
    var d = JB.setData(setKey, regionKey);
    if (!d) return false;
    JB.edits[idOf(setKey, regionKey)] =
      { base: d.updated, at: new Date().toISOString(), schools: d.schools };
    return save(JB.edits);
  };

  JB.discardEdits = function (id) {
    if (id) delete JB.edits[id]; else JB.edits = {};
    save(JB.edits);
  };

  /* 저장된 편집분을 데이터에 얹는다. 원본 파일이 그새 바뀌었으면 건너뛴다. */
  JB.applyEdits = function () {
    var stale = [];
    Object.keys(JB.edits).forEach(function (id) {
      var p = split(id), d = JB.setData(p[0], p[1]), e = JB.edits[id];
      if (!d) return;
      if (e.base !== d.updated) { stale.push(JB.setLabel(id)); return; }
      d.schools = e.schools;
    });
    return stale;
  };

  var SET_NAME = { sch: '초·중·고', kinder: '유치원', special: '특수학교' };

  JB.setLabel = function (id) {
    var p = split(id), r = JB.regionByKey(p[1]);
    return (r ? r.name : p[1]) + ' ' + (SET_NAME[p[0]] || p[0]);
  };
  JB.setFileName = function (id) {
    var p = split(id);
    return (p[0] === 'sch' ? '' : p[0] + '-') + p[1] + '.js';   // 내려받기 폴더에서 안 섞이게
  };
  JB.setPath = function (id) {
    var p = split(id);
    return (JB.SET_PATH[p[0]] || 'data/') + p[1] + '.js';
  };

  /* ── 폼 ──────────────────────────────────────────── */
  var COMMON_TAIL = [
    { k: 'ph',  label: '읍·면·동', type: 'text' },
    { k: 'lat', label: '위도',     type: 'text', req: true },
    { k: 'lng', label: '경도',     type: 'text', req: true },
    { k: 'addr', label: '주소',    type: 'text', w: 'full' },
    { k: 'tel', label: '전화',     type: 'text', w: 'full' }
  ];
  var SP_FIELDS = [
    { k: 'sp',    label: '특수학급 수',   type: 'number' },
    { k: 'spStu', label: '특수학급 학생', type: 'number' }
  ];

  /* 묶음마다 다루는 값이 달라서 폼도 갈린다 */
  var FIELDSETS = {
    sch: [
      { k: 'n', label: '학교명', type: 'text', req: true, w: 'full' },
      { k: 't', label: '학교급', type: 'select', req: true,
        opts: [['elem', '초등학교'], ['mid', '중학교'], ['high', '고등학교']] },
      { k: 'rural', label: '농촌유학', type: 'select',
        opts: [['', '미지정'], ['희망', '희망학교'], ['운영', '운영학교']] },
      { k: 'stu', label: '학생수', type: 'number' },
      { k: 'cls', label: '학급수', type: 'number' }
    ].concat(SP_FIELDS, COMMON_TAIL, [
      { k: 'desc', label: '메모', type: 'textarea', w: 'full',
        ph: '예) 2026학년도 2학기 농촌유학 종료' }
    ]),

    kinder: [
      { k: 'n', label: '유치원명', type: 'text', req: true, w: 'full' },
      { k: 't', label: '구분', type: 'hidden', value: 'kinder' },
      { k: 'kind', label: '설립 유형', type: 'select', req: true,
        opts: [['단설', '단설유치원'], ['병설', '병설유치원'], ['사립', '사립유치원']] },
      { k: 'found', label: '설립', type: 'select',
        opts: [['공립', '공립'], ['사립', '사립'], ['국립', '국립']] },
      { k: 'stu', label: '원아수', type: 'number' },
      { k: 'cls', label: '학급수', type: 'number' }
    ].concat(SP_FIELDS, COMMON_TAIL, [
      { k: 'closed', label: '휴원', type: 'select', opts: [['', '운영 중'], ['1', '휴원']] },
      { k: 'desc', label: '메모', type: 'textarea', w: 'full' }
    ]),

    special: [
      { k: 'n', label: '학교명', type: 'text', req: true, w: 'full' },
      { k: 't', label: '구분', type: 'hidden', value: 'special' },
      { k: 'found', label: '설립', type: 'select',
        opts: [['공립', '공립'], ['사립', '사립'], ['국립', '국립']] },
      { k: 'stu', label: '학생수', type: 'number' },
      { k: 'cls', label: '학급수', type: 'number' }
    ].concat(COMMON_TAIL, [
      { k: 'desc', label: '메모', type: 'textarea', w: 'full' }
    ])
  };

  function fieldsFor(setKey) { return FIELDSETS[setKey] || FIELDSETS.sch; }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  JB.editFormHtml = function (s, regionName, isNew, setKey, setChoices) {
    var what = setKey === 'kinder' ? '유치원' : setKey === 'special' ? '특수학교' : '학교';
    var pick = setChoices
      ? '<label class="ef ef-full"><span>어느 목록에 넣을까요 *</span><select name="_set">' +
          setChoices.map(function (k) {
            return '<option value="' + k + '"' + (k === setKey ? ' selected' : '') + '>' +
              (SET_NAME[k] || k) + '</option>';
          }).join('') + '</select></label>'
      : '';
    var rows = pick + fieldsFor(setKey).map(function (f) {
      var v = s[f.k];
      var input;
      if (f.type === 'hidden') {
        return '<input type="hidden" name="' + f.k + '" value="' + esc(f.value) + '">';
      } else if (f.type === 'select') {
        var cur = v === true ? '1' : String(v || '');
        input = '<select name="' + f.k + '">' + f.opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'textarea') {
        input = '<textarea name="' + f.k + '" rows="2" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
      } else {
        input = '<input name="' + f.k + '" type="' + (f.type === 'number' ? 'number' : 'text') +
          '" value="' + esc(v) + '"' + (f.type === 'number' ? ' min="0"' : '') + '>';
      }
      return '<label class="ef' + (f.w === 'full' ? ' ef-full' : '') + '">' +
        '<span>' + f.label + (f.req ? ' *' : '') + '</span>' + input + '</label>';
    }).join('');

    return '<div class="edit-form">' +
      '<div class="ef-head">' +
        '<h3>' + (isNew ? regionName + ' ' + what + ' 추가' : what + ' 정보 수정') + '</h3>' +
        '<button class="close" data-act="cancel" aria-label="닫기">×</button>' +
      '</div>' +
      '<div class="ef-grid">' + rows + '</div>' +
      '<div class="ef-coord">' +
        '<button class="btn small" data-act="pick">지도에서 위치 찍기</button>' +
        '<span class="ef-hint">지도를 클릭하면 위도·경도가 채워집니다</span>' +
      '</div>' +
      '<div class="ef-actions">' +
        (isNew ? '' : '<button class="btn small danger" data-act="delete">삭제</button>') +
        '<span class="ef-spacer"></span>' +
        '<button class="btn small" data-act="cancel">취소</button>' +
        '<button class="btn small primary" data-act="save">저장</button>' +
      '</div>' +
    '</div>';
  };

  /* 폼 값을 읽어 학교 객체로. 문제가 있으면 {error:'...'} */
  JB.readEditForm = function (root, orig, setKey) {
    var out = {};
    for (var k in orig) if (orig.hasOwnProperty(k) && k.charAt(0) !== '_') out[k] = orig[k];

    fieldsFor(setKey).forEach(function (f) {
      var el = root.querySelector('[name="' + f.k + '"]');
      if (!el) return;
      var v = (el.value || '').trim();
      if (f.k === 'closed') {
        if (v === '1') out.closed = true; else delete out.closed;
      } else if (f.type === 'number') {
        if (v === '') delete out[f.k]; else out[f.k] = parseInt(v, 10);
      } else if (f.k === 'lat' || f.k === 'lng') {
        out[f.k] = parseFloat(v);
      } else if (v === '') {
        delete out[f.k];
      } else {
        out[f.k] = v;
      }
    });

    var what = setKey === 'kinder' ? '유치원명' : '학교명';
    if (!out.n) return { error: what + '을 입력하세요.' };
    if (!JB.TYPES[out.t]) return { error: '학교급을 고르세요.' };
    if (!isFinite(out.lat) || !isFinite(out.lng)) return { error: '위도·경도가 숫자가 아닙니다.' };
    if (out.lat < 33 || out.lat > 39 || out.lng < 124 || out.lng > 132) {
      return { error: '위도·경도가 한반도 범위를 벗어났습니다.\n(위도 33~39, 경도 124~132)' };
    }
    if (out.stu != null && (out.stu < 0 || out.stu > 5000)) return { error: '학생수를 확인하세요.' };
    if (out.sp != null && out.sp > 0 && !(out.spStu > 0)) {
      return { error: '특수학급이 있으면 특수학급 학생수도 적어 주세요.' };
    }
    delete out.approx;          // 손으로 찍었으면 더는 추정 좌표가 아니다
    return { school: out };
  };

  /* ── 내보내기 ────────────────────────────────────── */
  var ORDER = ['n', 't', 'kind', 'found', 'ph', 'rural', 'lat', 'lng', 'approx', 'branch',
               'addr', 'tel', 'stu', 'cls', 'sp', 'spStu', 'lv', 'closed',
               'ox', 'oy', 'lock', 'dir', 'tags', 'desc'];
  var TRANSIENT = { outside: 1, inexact: 1, geoFailed: 1 };

  var SET_TITLE = { sch: '학교 데이터', kinder: '유치원 데이터', special: '특수학교 데이터' };

  JB.exportSet = function (id) {
    var p = split(id), setKey = p[0], key = p[1];
    var d = JB.setData(setKey, key), region = JB.regionByKey(key);
    var today = new Date().toISOString().slice(0, 10);
    var clean = d.schools.every(function (s) { return !s.approx; });
    var L = ['/* ' + (region ? region.name : key) + ' — ' + (SET_TITLE[setKey] || '데이터') + ' (2026학년도)',
             '   ' + (d.note || '') + ' */'];
    L = L.concat(setKey === 'sch'
      ? ["JB.registerRegion('" + key + "', {",
         "  updated: '" + today + "',",
         '  verified: ' + (clean ? 'true' : 'false') + ',']
      : ["JB.registerSet('" + setKey + "', '" + key + "', {",
         "  updated: '" + today + "',"]);
    L.push('  note: ' + JSON.stringify(d.note || '') + ',', '  schools: [');
    d.schools.forEach(function (s, i) {
      var o = {};
      ORDER.forEach(function (k) {
        if (s[k] === undefined || s[k] === null || s[k] === false || s[k] === '') return;
        o[k] = (k === 'lat' || k === 'lng') ? Number(Number(s[k]).toFixed(7)) : s[k];
      });
      Object.keys(s).forEach(function (k) {
        if (k.charAt(0) === '_' || TRANSIENT[k] || k in o) return;
        if (s[k] === undefined || s[k] === null || s[k] === false || s[k] === '') return;
        o[k] = s[k];
      });
      L.push('    ' + JSON.stringify(o) + (i < d.schools.length - 1 ? ',' : ''));
    });
    L.push('  ]', '});');
    return L.join('\n') + '\n';
  };

  JB.download = function (filename, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript;charset=utf-8' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };
})();

/* 편집 모드 — 폼·검증·내보내기
   주소 뒤에 ?edit=1 을 붙이면 켜지고, ?edit=0 이면 꺼집니다.
   서버가 없으므로 편집 내용은 이 브라우저에만 쌓이고,
   [내보내기]로 받은 파일을 저장소의 data/regions/ 에 덮어써야 확정됩니다. */
window.JB = window.JB || {};

(function () {
  'use strict';

  var STORE = 'jb.edits.v1';

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
     시군별로 schools 배열 통째를 담는다.
     원본 파일의 updated 값을 함께 적어 두어, 파일이 갱신되면
     묵은 편집분이 새 데이터를 덮어쓰지 않도록 막는다. */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(STORE, JSON.stringify(all)); return true; }
    catch (e) { alert('브라우저 저장 공간이 부족해 변경사항을 담지 못했습니다.\n[내보내기]로 먼저 파일을 받아 두세요.'); return false; }
  }

  JB.edits = load();

  JB.dirtyRegions = function () {
    return Object.keys(JB.edits).filter(function (k) { return JB.DATA[k]; });
  };

  JB.saveRegion = function (key) {
    JB.edits[key] = { base: JB.DATA[key].updated, at: new Date().toISOString(), schools: JB.DATA[key].schools };
    return save(JB.edits);
  };

  JB.discardEdits = function (key) {
    if (key) delete JB.edits[key]; else JB.edits = {};
    save(JB.edits);
  };

  /* 저장된 편집분을 데이터에 얹는다. 원본 파일이 그새 바뀌었으면 건너뛴다. */
  JB.applyEdits = function () {
    var stale = [];
    Object.keys(JB.edits).forEach(function (k) {
      var d = JB.DATA[k], e = JB.edits[k];
      if (!d) return;
      if (e.base !== d.updated) { stale.push(k); return; }
      d.schools = e.schools;
    });
    return stale;
  };

  /* ── 폼 ──────────────────────────────────────────── */
  var FIELDS = [
    { k: 'n',   label: '학교명',   type: 'text', req: true, w: 'full' },
    { k: 't',   label: '학교급',   type: 'select', req: true,
      opts: [['elem', '초등학교'], ['mid', '중학교'], ['high', '고등학교']] },
    { k: 'rural', label: '농촌유학', type: 'select',
      opts: [['', '미지정'], ['희망', '희망학교'], ['운영', '운영학교']] },
    { k: 'ph',  label: '읍·면·동', type: 'text' },
    { k: 'stu', label: '학생수',   type: 'number' },
    { k: 'cls', label: '학급수',   type: 'number' },
    { k: 'lat', label: '위도',     type: 'text', req: true },
    { k: 'lng', label: '경도',     type: 'text', req: true },
    { k: 'addr', label: '주소',    type: 'text', w: 'full' },
    { k: 'tel', label: '전화',     type: 'text', w: 'full' },
    { k: 'desc', label: '메모',    type: 'textarea', w: 'full',
      ph: '예) 2026학년도 2학기 농촌유학 종료' }
  ];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  JB.editFormHtml = function (s, regionName, isNew) {
    var rows = FIELDS.map(function (f) {
      var v = s[f.k];
      var input;
      if (f.type === 'select') {
        input = '<select name="' + f.k + '">' + f.opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (String(v || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
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
        '<h3>' + (isNew ? regionName + ' 학교 추가' : '학교 정보 수정') + '</h3>' +
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
  JB.readEditForm = function (root, orig) {
    var out = {};
    for (var k in orig) if (orig.hasOwnProperty(k) && k.charAt(0) !== '_') out[k] = orig[k];

    FIELDS.forEach(function (f) {
      var el = root.querySelector('[name="' + f.k + '"]');
      if (!el) return;
      var v = (el.value || '').trim();
      if (f.type === 'number') {
        if (v === '') delete out[f.k]; else out[f.k] = parseInt(v, 10);
      } else if (f.k === 'lat' || f.k === 'lng') {
        out[f.k] = parseFloat(v);
      } else if (v === '') {
        delete out[f.k];
      } else {
        out[f.k] = v;
      }
    });

    if (!out.n) return { error: '학교명을 입력하세요.' };
    if (!JB.TYPES[out.t]) return { error: '학교급을 고르세요.' };
    if (!isFinite(out.lat) || !isFinite(out.lng)) return { error: '위도·경도가 숫자가 아닙니다.' };
    if (out.lat < 33 || out.lat > 39 || out.lng < 124 || out.lng > 132) {
      return { error: '위도·경도가 한반도 범위를 벗어났습니다.\n(위도 33~39, 경도 124~132)' };
    }
    if (out.stu != null && (out.stu < 0 || out.stu > 5000)) return { error: '학생수를 확인하세요.' };
    delete out.approx;
    return { school: out };
  };

  /* ── 내보내기 ────────────────────────────────────── */
  var ORDER = ['n', 't', 'ph', 'rural', 'lat', 'lng', 'approx', 'branch',
               'addr', 'tel', 'stu', 'cls', 'ox', 'oy', 'lock', 'dir', 'tags', 'desc'];
  var TRANSIENT = { outside: 1, inexact: 1, geoFailed: 1 };

  JB.exportRegion = function (key) {
    var d = JB.DATA[key], region = JB.regionByKey(key);
    var today = new Date().toISOString().slice(0, 10);
    var L = ['/* ' + region.name + ' — 학교 데이터 (2026학년도)',
             '   ' + d.note + ' */',
             "JB.registerRegion('" + key + "', {",
             "  updated: '" + today + "',",
             '  verified: ' + (d.schools.every(function (s) { return !s.approx; }) ? 'true' : 'false') + ',',
             '  note: ' + JSON.stringify(d.note || '') + ',',
             '  schools: ['];
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

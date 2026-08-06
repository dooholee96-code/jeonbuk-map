/* 전북 농촌유학·학교 통합지도 — 메인 앱 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = {
    region: null,          // null = 전북 전체 개요
    kind: '',              // '' | elem | mid | high | op | hope | rural
    labelMode: 'auto',     // auto | all | rural | none
    query: '',
    selected: null
  };

  var map, overlays = [], maskPolygon = null, outlinePolys = [], items = [];
  var relayoutTimer = null;

  /* ══════════════════════════════════════════════════════════
     초기화
     ══════════════════════════════════════════════════════════ */
  function init() {
    map = new kakao.maps.Map($('#map'), {
      center: new kakao.maps.LatLng(35.75, 127.15),
      level: 12
    });
    map.setMaxLevel(13);

    buildRegionSelect();
    bindControls();
    trackHeaderHeight();
    if (window.innerWidth <= 860) $('#legend').removeAttribute('open');   // 좁은 화면에선 범례를 접어둔다

    ['idle', 'zoom_changed'].forEach(function (ev) {
      kakao.maps.event.addListener(map, ev, scheduleRelayout);
    });
    window.addEventListener('resize', scheduleRelayout);

    var fromHash = (location.hash || '').replace('#', '');
    selectRegion(fromHash && JB.regionByKey(fromHash) ? fromHash : null);
  }

  /* 헤더는 화면 폭에 따라 줄바꿈되므로 실제 높이를 CSS 변수로 되먹인다 */
  function trackHeaderHeight() {
    var header = document.querySelector('header');
    function apply() {
      document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
      scheduleRelayout();
    }
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(header);
    else window.addEventListener('resize', apply);
  }

  /* ══════════════════════════════════════════════════════════
     시군 탭
     ══════════════════════════════════════════════════════════ */
  function regionStats(key) {
    var d = JB.DATA[key];
    if (!d) return null;
    var s = d.schools;
    return {
      total: s.length,
      op: s.filter(function (x) { return x.rural === '운영'; }).length,
      hope: s.filter(function (x) { return x.rural === '희망'; }).length,
      approx: s.filter(function (x) { return x.approx; }).length,
      verified: d.verified
    };
  }

  /* 기본은 전북 전체, 선택창에서 시·군을 고르면 그 지역만 본다 */
  function buildRegionSelect() {
    var sel = $('#regionSel');
    var total = JB.REGIONS.reduce(function (a, r) {
      var st = regionStats(r.key); return a + (st ? st.total : 0);
    }, 0);

    var html = '<option value="">= 전북 전체 (' + total + '교) =</option>';
    [['시', /시$/], ['군', /군$/]].forEach(function (g) {
      var rows = JB.REGIONS.filter(function (r) { return g[1].test(r.name); })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
      if (!rows.length) return;
      html += '<optgroup label="' + g[0] + '부">';
      rows.forEach(function (r) {
        var st = regionStats(r.key);
        html += '<option value="' + r.key + '">' + r.name +
          (st ? ' (' + st.total + '교)' : ' (준비중)') + '</option>';
      });
      html += '</optgroup>';
    });
    sel.innerHTML = html;
    sel.onchange = function () { selectRegion(sel.value || null); };
  }

  function selectRegion(key) {
    state.region = key;
    state.selected = null;
    $('#detail').classList.remove('open');
    if ($('#regionSel').value !== (key || '')) $('#regionSel').value = key || '';
    location.hash = key || '';
    drawBoundary();
    render();
    fitRegion();
  }

  /* ══════════════════════════════════════════════════════════
     경계 마스킹 / 외곽선
     ══════════════════════════════════════════════════════════ */
  /* SDK 로드 이후에만 LatLng 을 만들 수 있으므로 지연 생성한다 */
  function worldRect() {
    return [
      new kakao.maps.LatLng(40, 120), new kakao.maps.LatLng(40, 135),
      new kakao.maps.LatLng(32, 135), new kakao.maps.LatLng(32, 120)
    ];
  }

  function ringToPath(ring) {
    return ring.map(function (c) { return new kakao.maps.LatLng(c[1], c[0]); });
  }

  function drawBoundary() {
    if (maskPolygon) { maskPolygon.setMap(null); maskPolygon = null; }
    outlinePolys.forEach(function (p) { p.setMap(null); });
    outlinePolys = [];

    if (!state.region) {
      // 전체 보기: 14개 시군 외곽선만
      JB.REGIONS.forEach(function (r) {
        var polys = JB.BOUNDARIES[r.name] || [];
        polys.forEach(function (p) {
          var poly = new kakao.maps.Polygon({
            path: ringToPath(p[0]),
            strokeWeight: 1.6, strokeColor: '#94a3b8', strokeOpacity: 0.9,
            fillColor: JB.DATA[r.key] ? '#22c55e' : '#cbd5e1',
            fillOpacity: JB.DATA[r.key] ? 0.10 : 0.06
          });
          poly.setMap(map);
          outlinePolys.push(poly);
        });
      });
      return;
    }

    var region = JB.regionByKey(state.region);
    var polys = JB.BOUNDARIES[region.name] || [];
    var holes = polys.map(function (p) { return ringToPath(p[0]); });

    maskPolygon = new kakao.maps.Polygon({
      path: [worldRect()].concat(holes),
      fillColor: '#ffffff', fillOpacity: 0.82,
      strokeWeight: 0
    });
    maskPolygon.setMap(map);

    holes.forEach(function (h) {
      var poly = new kakao.maps.Polygon({
        path: h, strokeWeight: 3, strokeColor: '#475569', strokeOpacity: 0.85,
        fillOpacity: 0
      });
      poly.setMap(map);
      outlinePolys.push(poly);
    });
  }

  function fitRegion() {
    if (!state.region) {
      map.setCenter(new kakao.maps.LatLng(35.75, 127.15));
      map.setLevel(11);
      return;
    }
    var region = JB.regionByKey(state.region);
    var polys = JB.BOUNDARIES[region.name] || [];
    var b = new kakao.maps.LatLngBounds();
    polys.forEach(function (p) {
      p[0].forEach(function (c) { b.extend(new kakao.maps.LatLng(c[1], c[0])); });
    });
    if (!b.isEmpty()) map.setBounds(b, 40, 40, 40, 40);
  }

  /* ══════════════════════════════════════════════════════════
     필터
     ══════════════════════════════════════════════════════════ */
  function activeSchools() {
    var keys = state.region ? [state.region] : Object.keys(JB.DATA);
    var list = [];
    keys.forEach(function (k) {
      var d = JB.DATA[k];
      if (!d) return;
      d.schools.forEach(function (s) {
        s._region = k;
        list.push(s);
      });
    });
    var q = state.query.trim().replace(/\s/g, '');
    var k = state.kind;
    return list.filter(function (s) {
      if (k === 'op' && s.rural !== '운영') return false;
      if (k === 'hope' && s.rural !== '희망') return false;
      if (k === 'rural' && !s.rural) return false;
      if ((k === 'elem' || k === 'mid' || k === 'high') && s.t !== k) return false;
      if (q && (s.n + (s.ph || '') + (s.addr || '')).replace(/\s/g, '').indexOf(q) < 0) return false;
      return true;
    });
  }

  function styleOf(s) {
    if (s.rural === '운영') return { cls: 'rural-op', dot: JB.RURAL.op.dot, text: JB.RURAL.op.text, mark: '★', weight: 100, boxed: true, size: 21 };
    if (s.rural === '희망') return { cls: 'rural-hope', dot: JB.RURAL.hope.dot, text: JB.RURAL.hope.text, mark: '☆', weight: 90, boxed: true, size: 21 };
    var t = JB.TYPES[s.t] || JB.TYPES.elem;
    return { cls: s.t, dot: t.dot, text: t.text, mark: '', weight: t.rank * 10, boxed: false, size: 17 };
  }

  /* ══════════════════════════════════════════════════════════
     지도 렌더링
     ══════════════════════════════════════════════════════════ */
  function clearOverlays() {
    overlays.forEach(function (o) { o.setMap(null); });
    overlays = [];
    items = [];
  }

  function render() {
    clearOverlays();
    var schools = activeSchools();

    schools.forEach(function (s) {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
      var st = styleOf(s);
      var pos = new kakao.maps.LatLng(s.lat, s.lng);

      var lineEl = document.createElement('div');
      lineEl.className = 'ov-line';
      lineEl.innerHTML = '<svg><line x1="0" y1="0" x2="0" y2="0" stroke="' + st.dot +
        '" stroke-width="' + (st.boxed ? 3.5 : 2.2) + '"/></svg>';

      var dotEl = document.createElement('div');
      dotEl.className = 'marker-dot dot-' + st.cls + (s.approx ? ' is-approx' : '') + (s.outside ? ' is-outside' : '');
      dotEl.title = s.n + (s.approx ? ' (좌표 미확정)' : '');

      var labelEl = document.createElement('div');
      labelEl.className = 'name-text txt-' + st.cls + (s.approx ? ' is-approx' : '');
      labelEl.textContent = (st.mark ? st.mark + ' ' : '') + s.n;

      [dotEl, labelEl].forEach(function (el) {
        el.addEventListener('click', function (e) { e.stopPropagation(); selectSchool(s); });
      });

      var line = new kakao.maps.CustomOverlay({ position: pos, content: lineEl, zIndex: 5, xAnchor: 0.5, yAnchor: 0.5 });
      var dot = new kakao.maps.CustomOverlay({ position: pos, content: dotEl, zIndex: 10, xAnchor: 0.5, yAnchor: 0.5 });
      var label = new kakao.maps.CustomOverlay({ position: pos, content: labelEl, zIndex: 20, xAnchor: 0.5, yAnchor: 0.5 });
      [line, dot, label].forEach(function (o) { o.setMap(map); overlays.push(o); });

      items.push({
        school: s, pos: pos, style: st,
        lineEl: lineEl, dotEl: dotEl, labelEl: labelEl,
        w: 0, h: 0,
        dir: s.dir,
        fixed: typeof s.ox === 'number',
        lock: !!s.lock,
        mox: s.ox || 0, moy: s.oy || 0,   // 데이터에 적힌 수동 오프셋 (재배치해도 보존)
        ox: s.ox || 0, oy: s.oy || 0,
        weight: st.weight + (s.rural ? 50 : 0)
      });
    });

    // 라벨 실측: 전부 DOM에 올린 뒤 한 번만 읽어 리플로를 1회로 묶는다
    items.forEach(function (it) {
      it.w = (it.labelEl.offsetWidth || 0) + 6;
      it.h = (it.labelEl.offsetHeight || 0) + 6;
      if (it.w <= 6) {   // 폰트 미로드 등으로 0이면 추정값으로 대체
        var est = JB.measureLabel(it.labelEl.textContent, it.style.size, true, it.style.boxed);
        it.w = est.w; it.h = est.h;
      }
    });

    relayout();
    renderList(schools);
    renderSummary(schools);
  }

  /* 범례·상세카드가 덮고 있는 영역에는 라벨을 놓지 않는다 */
  function reservedZones(mapEl) {
    var base = mapEl.getBoundingClientRect();
    return ['#legend', '#detail'].map(function (sel) {
      var el = $(sel);
      if (!el || !el.offsetParent) return null;
      var r = el.getBoundingClientRect();
      return { x1: r.left - base.left - 6, y1: r.top - base.top - 6,
               x2: r.right - base.left + 6, y2: r.bottom - base.top + 6 };
    }).filter(Boolean);
  }

  function scheduleRelayout() {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(relayout, 90);
  }

  function relayout() {
    if (!items.length) return;
    var proj = map.getProjection();
    var el = $('#map');
    var view = { w: el.clientWidth, h: el.clientHeight };
    var margin = 140;

    var visible = [];
    items.forEach(function (it) {
      var p = proj.containerPointFromCoords(it.pos);
      it.x = p.x; it.y = p.y;
      var mode = state.labelMode;
      if (mode === 'auto') mode = state.region ? 'all' : 'rural';   // 전북 전체에선 농촌유학만
      var showLabel = mode === 'all' || (mode === 'rural' && !!it.school.rural);
      it.inView = p.x > -margin && p.y > -margin && p.x < view.w + margin && p.y < view.h + margin;
      if (it.inView && showLabel) visible.push(it);
      else {
        it.labelEl.style.display = 'none';
        it.lineEl.style.display = 'none';
      }
    });

    JB.layoutLabels(visible, view, reservedZones(el));

    visible.forEach(function (it) {
      if (!it.placed) {
        it.labelEl.style.display = 'none';
        it.lineEl.style.display = 'none';
        return;
      }
      it.labelEl.style.display = '';
      it.labelEl.style.transform = 'translate(' + it.ox + 'px,' + it.oy + 'px)';

      var d = Math.hypot(it.ox, it.oy);
      if (d < 26) { it.lineEl.style.display = 'none'; return; }
      var end = JB.clipToRect(it.ox, it.oy, it.w, it.h);
      it.lineEl.style.display = '';
      var ln = it.lineEl.querySelector('line');
      ln.setAttribute('x2', end.x);
      ln.setAttribute('y2', end.y);
    });
  }

  /* ══════════════════════════════════════════════════════════
     사이드 패널
     ══════════════════════════════════════════════════════════ */
  function renderSummary(schools) {
    var byType = { elem: 0, mid: 0, high: 0 };
    var op = 0, hope = 0, approx = 0, stu = 0;
    schools.forEach(function (s) {
      byType[s.t] = (byType[s.t] || 0) + 1;
      if (s.rural === '운영') op++;
      if (s.rural === '희망') hope++;
      if (s.approx) approx++;
      if (s.stu) stu += s.stu;
    });

    var d = state.region ? JB.DATA[state.region] : null;

    $('#summary').innerHTML =
      '<div class="count-row">총 <b>' + schools.length + '</b>교' +
        '<span class="count-sub">학생 ' + stu.toLocaleString('ko-KR') + '명</span></div>' +
      '<div class="sum-stats">' +
        stat(byType.elem, '초', 'elem') +
        stat(byType.mid, '중', 'mid') +
        stat(byType.high, '고', 'high') +
        stat(op, '농촌유학 운영', 'op') +
        stat(hope, '희망', 'hope') +
      '</div>' +
      (approx ? '<div class="warn">좌표 미확정 ' + approx + '개 — 상단 <b>좌표 보정</b> 참고</div>' : '') +
      (d && d.note && !d.verified ? '<details class="note"><summary>데이터 출처·주의</summary><p>' + d.note + '</p></details>' : '');

    function stat(v, label, cls) {
      return '<div class="stat ' + (cls || '') + '"><b>' + v + '</b><span>' + label + '</span></div>';
    }
  }

  function renderList(schools) {
    var list = $('#list');
    if (!schools.length) {
      list.innerHTML = '<div class="empty">조건에 맞는 학교가 없습니다.</div>';
      return;
    }

    // 전북 전체에서는 시군별로, 시군 안에서는 읍·면·동별로 묶는다
    var groups = {};
    schools.forEach(function (s) {
      var g = state.region ? (s.ph || '기타') : (JB.regionByKey(s._region) || {}).name;
      (groups[g] = groups[g] || []).push(s);
    });

    var html = Object.keys(groups).sort(function (a, b) {
      return state.region ? a.localeCompare(b, 'ko')
                          : groups[b].length - groups[a].length;
    }).map(function (g) {
      var cards = groups[g].sort(function (a, b) {
        return (JB.TYPES[a.t].rank - JB.TYPES[b.t].rank) || a.n.localeCompare(b.n, 'ko');
      }).map(card).join('');
      return '<div class="group"><div class="group-h">' + esc(g) +
        ' <span>' + groups[g].length + '</span></div><ul>' + cards + '</ul></div>';
    }).join('');

    list.innerHTML = html;
    list.onclick = function (e) {
      var row = e.target.closest('.card');
      if (!row) return;
      var s = (JB.DATA[row.dataset.region].schools || []).filter(function (x) { return x.n === row.dataset.name; })[0];
      if (!s) return;
      selectSchool(s);
      map.setCenter(new kakao.maps.LatLng(s.lat, s.lng));
      if (!state.region) map.setLevel(Math.min(map.getLevel(), 7));
    };
  }

  function card(s) {
    var st = styleOf(s);
    var tags = '<span class="tag t-' + s.t + '">' + JB.TYPES[s.t].label + '</span>' +
      (s.rural ? '<span class="tag t-' + (s.rural === '운영' ? 'op' : 'hope') + '">' +
        st.mark + ' 농촌유학 ' + s.rural + '</span>' : '') +
      (s.branch ? '<span class="tag t-etc">분교</span>' : '') +
      (s.approx ? '<span class="tag t-warn">좌표 미확정</span>' : '');

    var meta = [];
    if (s.stu != null) meta.push(s.stu.toLocaleString('ko-KR') + '명');
    if (s.cls != null) meta.push(s.cls + '학급');

    return '<li class="card" data-name="' + esc(s.n) + '" data-region="' + s._region + '">' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="card-name">' + esc(s.n) + '</div>' +
      (s.addr ? '<div class="card-row i-map">' + esc(s.addr) + '</div>' : '') +
      (s.tel ? '<div class="card-row i-tel">' + esc(s.tel) + '</div>' : '') +
      (meta.length ? '<div class="card-row i-user">' + meta.join(' · ') + '</div>' : '') +
      '</li>';
  }

  function selectSchool(s) {
    state.selected = s;
    var st = styleOf(s);
    var region = JB.regionByKey(s._region);
    var panel = $('#detail');
    panel.classList.add('open');
    panel.innerHTML =
      '<button class="close" aria-label="닫기">×</button>' +
      '<div class="d-kind" style="color:' + st.text + '">' + (region ? region.name + ' · ' : '') +
        (s.ph ? s.ph + ' · ' : '') + JB.TYPES[s.t].label + '</div>' +
      '<h3>' + (st.mark ? st.mark + ' ' : '') + esc(s.n) + '</h3>' +
      (s.rural ? '<div class="d-rural ' + (s.rural === '운영' ? 'op' : 'hope') + '">농촌유학 ' + s.rural + '학교</div>' : '') +
      (s.addr ? '<p class="d-row"><b>주소</b> ' + esc(s.addr) + '</p>' : '') +
      (s.tel ? '<p class="d-row"><b>전화</b> ' + esc(s.tel) + '</p>' : '') +
      (s.stu != null ? '<p class="d-row"><b>학생수</b> ' + s.stu.toLocaleString('ko-KR') + '명' +
        (s.cls != null ? ' · ' + s.cls + '학급' : '') + '</p>' : '') +
      (s.tags && s.tags.length ? '<div class="d-tags">' + s.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      (s.desc ? '<p class="d-desc">' + esc(s.desc) + '</p>' : '') +
      '<p class="d-coord">' + s.lat.toFixed(6) + ', ' + s.lng.toFixed(6) +
        (s.approx ? ' <em class="warn-inline">읍·면 중심 임시 좌표</em>' : '') +
        (s.outside ? ' <em class="warn-inline">시군 경계 밖 — 소속 확인 필요</em>' : '') +
        (s.inexact ? ' <em class="warn-inline">검색 결과 이름 불일치</em>' : '') + '</p>' +
      '<div class="d-actions">' +
        '<button class="btn small" id="pickOnMap">지도에서 위치 지정</button>' +
      '</div>';

    panel.querySelector('.close').onclick = function () {
      panel.classList.remove('open'); state.selected = null; scheduleRelayout();
    };
    panel.querySelector('#pickOnMap').onclick = function () { startPick(s); };
    scheduleRelayout();
  }

  /* 지도 클릭으로 좌표 직접 지정 (카카오 검색이 막힌 환경에서도 쓸 수 있는 수단) */
  var pickHandler = null;
  function startPick(s) {
    $('#toast').textContent = '“' + s.n + '”의 실제 위치를 지도에서 클릭하세요. (ESC 취소)';
    $('#toast').classList.add('show');
    $('#map').classList.add('picking');

    function finish() {
      kakao.maps.event.removeListener(map, 'click', pickHandler);
      document.removeEventListener('keydown', onKey);
      $('#map').classList.remove('picking');
      $('#toast').classList.remove('show');
      pickHandler = null;
    }
    function onKey(e) { if (e.key === 'Escape') finish(); }

    pickHandler = function (e) {
      var ll = e.latLng;
      s.lat = ll.getLat();
      s.lng = ll.getLng();
      s.approx = false;
      s.outside = !JB.insideRegion(JB.regionByKey(s._region).name, s.lat, s.lng);
      JB.cacheSet(s._region, s.n, { ok: true, lat: s.lat, lng: s.lng, addr: s.addr || '', exact: true, outside: s.outside });
      finish();
      render();
      selectSchool(s);
    };
    kakao.maps.event.addListener(map, 'click', pickHandler);
    document.addEventListener('keydown', onKey);
  }

  /* ══════════════════════════════════════════════════════════
     컨트롤 바인딩
     ══════════════════════════════════════════════════════════ */
  function bindControls() {
    $('#typeSel').onchange = function (e) { state.kind = e.target.value; render(); };
    $('#labelMode').onchange = function (e) { state.labelMode = e.target.value; relayout(); };

    var t;
    $('#search').oninput = function (e) {
      clearTimeout(t);
      t = setTimeout(function () { state.query = e.target.value; render(); }, 200);
    };

    $('#btnGeocode').onclick = runGeocode;
    $('#btnExport').onclick = function () {
      if (!state.region) return alert('시군을 먼저 선택하세요.');
      JB.download(state.region + '.js', JB.exportRegion(state.region));
    };
    $('#btnResetCache').onclick = function () {
      if (!confirm('저장된 좌표 보정 결과를 지울까요? (원본 데이터 파일은 그대로입니다)')) return;
      JB.cacheClear(state.region);
      location.reload();
    };
    $('#btnFit').onclick = fitRegion;
    $('#panelToggle').onclick = function () { document.body.classList.toggle('panel-collapsed'); };

    kakao.maps.event.addListener(map, 'click', function () {
      if (!pickHandler) { $('#detail').classList.remove('open'); state.selected = null; scheduleRelayout(); }
    });
  }

  function runGeocode() {
    if (!state.region) return alert('시군을 먼저 선택하세요.');
    if (!(window.kakao && kakao.maps.services)) {
      return alert('카카오 장소검색(services)을 불러오지 못했습니다.\n' +
        '앱 키의 웹 플랫폼 도메인 등록을 확인하거나, 각 학교 상세에서 [지도에서 위치 지정]으로 직접 찍어주세요.');
    }
    var btn = $('#btnGeocode');
    btn.disabled = true;
    JB.geocodeRegion(state.region, function (done, total, name) {
      btn.textContent = '보정 중 ' + done + '/' + total + ' · ' + name;
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = '좌표 보정';
      render();
      var msg = '보정 완료: ' + res.fixed + '/' + res.done + '개';
      if (res.failed.length) msg += '\n실패: ' + res.failed.map(function (f) { return f.n; }).join(', ');
      var outside = JB.DATA[state.region].schools.filter(function (s) { return s.outside; });
      if (outside.length) msg += '\n경계 밖으로 찍힌 학교(소속 확인 필요): ' + outside.map(function (s) { return s.n; }).join(', ');
      msg += '\n\n결과가 맞으면 [데이터 내보내기]로 data/regions/' + state.region + '.js 를 교체하세요.';
      alert(msg);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (window.kakao && window.kakao.maps) kakao.maps.load(init);
  else document.getElementById('map').innerHTML =
    '<div class="fatal">카카오맵 SDK를 불러오지 못했습니다. 네트워크 또는 앱 키 도메인 설정을 확인하세요.</div>';
})();

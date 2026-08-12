/* 전북 학교·농촌유학 지도 — 메인 앱 (Leaflet + OpenStreetMap) */
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
    map = L.map('map', {
      center: [35.75, 127.15], zoom: 9, minZoom: 7, maxZoom: 18,
      zoomControl: true, attributionControl: true,
      worldCopyJump: false
    });
    buildTileSelect();
    applyTile(JB.tileKey());

    // 라벨은 마커 위, 지시선은 마커 아래로 그리기 위한 전용 레이어
    map.createPane('jbLines').style.zIndex = 610;
    map.createPane('jbDots').style.zIndex = 620;
    map.createPane('jbLabels').style.zIndex = 630;
    map.getPane('jbLines').style.pointerEvents = 'none';

    buildRegionSelect();
    bindControls();
    trackHeaderHeight();
    initSheet();
    if (window.innerWidth <= 860) $('#legend').removeAttribute('open');   // 좁은 화면에선 범례를 접어둔다

    map.on('moveend zoomend resize', scheduleRelayout);
    window.addEventListener('resize', scheduleRelayout);

    var fromHash = (location.hash || '').replace('#', '');
    selectRegion(fromHash && JB.regionByKey(fromHash) ? fromHash : null);
  }

  /* ══════════════════════════════════════════════════════════
     배경지도 — 키 없는 타일 몇 가지 중에서 고른다
     ══════════════════════════════════════════════════════════ */
  var tileLayer = null;

  function applyTile(key) {
    var t = JB.TILE_PRESETS[key] || JB.TILE_PRESETS[JB.TILE_DEFAULT];
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    if (t.url) {
      tileLayer = L.tileLayer(t.url, {
        attribution: t.attribution,
        subdomains: t.subdomains || 'abc',
        maxZoom: t.maxZoom || 19,
        detectRetina: true,
        className: t.gray ? 'jb-tiles-gray' : ''
      }).addTo(map);
    }
    map.setMaxZoom(t.maxZoom || 19);
    JB.setTileKey(key);
    if ($('#tileSel').value !== key) $('#tileSel').value = key;
  }

  function buildTileSelect() {
    var sel = $('#tileSel');
    sel.innerHTML = Object.keys(JB.TILE_PRESETS).map(function (k) {
      return '<option value="' + k + '">' + JB.TILE_PRESETS[k].label + '</option>';
    }).join('');
    sel.value = JB.tileKey();
    sel.onchange = function () { applyTile(sel.value); };
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
     모바일 바텀시트 — 목록을 지도 위로 끌어올려 본다
     peek(요약만) ↔ half(기본) ↔ full(목록 위주) 3단계.
     핸들을 끌면 따라오고, 놓으면 가까운 단계로 붙는다. 톡 치면 다음 단계.
     ══════════════════════════════════════════════════════════ */
  var sheet = { state: 'half', y: 0, dragging: false };
  var mqMobile = window.matchMedia('(max-width: 860px)');

  function sheetHeight() { return $('#panel').offsetHeight || window.innerHeight; }

  function snapY(state) {
    var h = sheetHeight();
    if (state === 'full') return 4;
    if (state === 'half') return Math.round(h * 0.42);
    return Math.max(0, h - 84);          // peek: 핸들 + 요약 한 줄만 남긴다
  }

  function applySheet(state, animate) {
    sheet.state = state;
    sheet.y = snapY(state);
    document.body.classList.toggle('sheet-dragging', animate === false);
    $('#panel').style.setProperty('--sheet-y', sheet.y + 'px');
    if (animate === false) requestAnimationFrame(function () {
      document.body.classList.remove('sheet-dragging');
    });
    scheduleRelayout();
  }

  function initSheet() {
    var handle = $('#sheetHandle');
    var panel = $('#panel');
    if (!handle) return;

    function sync() {
      if (mqMobile.matches) applySheet(sheet.state, false);
      else panel.style.removeProperty('--sheet-y');
    }
    sync();
    (mqMobile.addEventListener ? mqMobile.addEventListener('change', sync)
                               : mqMobile.addListener(sync));
    window.addEventListener('resize', sync);

    var startY = 0, startTop = 0, moved = 0;

    handle.addEventListener('pointerdown', function (e) {
      if (!mqMobile.matches) return;
      sheet.dragging = true; moved = 0;
      startY = e.clientY; startTop = sheet.y;
      document.body.classList.add('sheet-dragging');
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', function (e) {
      if (!sheet.dragging) return;
      var dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dy));
      var h = sheetHeight();
      sheet.y = Math.min(Math.max(4, startTop + dy), Math.max(0, h - 84));
      panel.style.setProperty('--sheet-y', sheet.y + 'px');
      e.preventDefault();
    });

    function end() {
      if (!sheet.dragging) return;
      sheet.dragging = false;
      document.body.classList.remove('sheet-dragging');
      if (moved < 6) {                       // 드래그가 아니라 탭 → 다음 단계로
        var order = ['peek', 'half', 'full'];
        applySheet(order[(order.indexOf(sheet.state) + 1) % order.length]);
        return;
      }
      var best = 'half', bestD = Infinity;   // 가장 가까운 단계에 붙인다
      ['peek', 'half', 'full'].forEach(function (st) {
        var d = Math.abs(snapY(st) - sheet.y);
        if (d < bestD) { bestD = d; best = st; }
      });
      applySheet(best);
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* 목록에서 학교를 고르면 지도를 봐야 하므로 시트를 접는다.
     상세카드가 위를 덮으므로 half 로는 지도가 남지 않아 peek 까지 내린다.
     목록 스크롤 위치는 그대로라 핸들을 올리면 보던 자리로 돌아온다. */
  function collapseForMap() {
    if (mqMobile.matches && sheet.state !== 'peek') applySheet('peek');
  }

  /* 시트가 지도 아래쪽을 덮고 있으므로, 그만큼을 여백으로 잡아야
     시군 전체나 선택한 학교가 시트 뒤로 숨지 않는다. */
  function sheetCover() {
    if (!mqMobile.matches) return 0;
    return Math.max(0, sheetHeight() - sheet.y);
  }

  function fitOptions() {
    var c = sheetCover();
    return c ? { paddingTopLeft: [20, 20], paddingBottomRight: [20, c + 16] }
             : { padding: [30, 30] };
  }

  /* 좌표를 시트에 가리지 않는 영역의 한가운데로 */
  function focusOn(lat, lng, zoom) {
    map.setView([lat, lng], zoom);
    var c = sheetCover();
    if (c) map.panBy([0, c / 2], { animate: false });
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
  var WORLD_RECT = [[40, 118], [40, 137], [31, 137], [31, 118]];

  /* GeoJSON 링([lng,lat])을 Leaflet 순서([lat,lng])로 */
  function ringToPath(ring) {
    return ring.map(function (c) { return [c[1], c[0]]; });
  }

  function drawBoundary() {
    if (maskPolygon) { map.removeLayer(maskPolygon); maskPolygon = null; }
    outlinePolys.forEach(function (p) { map.removeLayer(p); });
    outlinePolys = [];

    if (!state.region) {
      // 전북 전체: 14개 시군 외곽선만 옅게
      JB.REGIONS.forEach(function (r) {
        (JB.BOUNDARIES[r.name] || []).forEach(function (p) {
          outlinePolys.push(L.polygon(ringToPath(p[0]), {
            interactive: false,
            weight: 1.4, color: '#64748b', opacity: 0.85,
            fillColor: JB.DATA[r.key] ? '#22c55e' : '#cbd5e1',
            fillOpacity: JB.DATA[r.key] ? 0.08 : 0.04
          }).addTo(map));
        });
      });
      return;
    }

    // 시군 선택: 바깥을 흰색으로 덮고 해당 시군만 뚫는다 (Leaflet 은 첫 링이 외곽, 나머지가 구멍)
    var region = JB.regionByKey(state.region);
    var holes = (JB.BOUNDARIES[region.name] || []).map(function (p) { return ringToPath(p[0]); });

    maskPolygon = L.polygon([WORLD_RECT].concat(holes), {
      interactive: false, stroke: false, fillColor: '#ffffff', fillOpacity: 0.78
    }).addTo(map);

    holes.forEach(function (h) {
      outlinePolys.push(L.polygon(h, {
        interactive: false, weight: 2.5, color: '#475569', opacity: 0.85, fill: false
      }).addTo(map));
    });
  }

  function fitRegion() {
    var names = state.region ? [JB.regionByKey(state.region).name]
                             : JB.REGIONS.map(function (r) { return r.name; });
    var pts = [];
    names.forEach(function (nm) {
      (JB.BOUNDARIES[nm] || []).forEach(function (p) {
        p[0].forEach(function (c) { pts.push([c[1], c[0]]); });
      });
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts), fitOptions());
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
    overlays.forEach(function (o) { map.removeLayer(o); });
    overlays = [];
    items = [];
  }

  /* 크기 0인 divIcon 마커 위에 내용을 올린다.
     Leaflet 이 좌표 갱신과 줌 애니메이션을 처리해 주므로 위치 계산이 필요 없다. */
  function pointOverlay(latlng, el, pane, interactive) {
    var m = L.marker(latlng, {
      pane: pane,
      interactive: !!interactive,
      keyboard: false,
      icon: L.divIcon({ className: 'jb-ov', html: '', iconSize: [0, 0], iconAnchor: [0, 0] })
    });
    m.on('add', function () { m.getElement().appendChild(el); });
    return m;
  }

  function render() {
    clearOverlays();
    var schools = activeSchools();

    schools.forEach(function (s) {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
      var st = styleOf(s);
      var pos = L.latLng(s.lat, s.lng);

      var lineEl = document.createElement('div');
      lineEl.className = 'ov-line';
      lineEl.innerHTML = '<svg><line x1="0" y1="0" x2="0" y2="0" stroke="' + st.dot +
        '" stroke-width="' + (st.boxed ? 3.5 : 2.2) + '"/></svg>';

      var dotEl = document.createElement('div');
      dotEl.className = 'marker-dot dot-' + st.cls + (s.approx ? ' is-approx' : '');
      dotEl.title = s.n + (s.approx ? ' (좌표 미확정)' : '');

      var labelEl = document.createElement('div');
      labelEl.className = 'name-text txt-' + st.cls + (s.approx ? ' is-approx' : '');
      labelEl.textContent = (st.mark ? st.mark + ' ' : '') + s.n;

      [dotEl, labelEl].forEach(function (el) {
        el.addEventListener('click', function (e) { e.stopPropagation(); selectSchool(s); });
      });

      [pointOverlay(pos, lineEl, 'jbLines', false),
       pointOverlay(pos, dotEl, 'jbDots', true),
       pointOverlay(pos, labelEl, 'jbLabels', true)
      ].forEach(function (o) { o.addTo(map); overlays.push(o); });

      items.push({
        school: s, pos: pos, style: st,
        lineEl: lineEl, dotEl: dotEl, labelEl: labelEl,
        w: 0, h: 0,
        dir: s.dir,
        fixed: typeof s.ox === 'number',
        lock: !!s.lock,
        mox: s.ox || 0, moy: s.oy || 0,   // 데이터에 적힌 수동 오프셋 (재배치해도 보존)
        ox: s.ox || 0, oy: s.oy || 0,
        baseWeight: st.weight + (s.rural ? 50 : 0),
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
    return ['#legend', '#detail', mqMobile.matches ? '#panel' : null].filter(Boolean).map(function (sel) {
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
    var el = $('#map');
    var view = { w: el.clientWidth, h: el.clientHeight };
    var margin = 140;

    var visible = [];
    items.forEach(function (it) {
      var p = map.latLngToContainerPoint(it.pos);
      it.x = p.x; it.y = p.y;
      var mode = state.labelMode;
      if (mode === 'auto') mode = state.region ? 'all' : 'rural';   // 전북 전체에선 농촌유학만
      var isSel = it.school === state.selected;
      var showLabel = isSel || mode === 'all' || (mode === 'rural' && !!it.school.rural);
      it.weight = it.baseWeight + (isSel ? 1000 : 0);
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
      it.labelEl.style.transform = 'translate(-50%,-50%) translate(' + it.ox + 'px,' + it.oy + 'px)';

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
      (approx ? '<div class="warn">좌표 미확정 ' + approx + '개 — 데이터 파일의 <code>lat/lng</code> 를 확인하세요.</div>' : '') +
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
      collapseForMap();
      selectSchool(s);
      focusOn(s.lat, s.lng, Math.max(map.getZoom(), state.region ? 12 : 11));
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

  /* 선택한 학교가 지도의 어느 점인지 보이게 한다 */
  function highlight(s) {
    items.forEach(function (it) {
      it.dotEl.classList.toggle('is-selected', it.school === s);
    });
  }

  function selectSchool(s) {
    state.selected = s;
    highlight(s);
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
        (s.approx ? ' <em class="warn-inline">좌표 미확정</em>' : '') + '</p>';

    panel.querySelector('.close').onclick = function () {
      panel.classList.remove('open'); state.selected = null; highlight(null); scheduleRelayout();
    };
    scheduleRelayout();
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

    $('#btnFit').onclick = fitRegion;
    $('#panelToggle').onclick = function () { document.body.classList.toggle('panel-collapsed'); };

    map.on('click', function () {
      $('#detail').classList.remove('open');
      state.selected = null;
      highlight(null);
      scheduleRelayout();
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (window.L && L.map) init();
  else document.getElementById('map').innerHTML =
    '<div class="fatal"><h3>지도 라이브러리를 불러오지 못했습니다</h3>' +
    '<p><code>assets/vendor/leaflet/leaflet.js</code> 파일이 있는지 확인하세요. ' +
    '폴더 구조를 그대로 두고 <code>index.html</code> 을 열어야 합니다.</p></div>';
})();

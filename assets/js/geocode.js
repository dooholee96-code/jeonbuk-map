/* 좌표 보정 도구
   1) approx(임시 좌표) 항목을 카카오 장소검색으로 실제 좌표에 맞춘다
   2) 결과를 localStorage 에 캐시한다
   3) 시군 경계 밖으로 찍힌 항목을 "확인 필요"로 표시한다
   4) 보정된 데이터를 data/regions/<key>.js 형식으로 내보낸다 */
window.JB = window.JB || {};

(function () {
  'use strict';

  var CACHE_KEY = 'jb.geocache.v1';

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* quota */ }
  }

  JB.cache = loadCache();

  JB.cacheGet = function (regionKey, name) { return JB.cache[regionKey + '|' + name] || null; };
  JB.cacheSet = function (regionKey, name, val) {
    JB.cache[regionKey + '|' + name] = val;
    saveCache(JB.cache);
  };
  JB.cacheClear = function (regionKey) {
    Object.keys(JB.cache).forEach(function (k) {
      if (!regionKey || k.indexOf(regionKey + '|') === 0) delete JB.cache[k];
    });
    saveCache(JB.cache);
  };

  /* ── 경계 내부 판정 (ray casting, 외곽 링만 사용) ── */
  JB.insideRegion = function (regionName, lat, lng) {
    var polys = JB.BOUNDARIES[regionName];
    if (!polys) return true;
    for (var p = 0; p < polys.length; p++) {
      var ring = polys[p][0];
      var inside = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };

  /* ── 카카오 장소검색 ── */
  function places() {
    if (!window.kakao || !kakao.maps || !kakao.maps.services) return null;
    return new kakao.maps.services.Places();
  }

  JB.geocodeOne = function (regionName, name) {
    return new Promise(function (resolve) {
      var ps = places();
      if (!ps) return resolve({ ok: false, reason: 'services 라이브러리를 불러오지 못했습니다' });
      var query = regionName + ' ' + name;
      ps.keywordSearch(query, function (data, status) {
        if (status !== kakao.maps.services.Status.OK || !data.length) {
          return resolve({ ok: false, reason: '검색 결과 없음' });
        }
        // 시군 이름이 주소에 들어있고 학교명이 일치하는 결과를 우선
        var pick = data.filter(function (d) {
          var addr = (d.road_address_name || '') + ' ' + (d.address_name || '');
          return addr.indexOf(regionName) >= 0 && d.place_name.replace(/\s/g, '').indexOf(name.replace(/\s/g, '')) >= 0;
        })[0]
          || data.filter(function (d) {
            return ((d.road_address_name || '') + ' ' + (d.address_name || '')).indexOf(regionName) >= 0;
          })[0]
          || data[0];

        resolve({
          ok: true,
          lat: parseFloat(pick.y),
          lng: parseFloat(pick.x),
          addr: pick.road_address_name || pick.address_name || '',
          tel: pick.phone || '',
          matched: pick.place_name,
          exact: pick.place_name.replace(/\s/g, '') === name.replace(/\s/g, '')
        });
      });
    });
  };

  /* 한 시군의 approx 항목을 순차 보정. onProgress(done, total, msg) */
  JB.geocodeRegion = function (regionKey, onProgress) {
    var region = JB.regionByKey(regionKey);
    var data = JB.DATA[regionKey];
    if (!region || !data) return Promise.resolve({ done: 0, fixed: 0, failed: [] });

    var targets = data.schools.filter(function (s) { return s.approx || !s.lat; });
    var failed = [], fixed = 0, i = 0;

    function step() {
      if (i >= targets.length) return Promise.resolve();
      var s = targets[i++];
      onProgress && onProgress(i, targets.length, s.n);

      var cached = JB.cacheGet(regionKey, s.n);
      if (cached) {
        applyResult(s, cached);
        if (cached.ok) fixed++; else failed.push({ n: s.n, reason: cached.reason });
        return new Promise(function (r) { setTimeout(r, 0); }).then(step);
      }

      return JB.geocodeOne(region.name, s.n).then(function (res) {
        if (res.ok && !JB.insideRegion(region.name, res.lat, res.lng)) {
          res.outside = true;
        }
        JB.cacheSet(regionKey, s.n, res);
        applyResult(s, res);
        if (res.ok) fixed++; else failed.push({ n: s.n, reason: res.reason });
        return new Promise(function (r) { setTimeout(r, 130); });   // 호출 간격
      }).then(step);
    }

    function applyResult(s, res) {
      if (!res.ok) { s.geoFailed = res.reason; return; }
      s.lat = res.lat;
      s.lng = res.lng;
      s.approx = false;
      s.addr = s.addr || res.addr;
      s.tel = s.tel || res.tel;
      s.outside = !!res.outside;
      s.inexact = !res.exact;
    }

    return step().then(function () {
      return { done: targets.length, fixed: fixed, failed: failed };
    });
  };

  /* ── 내보내기: data/regions/<key>.js 소스 생성 ── */
  JB.exportRegion = function (regionKey) {
    var region = JB.regionByKey(regionKey);
    var data = JB.DATA[regionKey];
    var lines = [];
    lines.push('/* ' + region.name + ' — 학교 데이터');
    lines.push('   내보낸 날짜: ' + new Date().toISOString().slice(0, 10));
    lines.push('   n=이름 t=학교급 ph=읍면동 rural=농촌유학 approx=좌표미확정 ox/oy=라벨 수동 오프셋 */');
    lines.push("JB.registerRegion('" + regionKey + "', {");
    lines.push("  updated: '" + new Date().toISOString().slice(0, 10) + "',");
    lines.push('  verified: ' + (data.schools.every(function (s) { return !s.approx; }) ? 'true' : 'false') + ',');
    lines.push('  note: ' + JSON.stringify(data.note || ''), '  schools: [');
    // 앞으로 필드가 늘어도 빠지지 않도록, 내부용(_로 시작)만 빼고 전부 내보낸다
    var ORDER = ['n', 't', 'ph', 'rural', 'hope2', 'lat', 'lng', 'approx', 'branch',
                 'addr', 'tel', 'stu', 'cls', 'ox', 'oy', 'lock', 'dir', 'tags', 'desc'];
    var TRANSIENT = { outside: 1, inexact: 1, geoFailed: 1 };   // 실행 중에만 쓰는 표시
    data.schools.forEach(function (s, idx) {
      var o = {};
      ORDER.forEach(function (k) {
        if (s[k] === undefined || s[k] === null || s[k] === false) return;
        o[k] = (k === 'lat' || k === 'lng') ? Number(s[k].toFixed(7)) : s[k];
      });
      Object.keys(s).forEach(function (k) {                      // 목록에 없는 새 필드도 살린다
        if (k.charAt(0) === '_' || TRANSIENT[k] || k in o) return;
        if (s[k] === undefined || s[k] === null || s[k] === false) return;
        o[k] = s[k];
      });
      lines.push('    ' + JSON.stringify(o) + (idx < data.schools.length - 1 ? ',' : ''));
    });
    lines.push('  ]');
    lines.push('});');
    return lines.join('\n') + '\n';
  };

  JB.download = function (filename, text) {
    var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };
})();

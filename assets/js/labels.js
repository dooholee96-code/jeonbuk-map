/* 라벨 자동 배치 엔진
   시군마다 ox/oy 를 손으로 잡지 않아도 되도록, 화면 좌표 기준으로
   겹치지 않는 위치를 탐색해 지시선(callout)과 함께 배치한다.
   수동으로 ox/oy 를 준 항목은 그 자리를 먼저 시도하고, 다른 라벨에 막히면
   같은 방향의 빈 자리로 비켜난다 (lock:true 면 그대로 고정). */
window.JB = window.JB || {};

(function () {
  'use strict';

  var measureCanvas = document.createElement('canvas');
  var measureCtx = measureCanvas.getContext('2d');

  /* 라벨 텍스트의 화면 크기(px) 추정 */
  JB.measureLabel = function (text, fontSize, bold, boxed) {
    measureCtx.font = (bold ? '900 ' : '700 ') + fontSize + 'px "Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    var w = measureCtx.measureText(text).width;
    var h = fontSize * 1.25;
    if (boxed) { w += 30; h += 14; }   // 알약 박스 padding
    return { w: Math.ceil(w) + 4, h: Math.ceil(h) + 4 };
  };

  /* 후보 방향: 오른쪽 → 왼쪽 → 위 → 아래 → 대각선 순 (읽기 좋은 순서) */
  var DIRS = [
    [1, 0], [-1, 0], [0, -1], [0, 1],
    [0.72, -0.72], [-0.72, -0.72], [0.72, 0.72], [-0.72, 0.72],
    [0.95, -0.32], [-0.95, -0.32], [0.95, 0.32], [-0.95, 0.32],
    [0.32, -0.95], [-0.32, -0.95], [0.32, 0.95], [-0.32, 0.95]
  ];
  var RADII = [30, 42, 56, 74, 96, 124, 158, 200];

  /* 데이터에 dir 힌트가 있으면 그 방향부터 시도한다 (남원 원본의 8방향 배치를 계승) */
  var DIR_HINT = {
    r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1],
    tr: [0.72, -0.72], tl: [-0.72, -0.72], br: [0.72, 0.72], bl: [-0.72, 0.72]
  };
  function dirsFor(hint) {
    var h = DIR_HINT[hint];
    if (!h) return DIRS;
    var rest = DIRS.filter(function (d) { return d[0] !== h[0] || d[1] !== h[1]; });
    return [h].concat(rest);
  }

  function overlaps(a, b, pad) {
    return !(a.x2 + pad < b.x1 || b.x2 + pad < a.x1 || a.y2 + pad < b.y1 || b.y2 + pad < a.y1);
  }

  function rectAt(cx, cy, w, h) {
    return { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
  }

  /**
   * @param items    [{ x, y, w, h, ox, oy, weight }]  x,y = 마커의 화면 좌표
   * @param view     { w, h }  지도 컨테이너 크기
   * @param reserved [{x1,y1,x2,y2}]  범례·상세카드 등 라벨이 침범하면 안 되는 영역
   * @returns 각 item 에 ox/oy(최종 오프셋), placed(bool) 를 채워 돌려준다.
   */
  JB.layoutLabels = function (items, view, reserved) {
    var occupied = (reserved || []).slice();
    var pad = 4;

    // 마커 점 자체를 장애물로 등록 (라벨이 다른 학교 점을 덮지 않도록)
    items.forEach(function (it) {
      occupied.push(rectAt(it.x, it.y, 26, 26));
    });

    // 중요한 것(농촌유학 → 고 → 중 → 초)부터, 같은 급이면 위쪽부터 자리를 잡는다
    var order = items.slice().sort(function (a, b) {
      return (b.weight - a.weight) || (a.y - b.y);
    });

    function free(r) {
      if (r.x1 < 10 || r.y1 < 10 || r.x2 > view.w - 10 || r.y2 > view.h - 10) return false;
      for (var i = 0; i < occupied.length; i++) if (overlaps(r, occupied[i], pad)) return false;
      return true;
    }

    function place(it, ox, oy, rect) {
      it.ox = Math.round(ox); it.oy = Math.round(oy);
      it.placed = true; occupied.push(rect);
    }

    order.forEach(function (it) {
      // 1) 데이터에 ox/oy 가 있으면 그 자리를 먼저 시도한다.
      //    lock:true 면 겹치더라도 무조건 그 자리를 쓴다.
      if (it.fixed) {
        var mr = rectAt(it.x + it.mox, it.y + it.moy, it.w, it.h);
        if (it.lock || free(mr)) { place(it, it.mox, it.moy, mr); return; }
        // 수동 위치가 막혔으면 그 방향을 힌트 삼아 자동 탐색으로 넘어간다
        if (!it._hint) {
          var len = Math.hypot(it.mox, it.moy) || 1;
          it._hint = [it.mox / len, it.moy / len];
        }
      }

      // 2) 자동 탐색: 가까운 반경부터 겹치지 않는 방향을 찾는다
      var dirs = it._hint ? [it._hint].concat(dirsFor(it.dir)) : dirsFor(it.dir);
      for (var ri = 0; ri < RADII.length; ri++) {
        var rad = RADII[ri];
        for (var di = 0; di < dirs.length; di++) {
          var ox = dirs[di][0] * (rad + it.w * 0.35);
          var oy = dirs[di][1] * rad;
          var r = rectAt(it.x + ox, it.y + oy, it.w, it.h);
          if (free(r)) { place(it, ox, oy, r); return; }
        }
      }

      // 3) 끝내 자리가 없으면 라벨을 감춘다 (점은 남으므로 확대하면 다시 나타난다)
      it.placed = false;
    });

    return items;
  };

  /* 지시선이 라벨 박스를 뚫고 들어가지 않도록, 사각형 경계에서 끊는다 */
  JB.clipToRect = function (ox, oy, w, h) {
    if (ox === 0 && oy === 0) return { x: 0, y: 0 };
    var hw = w / 2 + 2, hh = h / 2 + 2;
    var len = Math.hypot(ox, oy);
    var ux = ox / len, uy = oy / len;
    var tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
    var ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
    var t = Math.max(0, len - Math.min(tx, ty));
    return { x: Math.round(ux * t), y: Math.round(uy * t) };
  };
})();

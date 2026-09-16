# -*- coding: utf-8 -*-
"""무주 유·초·중·고 취합 체크리스트 — 포스트잇 위젯

파일 하나로 도는 작은 창입니다. 브라우저·설치·서버 없이
더블클릭하면 바로 뜨고, 기본은 '항상 맨 앞' 으로 고정돼 있습니다.
(표 전체로 보려면 같은 저장소의 muju-check.html 을 쓰세요.
 두 파일은 같은 형식의 JSON 을 주고받습니다.)

  📌   맨 앞 고정 켜기/끄기 — 끄면 테두리 있는 보통 창이 됩니다
  건 이름 ▾  건 고르기·추가·이름 바꾸기·대상 학교급·마감일·삭제
  ▾ / ▴  제목줄만 남기고 접기
  줄 누르기  미제출 → ✓ 제출 → – 해당없음
  머리줄 끌기  창 옮기기 · 오른쪽 아래 모서리 끌기  크기 바꾸기
  오른쪽 단추  글씨 크기, 저장 파일 위치, 백업 등

체크 내용은 이 파일과 같은 폴더의 muju_check_data.json 에 저장됩니다.
"""

import json
import os
import sys
import datetime
import tkinter as tk
import tkinter.font as tkfont
from tkinter import simpledialog, messagebox, filedialog

# ── 학교 데이터 ──────────────────────────────────────────────
# 초·중·고 18곳: data/regions/muju.js 와 같은 값(2026학년도 전북교육청 현황).
# 유치원 6곳: 공개 검색으로 확인되는 범위. 관내는 단설 1 + 병설 8 = 9곳으로
#   알려져 있으니 3곳가량이 빠져 있습니다. chk=0 은 확인이 덜 된 곳(⚠).
#   빠진 곳은 아래 목록에 한 줄 더하거나, 창에서 [오른쪽 단추 → 학교 추가] 하세요.
SCHOOLS = [
    {"n": "무주반디유치원",         "t": "kinder", "ph": "무주읍", "chk": 1},
    {"n": "설천초등학교병설유치원", "t": "kinder", "ph": "설천면", "chk": 0},
    {"n": "안성초등학교병설유치원", "t": "kinder", "ph": "안성면", "chk": 1},
    {"n": "부남초등학교병설유치원", "t": "kinder", "ph": "부남면", "chk": 1},
    {"n": "적상초등학교병설유치원", "t": "kinder", "ph": "적상면", "chk": 1},
    {"n": "괴목초등학교병설유치원", "t": "kinder", "ph": "적상면", "chk": 1},

    {"n": "무주중앙초등학교", "t": "elem", "ph": "무주읍", "chk": 1},
    {"n": "무주초등학교",     "t": "elem", "ph": "무주읍", "chk": 1},
    {"n": "무풍초등학교",     "t": "elem", "ph": "무풍면", "chk": 1},
    {"n": "부남초등학교",     "t": "elem", "ph": "부남면", "chk": 1},
    {"n": "구천초등학교",     "t": "elem", "ph": "설천면", "chk": 1},
    {"n": "설천초등학교",     "t": "elem", "ph": "설천면", "chk": 1},
    {"n": "안성초등학교",     "t": "elem", "ph": "안성면", "chk": 1},
    {"n": "괴목초등학교",     "t": "elem", "ph": "적상면", "chk": 1},
    {"n": "적상초등학교",     "t": "elem", "ph": "적상면", "chk": 1},

    {"n": "무주중학교", "t": "mid", "ph": "무주읍", "chk": 1},
    {"n": "부남중학교", "t": "mid", "ph": "부남면", "chk": 1},
    {"n": "설천중학교", "t": "mid", "ph": "설천면", "chk": 1},
    {"n": "안성중학교", "t": "mid", "ph": "안성면", "chk": 1},
    {"n": "적상중학교", "t": "mid", "ph": "적상면", "chk": 1},

    {"n": "무주고등학교",   "t": "high", "ph": "무주읍", "chk": 1},
    {"n": "설천고등학교",   "t": "high", "ph": "설천면", "chk": 1},
    {"n": "안성고등학교",   "t": "high", "ph": "안성면", "chk": 1},
    {"n": "푸른꿈고등학교", "t": "high", "ph": "안성면", "chk": 1},
]

TYPES = {
    "kinder": {"label": "유치원",   "short": "유", "color": "#0d9488", "rank": 0},
    "elem":   {"label": "초등학교", "short": "초", "color": "#3b82f6", "rank": 1},
    "mid":    {"label": "중학교",   "short": "중", "color": "#ef4444", "rank": 2},
    "high":   {"label": "고등학교", "short": "고", "color": "#8b5cf6", "rank": 3},
}
TORDER = ["kinder", "elem", "mid", "high"]
SHORT_TO_TYPE = {"유": "kinder", "초": "elem", "중": "mid", "고": "high"}

MARKS = ["·", "✓", "–"]                      # 0 미제출 · 1 제출 · 2 해당없음
MARK_NEXT_HINT = ["눌러서 제출 처리", "눌러서 해당없음", "눌러서 미제출"]
MAX_CASES = 6

# 포스트잇 색
C_NOTE   = "#fdf6c3"   # 바탕(연노랑)
C_HEAD   = "#fde68a"   # 머리줄
C_LINE   = "#e7d9a0"
C_ROW    = "#fffdf0"
C_ROW_ALT= "#fdf9e3"
C_DONE   = "#dcfce7"
C_INK    = "#3f3a25"
C_MUTED  = "#8a8266"
C_ACCENT = "#15803d"
C_TODO   = "#b91c1c"

HERE = os.path.dirname(os.path.abspath(sys.argv[0]))
DATA = os.path.join(HERE, "muju_check_data.json")


def now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def new_case(name):
    return {
        "id": "c%s" % datetime.datetime.now().strftime("%H%M%S%f"),
        "name": name,
        "due": "",
        "scope": {"kinder": True, "elem": True, "mid": True, "high": True},
        "open": False,
        "marks": {},
    }


def fresh_state():
    return {
        "v": 1,
        "cases": [new_case("취합 1"), new_case("취합 2"), new_case("취합 3")],
        "extra": [],
        "filter": {"q": "", "types": {t: True for t in TORDER}, "onlyTodo": False},
        "compact": False,
        "noteHidden": False,
        "active": None,
        "ui": {"x": None, "y": None, "w": 330, "h": 520, "pin": True,
               "font": 10, "collapsed": False},
        "savedAt": "",
    }


class Note(object):
    """포스트잇 창 하나."""

    # ── 시작 ─────────────────────────────────────────────
    def __init__(self, root):
        self.root = root
        self.S = self.load()
        self.pin = bool(self.ui("pin", True))
        self.collapsed = bool(self.ui("collapsed", False))
        self._save_job = None
        self._rows = []

        self.pick_fonts()
        root.title("무주 취합 체크리스트")
        root.configure(bg=C_NOTE)
        root.minsize(240, 24)          # 접었을 때 제목줄만 남을 수 있게
        self.place_window()
        root.update_idletasks()        # 실제 크기가 잡힌 뒤에 고정 상태를 적용합니다
        self.build()
        self.apply_pin(self.pin, first=True)
        self.render()

        root.protocol("WM_DELETE_WINDOW", self.quit)
        root.bind("<Configure>", self.on_configure)
        root.bind("<Escape>", lambda e: self.toggle_collapse())

    def ui(self, key, default=None):
        return self.S.get("ui", {}).get(key, default)

    def set_ui(self, key, val):
        self.S.setdefault("ui", {})[key] = val

    def pick_fonts(self):
        fams = set(tkfont.families())
        name = None
        for cand in ("맑은 고딕", "Malgun Gothic", "Apple SD Gothic Neo",
                     "AppleGothic", "NanumGothic", "Noto Sans CJK KR",
                     "Noto Sans KR", "UnDotum", "DejaVu Sans"):
            if cand in fams:
                name = cand
                break
        size = int(self.ui("font", 10) or 10)
        self.f_base = tkfont.Font(family=name, size=size)
        self.f_bold = tkfont.Font(family=name, size=size, weight="bold")
        self.f_small = tkfont.Font(family=name, size=max(7, size - 2))
        self.f_done = tkfont.Font(family=name, size=size, overstrike=1)
        self.f_badge = tkfont.Font(family=name, size=max(7, size - 2), weight="bold")

    def place_window(self):
        w = int(self.ui("w", 330) or 330)
        h = int(self.ui("h", 520) or 520)
        x, y = self.ui("x"), self.ui("y")
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        if x is None or y is None:
            x, y = sw - w - 40, 80
        # 화면 밖으로 나가 있으면 끌어옵니다(모니터를 뺐을 때 대비)
        x = max(0, min(int(x), max(0, sw - 120)))
        y = max(0, min(int(y), max(0, sh - 80)))
        self.root.geometry("%dx%d+%d+%d" % (w, h, x, y))

    def dialog(self, fn, *args, **kw):
        """맨 앞 고정을 잠깐 풀고 대화상자를 엽니다.

        Windows 에서는 고정된 창이 대화상자보다 위에 남아 입력창이 가려집니다.
        """
        was = bool(self.pin)
        if was:
            self.root.attributes("-topmost", False)
        try:
            return fn(*args, **kw)
        finally:
            if was:
                self.root.attributes("-topmost", True)

    def current_geo(self):
        """지금 창 위치·크기. 아직 안 떴으면 저장해 둔 값으로 돌려줍니다."""
        w, h = self.root.winfo_width(), self.root.winfo_height()
        x, y = self.root.winfo_x(), self.root.winfo_y()
        if w <= 1 or h <= 1:
            w = int(self.ui("w", 330) or 330)
            h = int(self.ui("h", 520) or 520)
            x = int(self.ui("x", 0) or 0)
            y = int(self.ui("y", 0) or 0)
        return "%dx%d+%d+%d" % (w, h, x, y)

    # ── 저장·불러오기 ────────────────────────────────────
    def load(self):
        if not os.path.exists(DATA):
            return fresh_state()
        try:
            with open(DATA, "r", encoding="utf-8") as fp:
                o = json.load(fp)
            if not o.get("cases"):
                raise ValueError("건 목록이 비어 있습니다")
        except Exception as err:                      # 깨진 파일은 옆으로 치웁니다
            try:
                os.replace(DATA, DATA + ".bak")
            except OSError:
                pass
            messagebox.showwarning(
                "무주 취합 체크리스트",
                "저장 파일을 읽지 못해 새로 시작합니다.\n"
                "이전 파일은 muju_check_data.json.bak 으로 남겨 뒀습니다.\n\n%s" % err)
            return fresh_state()

        base = fresh_state()
        o.setdefault("extra", [])
        o.setdefault("filter", base["filter"])
        o["filter"].setdefault("types", base["filter"]["types"])
        o["filter"].setdefault("onlyTodo", False)
        o.setdefault("ui", base["ui"])
        for k, v in base["ui"].items():
            o["ui"].setdefault(k, v)
        for c in o["cases"]:
            c.setdefault("marks", {})
            c.setdefault("scope", {t: True for t in TORDER})
            c.setdefault("due", "")
            for t in TORDER:
                c["scope"].setdefault(t, True)
        return o

    def save(self, delay=False):
        """delay=True 면 잠깐 모았다가 한 번만 씁니다(창 끌 때 등)."""
        if delay:
            if self._save_job:
                self.root.after_cancel(self._save_job)
            self._save_job = self.root.after(400, self.save)
            return
        self._save_job = None
        self.S["savedAt"] = now_iso()
        tmp = DATA + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fp:
                json.dump(self.S, fp, ensure_ascii=False, indent=1)
            os.replace(tmp, DATA)                     # 쓰다 말고 꺼져도 안 깨지게
        except OSError as err:
            self.set_status("저장 실패: %s" % err, bad=True)
            return
        self.set_status("저장됨 " + datetime.datetime.now().strftime("%H:%M:%S"))

    # ── 목록 계산 ────────────────────────────────────────
    def all_schools(self):
        rows = list(SCHOOLS) + list(self.S.get("extra", []))
        return sorted(rows, key=lambda s: (TYPES.get(s["t"], {}).get("rank", 9),
                                           s.get("ph", ""), s["n"]))

    def cases(self):
        return self.S["cases"]

    def active_case(self):
        for c in self.cases():
            if c["id"] == self.S.get("active"):
                return c
        return self.cases()[0]

    @staticmethod
    def in_scope(c, s):
        return bool(c["scope"].get(s["t"], True))

    @staticmethod
    def mark_of(c, s):
        return int(c["marks"].get(s["n"], 0))

    def stat(self, c):
        total = done = 0
        for s in self.all_schools():
            if not self.in_scope(c, s):
                continue
            m = self.mark_of(c, s)
            if m == 2:
                continue
            total += 1
            if m == 1:
                done += 1
        return done, total, total - done

    def rows_for(self, c):
        out = []
        for s in self.all_schools():
            if not self.in_scope(c, s):
                continue
            if self.S["filter"].get("onlyTodo") and self.mark_of(c, s) != 0:
                continue
            out.append(s)
        return out

    # ── 화면 만들기 ──────────────────────────────────────
    def build(self):
        r = self.root

        # 머리줄 — 끌어서 창 옮기기
        self.head = tk.Frame(r, bg=C_HEAD)
        self.head.pack(fill="x", side="top")
        self.b_pin = tk.Label(self.head, text="📌", bg=C_HEAD, fg=C_INK,
                              font=self.f_base, padx=4, cursor="hand2")
        self.b_pin.pack(side="left", padx=(4, 2), pady=3)
        self.b_pin.bind("<Button-1>", lambda e: self.toggle_pin())

        self.l_name = tk.Label(self.head, text="", bg=C_HEAD, fg=C_INK,
                               font=self.f_bold, cursor="hand2")
        self.l_name.pack(side="left")
        self.l_name.bind("<Button-1>", self.case_menu)

        self.l_prog = tk.Label(self.head, text="", bg=C_HEAD, fg=C_MUTED,
                               font=self.f_small)
        self.l_prog.pack(side="left", padx=4)

        for txt, cmd in (("✕", self.quit), ("▾", self.toggle_collapse)):
            b = tk.Label(self.head, text=txt, bg=C_HEAD, fg=C_INK,
                         font=self.f_base, padx=4, cursor="hand2")
            b.pack(side="right", pady=3)
            b.bind("<Button-1>", lambda e, f=cmd: f())
            if txt == "▾":
                self.b_fold = b

        for w in (self.head, self.l_prog):
            w.bind("<Button-1>", self.drag_start, add="+")
            w.bind("<B1-Motion>", self.drag_move, add="+")
        self.head.bind("<Double-Button-1>", lambda e: self.toggle_collapse())
        self.head.bind("<Button-3>", self.main_menu)
        self.l_prog.bind("<Button-3>", self.main_menu)

        # 몸통 — 학교 목록
        self.body = tk.Frame(r, bg=C_NOTE)
        self.body.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(self.body, bg=C_NOTE, highlightthickness=0, bd=0)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.bar = tk.Scrollbar(self.body, orient="vertical", command=self.canvas.yview,
                                width=10)
        self.bar.pack(side="right", fill="y")
        self.canvas.configure(yscrollcommand=self.bar.set)
        self.list = tk.Frame(self.canvas, bg=C_NOTE)
        self.win = self.canvas.create_window((0, 0), window=self.list, anchor="nw")
        self.list.bind("<Configure>",
                       lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>",
                         lambda e: self.canvas.itemconfig(self.win, width=e.width))
        for w in (self.canvas, self.list):
            w.bind("<MouseWheel>", self.on_wheel)       # Windows·macOS
            w.bind("<Button-4>", self.on_wheel)         # X11
            w.bind("<Button-5>", self.on_wheel)
            w.bind("<Button-3>", self.main_menu)

        # 바닥줄
        self.foot = tk.Frame(r, bg=C_HEAD)
        self.foot.pack(fill="x", side="bottom")
        self.v_todo = tk.BooleanVar(value=bool(self.S["filter"].get("onlyTodo")))
        self.c_todo = tk.Checkbutton(
            self.foot, text="미제출만", variable=self.v_todo, command=self.toggle_todo,
            bg=C_HEAD, fg=C_INK, activebackground=C_HEAD, activeforeground=C_INK,
            selectcolor=C_NOTE, font=self.f_small, bd=0, highlightthickness=0, padx=2)
        self.c_todo.pack(side="left", padx=(4, 0), pady=2)

        self.b_copy = tk.Label(self.foot, text="미제출 복사", bg=C_HEAD, fg=C_INK,
                               font=self.f_small, padx=5, cursor="hand2")
        self.b_copy.pack(side="right", padx=4)
        self.b_copy.bind("<Button-1>", lambda e: self.copy_todo())

        self.l_status = tk.Label(self.foot, text="", bg=C_HEAD, fg=C_MUTED,
                                 font=self.f_small, anchor="w")
        self.l_status.pack(side="left", padx=6)

        # 오른쪽 아래 모서리 — 끌어서 크기 바꾸기
        self.grip = tk.Label(self.foot, text="◢", bg=C_HEAD, fg=C_MUTED,
                             font=self.f_small, cursor="bottom_right_corner")
        self.grip.pack(side="right")
        self.grip.bind("<Button-1>", self.resize_start)
        self.grip.bind("<B1-Motion>", self.resize_move)

    # ── 그리기 ───────────────────────────────────────────
    def render(self):
        c = self.active_case()
        done, total, todo = self.stat(c)

        self.l_name.configure(text=c["name"] + " ▾")
        due = ""
        if c.get("due"):
            d = self.due_days(c["due"])
            if d is not None:
                due = " · 마감 %s%s" % (c["due"][5:].replace("-", "/"),
                                      (" (%d일 지남)" % -d) if d < 0 else
                                      (" (오늘)" if d == 0 else " (D-%d)" % d))
        self.l_prog.configure(text="%d/%d · 남은 %d%s" % (done, total, todo, due),
                              fg=C_TODO if todo else C_ACCENT)

        for w in self.list.winfo_children():
            w.destroy()
        self._rows = []

        rows = self.rows_for(c)
        if not rows:
            msg = "전부 제출됐습니다 ✓" if total and done == total else "대상 학교가 없습니다."
            tk.Label(self.list, text=msg, bg=C_NOTE, fg=C_MUTED, font=self.f_small,
                     pady=14).pack(fill="x")
        for i, s in enumerate(rows):
            self.row_widget(s, c, i)

        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def row_widget(self, s, c, i):
        m = self.mark_of(c, s)
        meta = TYPES.get(s["t"], {"short": "?", "color": "#94a3b8"})
        bg = C_DONE if m == 1 else (C_ROW if i % 2 == 0 else C_ROW_ALT)

        fr = tk.Frame(self.list, bg=bg, cursor="hand2")
        fr.pack(fill="x")
        lbs = [fr]

        lb = tk.Label(fr, text=MARKS[m], bg=bg, width=2,
                      fg=C_ACCENT if m == 1 else C_MUTED, font=self.f_base)
        lb.pack(side="left"); lbs.append(lb)

        bd = tk.Label(fr, text=meta["short"], bg=meta["color"], fg="white",
                      font=self.f_badge, width=2, padx=1)
        bd.pack(side="left", padx=(0, 4), pady=1); lbs.append(bd)

        nm = tk.Label(fr, text=s["n"] + (" ⚠" if s.get("chk") == 0 else ""),
                      bg=bg, fg=C_MUTED if m else C_INK, anchor="w",
                      font=self.f_done if m else self.f_base)
        nm.pack(side="left", fill="x", expand=True); lbs.append(nm)

        if s.get("ph"):
            ph = tk.Label(fr, text=s["ph"], bg=bg, fg=C_MUTED, font=self.f_small)
            ph.pack(side="right", padx=4); lbs.append(ph)

        for w in lbs:
            w.bind("<Button-1>", lambda e, sc=s: self.cycle(sc))
            w.bind("<Button-3>", lambda e, sc=s: self.row_menu(e, sc))
            w.bind("<MouseWheel>", self.on_wheel)
            w.bind("<Button-4>", self.on_wheel)
            w.bind("<Button-5>", self.on_wheel)
        self._rows.append(fr)

    @staticmethod
    def due_days(due):
        try:
            d = datetime.date.fromisoformat(due)
        except ValueError:
            return None
        return (d - datetime.date.today()).days

    def set_status(self, text, bad=False):
        if hasattr(self, "l_status"):
            self.l_status.configure(text=text, fg=C_TODO if bad else C_MUTED)

    # ── 조작 ─────────────────────────────────────────────
    def cycle(self, s):
        c = self.active_case()
        c["marks"][s["n"]] = (self.mark_of(c, s) + 1) % 3
        self.save()
        self.render()

    def toggle_todo(self):
        self.S["filter"]["onlyTodo"] = bool(self.v_todo.get())
        self.save()
        self.render()

    def copy_todo(self):
        c = self.active_case()
        done, total, _ = self.stat(c)
        todo = [s["n"] for s in self.all_schools()
                if self.in_scope(c, s) and self.mark_of(c, s) == 0]
        head = "[%s]%s 미제출 %d곳 (제출 %d/%d)" % (
            c["name"], (" 마감 " + c["due"]) if c.get("due") else "",
            len(todo), done, total)
        body = "\n".join("· " + n for n in todo) if todo else "· 없음 — 전부 제출됐습니다."
        self.root.clipboard_clear()
        self.root.clipboard_append(head + "\n" + body)
        self.root.update_idletasks()
        self.set_status("미제출 %d곳 복사됨" % len(todo))

    # ── 맨 앞 고정 ───────────────────────────────────────
    def toggle_pin(self):
        self.apply_pin(not self.pin)

    def apply_pin(self, on, first=False):
        """켜면 테두리 없는 포스트잇 + 항상 위, 끄면 보통 창(작업표시줄에 뜸)."""
        self.pin = bool(on)
        geo = self.current_geo()
        self.root.withdraw()
        try:
            self.root.overrideredirect(self.pin)
        except tk.TclError:
            pass
        self.root.attributes("-topmost", self.pin)
        self.root.deiconify()
        self.root.geometry(geo)
        self.b_pin.configure(fg=C_ACCENT if self.pin else C_MUTED)
        self.b_pin.configure(text="📌" if self.pin else "📍")
        self.set_ui("pin", self.pin)
        if not first:
            self.set_status("맨 앞 고정 " + ("켜짐" if self.pin else "꺼짐"))
            self.save()

    def toggle_collapse(self):
        self.collapsed = not self.collapsed
        if self.collapsed:
            self.set_ui("h", self.root.winfo_height())
            self.body.pack_forget()
            self.foot.pack_forget()
            self.root.geometry("%dx%d" % (self.root.winfo_width(),
                                          self.head.winfo_reqheight()))
            self.b_fold.configure(text="▴")
        else:
            self.body.pack(fill="both", expand=True)
            self.foot.pack(fill="x", side="bottom")
            self.root.geometry("%dx%d" % (self.root.winfo_width(),
                                          int(self.ui("h", 520) or 520)))
            self.b_fold.configure(text="▾")
        self.set_ui("collapsed", self.collapsed)
        self.save(delay=True)

    # ── 창 끌기·크기 ─────────────────────────────────────
    def drag_start(self, ev):
        self._dx, self._dy = ev.x_root - self.root.winfo_x(), ev.y_root - self.root.winfo_y()

    def drag_move(self, ev):
        self.root.geometry("+%d+%d" % (ev.x_root - self._dx, ev.y_root - self._dy))

    def resize_start(self, ev):
        self._rw = (ev.x_root, ev.y_root, self.root.winfo_width(), self.root.winfo_height())

    def resize_move(self, ev):
        x0, y0, w0, h0 = self._rw
        self.root.geometry("%dx%d" % (max(250, w0 + ev.x_root - x0),
                                      max(120, h0 + ev.y_root - y0)))

    def on_configure(self, ev):
        if ev.widget is not self.root:
            return
        self.set_ui("x", self.root.winfo_x())
        self.set_ui("y", self.root.winfo_y())
        self.set_ui("w", self.root.winfo_width())
        if not self.collapsed:
            self.set_ui("h", self.root.winfo_height())
        self.save(delay=True)

    def on_wheel(self, ev):
        step = -1 if getattr(ev, "delta", 0) > 0 or ev.num == 4 else 1
        self.canvas.yview_scroll(step * 2, "units")

    # ── 메뉴 ─────────────────────────────────────────────
    def case_menu(self, ev=None):
        m = tk.Menu(self.root, tearoff=0, font=self.f_base)
        cur = self.active_case()
        for c in self.cases():
            done, total, _ = self.stat(c)
            m.add_command(label="%s %s  %d/%d" % ("●" if c is cur else "○",
                                                  c["name"], done, total),
                          command=lambda cc=c: self.pick_case(cc))
        m.add_separator()
        if len(self.cases()) < MAX_CASES:
            m.add_command(label="+ 건 추가", command=self.add_case)
        m.add_command(label="이름 바꾸기…", command=self.rename_case)
        m.add_command(label="마감일…", command=self.set_due)

        sub = tk.Menu(m, tearoff=0, font=self.f_base)
        self._scope_vars = {}
        for t in TORDER:
            v = tk.BooleanVar(value=cur["scope"].get(t, True))
            self._scope_vars[t] = v
            sub.add_checkbutton(label=TYPES[t]["label"], variable=v,
                                command=lambda tt=t: self.toggle_scope(tt))
        m.add_cascade(label="대상 학교급", menu=sub)
        m.add_separator()
        m.add_command(label="이 건 체크 비우기", command=self.clear_case)
        if len(self.cases()) > 1:
            m.add_command(label="이 건 삭제", command=self.del_case)
        self.popup(m, ev)

    def row_menu(self, ev, s):
        c = self.active_case()
        m = tk.Menu(self.root, tearoff=0, font=self.f_base)
        m.add_command(label=s["n"], state="disabled")
        m.add_separator()
        for i, lab in enumerate(("미제출로", "제출로 ✓", "해당없음으로 –")):
            m.add_command(label=lab, command=lambda ii=i, sc=s: self.set_mark(sc, ii))
        if s.get("user"):
            m.add_separator()
            m.add_command(label="목록에서 지우기", command=lambda sc=s: self.del_school(sc))
        self.popup(m, ev)

    def main_menu(self, ev):
        m = tk.Menu(self.root, tearoff=0, font=self.f_base)
        m.add_command(label="맨 앞 고정 " + ("끄기" if self.pin else "켜기"),
                      command=self.toggle_pin)
        m.add_command(label="접기/펴기", command=self.toggle_collapse)
        m.add_separator()
        m.add_command(label="글씨 크게", command=lambda: self.zoom(1))
        m.add_command(label="글씨 작게", command=lambda: self.zoom(-1))
        m.add_separator()
        m.add_command(label="학교 추가…", command=self.add_school)
        m.add_command(label="백업 파일로 내보내기…", command=self.export)
        m.add_command(label="백업 파일 불러오기…", command=self.import_file)
        m.add_command(label="저장 폴더 열기", command=self.open_folder)
        m.add_separator()
        m.add_command(label="끝내기", command=self.quit)
        self.popup(m, ev)

    def popup(self, m, ev):
        try:
            if ev is not None:
                m.tk_popup(ev.x_root, ev.y_root)
            else:
                m.tk_popup(self.root.winfo_rootx() + 10, self.root.winfo_rooty() + 24)
        finally:
            m.grab_release()

    # ── 메뉴가 부르는 일들 ───────────────────────────────
    def pick_case(self, c):
        self.S["active"] = c["id"]
        self.save()
        self.render()

    def add_case(self):
        name = self.dialog(simpledialog.askstring, "건 추가", "취합할 일의 이름",
                           initialvalue="취합 %d" % (len(self.cases()) + 1),
                           parent=self.root)
        if not name:
            return
        c = new_case(name.strip())
        self.cases().append(c)
        self.S["active"] = c["id"]
        self.save()
        self.render()

    def rename_case(self):
        c = self.active_case()
        name = self.dialog(simpledialog.askstring, "이름 바꾸기", "건 이름",
                           initialvalue=c["name"], parent=self.root)
        if name and name.strip():
            c["name"] = name.strip()
            self.save()
            self.render()

    def set_due(self):
        c = self.active_case()
        due = self.dialog(simpledialog.askstring, "마감일", "YYYY-MM-DD (비우면 지웁니다)",
                          initialvalue=c.get("due", ""), parent=self.root)
        if due is None:
            return
        due = due.strip()
        if due and self.due_days(due) is None:
            self.dialog(messagebox.showwarning, "마감일", "2026-09-30 처럼 적어 주세요.", parent=self.root)
            return
        c["due"] = due
        self.save()
        self.render()

    def toggle_scope(self, t):
        c = self.active_case()
        c["scope"][t] = bool(self._scope_vars[t].get())
        self.save()
        self.render()

    def clear_case(self):
        c = self.active_case()
        if self.dialog(messagebox.askyesno, "체크 비우기", '"%s" 체크를 전부 지울까요?' % c["name"],
                        parent=self.root):
            c["marks"] = {}
            self.save()
            self.render()

    def del_case(self):
        c = self.active_case()
        if not self.dialog(messagebox.askyesno, "건 삭제", '"%s" 을(를) 삭제할까요?' % c["name"],
                            parent=self.root):
            return
        self.cases().remove(c)
        self.S["active"] = self.cases()[0]["id"]
        self.save()
        self.render()

    def set_mark(self, s, m):
        self.active_case()["marks"][s["n"]] = m
        self.save()
        self.render()

    def add_school(self):
        name = self.dialog(simpledialog.askstring, "학교 추가", "학교(유치원) 이름", parent=self.root)
        if not name or not name.strip():
            return
        name = name.strip()
        if any(s["n"] == name for s in self.all_schools()):
            self.dialog(messagebox.showinfo, "학교 추가", "이미 목록에 있습니다.", parent=self.root)
            return
        short = self.dialog(simpledialog.askstring, "학교 추가", "학교급 — 유 / 초 / 중 / 고",
                            initialvalue="유", parent=self.root)
        t = SHORT_TO_TYPE.get((short or "").strip())
        if not t:
            self.dialog(messagebox.showwarning, "학교 추가", "유·초·중·고 중에서 골라 주세요.", parent=self.root)
            return
        ph = self.dialog(simpledialog.askstring, "학교 추가", "읍·면 (비워도 됩니다)",
                         initialvalue="무주읍", parent=self.root) or ""
        self.S["extra"].append({"n": name, "t": t, "ph": ph.strip(), "chk": 1, "user": True})
        self.save()
        self.render()

    def del_school(self, s):
        if not self.dialog(messagebox.askyesno, "학교 삭제", "%s 을(를) 목록에서 지울까요?" % s["n"],
                            parent=self.root):
            return
        self.S["extra"] = [e for e in self.S["extra"] if e["n"] != s["n"]]
        for c in self.cases():
            c["marks"].pop(s["n"], None)
        self.save()
        self.render()

    def zoom(self, d):
        size = max(8, min(16, int(self.ui("font", 10) or 10) + d))
        self.set_ui("font", size)
        for f, delta, bold in ((self.f_base, 0, 0), (self.f_bold, 0, 1),
                               (self.f_small, -2, 0), (self.f_done, 0, 0),
                               (self.f_badge, -2, 1)):
            f.configure(size=max(7, size + delta))
        self.save()
        self.render()

    def export(self):
        path = self.dialog(
            filedialog.asksaveasfilename,
            parent=self.root, title="백업 파일로 내보내기", defaultextension=".json",
            initialfile="muju-check-%s.json" % datetime.date.today().isoformat(),
            filetypes=[("JSON", "*.json")])
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as fp:
                json.dump(self.S, fp, ensure_ascii=False, indent=1)
            self.set_status("내보냈습니다")
        except OSError as err:
            self.dialog(messagebox.showerror, "내보내기", str(err), parent=self.root)

    def import_file(self):
        path = self.dialog(filedialog.askopenfilename, parent=self.root, title="백업 파일 불러오기",
                           filetypes=[("JSON", "*.json"), ("모든 파일", "*.*")])
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as fp:
                o = json.load(fp)
            if not o.get("cases"):
                raise ValueError("건 목록이 없습니다")
        except Exception as err:
            self.dialog(messagebox.showerror, "불러오기", "읽지 못했습니다.\n%s" % err, parent=self.root)
            return
        if not self.dialog(messagebox.askyesno, "불러오기", "지금 체크를 덮어씁니다. 계속할까요?",
                            parent=self.root):
            return
        o.setdefault("ui", self.S.get("ui", {}))       # 창 위치는 그대로 둡니다
        o["ui"] = self.S.get("ui", o["ui"])
        self.S = o
        self.load_fixups()
        self.v_todo.set(bool(self.S["filter"].get("onlyTodo")))
        self.save()
        self.render()

    def load_fixups(self):
        base = fresh_state()
        self.S.setdefault("extra", [])
        self.S.setdefault("filter", base["filter"])
        self.S["filter"].setdefault("onlyTodo", False)
        for c in self.S["cases"]:
            c.setdefault("marks", {})
            c.setdefault("scope", {t: True for t in TORDER})
            c.setdefault("due", "")

    def open_folder(self):
        try:
            if sys.platform.startswith("win"):
                os.startfile(HERE)                     # noqa: S606 (Windows 전용)
            elif sys.platform == "darwin":
                os.system('open "%s"' % HERE)
            else:
                os.system('xdg-open "%s" &' % HERE)
        except Exception:
            self.dialog(messagebox.showinfo, "저장 폴더", HERE, parent=self.root)

    def quit(self):
        if self._save_job:
            self.root.after_cancel(self._save_job)
        self.save()
        self.root.destroy()


def main():
    root = tk.Tk()
    Note(root)
    root.mainloop()


if __name__ == "__main__":
    main()

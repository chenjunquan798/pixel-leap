"""生成 1200×630 的 OG / 分享预览图（PRD 9.7 / FR-15）。

像素风刻意用整数矩形拼出来，和 canvas 里的画风保持一致。
运行： python tools/make_og.py
"""

from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "og-image.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# 霞光层配色（与 src/render/palette.js 的 ZONES[1] 对齐）
DUSK = ["#2A1140", "#3D1849", "#541C50", "#6E2352", "#8E3050", "#B0434C", "#CE5C45", "#E87A46"]
CREAM = (255, 243, 214)
GOLD = (255, 209, 102)
INK = (23, 16, 31)
PINK = (224, 68, 111)
TEAL = (46, 196, 182)
BLUE = (91, 140, 255)
ORANGE = (232, 135, 60)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def hex_rgb(h):
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


img = Image.new("RGB", (W, H), DUSK[0])
d = ImageDraw.Draw(img, "RGBA")

# 天空：14 条色带 + 抖动边界
stops = [hex_rgb(c) for c in DUSK]
bands = 14
bh = H / bands
for i in range(bands):
    pos = (i / (bands - 1)) * (len(stops) - 1)
    lo = int(pos)
    hi = min(len(stops) - 1, lo + 1)
    col = lerp(stops[lo], stops[hi], pos - lo)
    d.rectangle([0, int(i * bh), W, int((i + 1) * bh) + 1], fill=col)

for i in range(1, bands):
    y = int(i * bh)
    for row in range(4):
        for x in range(0, W, 2):
            if (x // 2 + row) % 2 == 0:
                pos = ((i - 1) / (bands - 1)) * (len(stops) - 1)
                lo = int(pos)
                hi = min(len(stops) - 1, lo + 1)
                d.point((x, y + row), fill=lerp(stops[lo], stops[hi], pos - lo))
                d.point((x + 1, y + row), fill=lerp(stops[lo], stops[hi], pos - lo))

# 落日
sun_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(sun_layer)
for r, a in ((300, 26), (220, 36), (160, 48), (120, 70), (86, 120), (66, 200)):
    sd.ellipse([880 - r, 470 - r, 880 + r, 470 + r], fill=(255, 176, 92, a))
img.paste(Image.alpha_composite(img.convert("RGBA"), sun_layer).convert("RGB"), (0, 0))
d = ImageDraw.Draw(img, "RGBA")

# 星星
star_pos = [(120, 60), (280, 110), (420, 46), (560, 92), (700, 40), (980, 70), (1120, 140), (200, 180), (610, 160)]
for i, (x, y) in enumerate(star_pos):
    s = 4 if i % 3 else 6
    d.rectangle([x, y, x + s, y + s], fill=(255, 227, 196, 150 + (i * 13) % 80))

# 远山（用列矩形拼，保持像素阶梯感）
import math

for offset, color in ((40, hex_rgb("#5A2340")), (10, hex_rgb("#3A1730"))):
    for x in range(0, W + 15, 15):
        hh = 80 + math.sin(x * 0.012) * 34 + math.sin(x * 0.004 + 2) * 46
        d.rectangle([x, int(H - hh - offset), x + 15, H], fill=color)

# 左侧压暗
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for x in range(0, 860):
    a = int(214 * max(0.0, 1 - x / 900) ** 1.2)
    od.line([(x, 0), (x, H)], fill=(12, 6, 20, a))
img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")


def platform(x, y, w, colors, spring=False, crack=False):
    body, light, dark = colors
    d.rectangle([x - 4, y - 4, x + w + 4, y + 36 + 4], fill=(0, 0, 0, 70))
    d.rectangle([x - 4, y - 4, x + w + 4, y + 40], fill=INK)
    d.rectangle([x, y, x + w, y + 36], fill=body)
    d.rectangle([x, y, x + w, y + 9], fill=light)
    d.rectangle([x, y + 26, x + w, y + 36], fill=dark)
    for rx in (x + 10, x + w - 14):
        d.rectangle([rx, y + 15, rx + 5, y + 20], fill=dark)
    if crack:
        d.rectangle([x + int(w * 0.3), y + 6, x + int(w * 0.3) + 3, y + 18], fill=INK)
        d.rectangle([x + int(w * 0.3) + 3, y + 18, x + int(w * 0.3) + 6, y + 30], fill=INK)
    if spring:
        bx = x + w // 2 - 22
        d.rectangle([bx - 6, y - 8, bx + 50, y], fill=PINK)
        for i in range(3):
            d.rectangle([bx, y - 20 - i * 12, bx + 44, y - 8 - i * 12], fill=GOLD)
            d.rectangle([bx, y - 20 - i * 12, bx + 44, y - 16 - i * 12], fill=(255, 233, 168))


platform(690, 470, 180, (TEAL, (127, 231, 216), (20, 134, 125)), spring=True)
platform(880, 362, 150, (BLUE, (157, 186, 255), (47, 85, 168)))
platform(700, 250, 170, (ORANGE, (255, 184, 119), (168, 84, 25)), crack=True)


# 像素猫（4 倍）
def cat(cx, cy, scale=4):
    def r(x, y, w, h, col):
        d.rectangle(
            [cx + x * scale, cy + y * scale, cx + (x + w) * scale - 1, cy + (y + h) * scale - 1],
            fill=col,
        )

    cream = CREAM
    dim = (232, 211, 169)
    outline = (42, 21, 34)
    r(-11, -26, 22, 24, outline)
    r(-10, -25, 20, 22, cream)
    r(-10, -25, 20, 3, (255, 253, 245))
    r(-10, -7, 20, 4, dim)
    r(-9, -32, 6, 7, outline)
    r(-8, -31, 4, 5, PINK)
    r(3, -32, 6, 7, outline)
    r(4, -31, 4, 5, PINK)
    r(-10, -11, 20, 5, TEAL)
    r(-10, -11, 20, 2, (79, 224, 208))
    r(-1, -11, 5, 8, TEAL)
    for ex in (-7, 2):
        r(ex, -20, 5, 6, (255, 253, 245))
        r(ex + 1, -19, 3, 4, INK)
        r(ex + 3, -19, 1, 1, (255, 253, 245))
    r(-7, -13, 3, 2, (240, 160, 180))
    r(4, -13, 3, 2, (240, 160, 180))
    r(-1, -13, 2, 2, INK)
    r(-14, -8, 5, 4, dim)
    r(9, -8, 5, 4, dim)


cat(838, 340, 4)

# 星星道具
def star(x, y, s=13):
    d.rectangle([x - 2, y - s, x + 2, y + s], fill=GOLD)
    d.rectangle([x - s, y - 2, x + s, y + 2], fill=GOLD)
    d.rectangle([x - 7, y - 7, x + 7, y - 1], fill=GOLD)
    d.rectangle([x - 6, y + 2, x + 6, y + 6], fill=GOLD)
    d.rectangle([x - 2, y - s + 1, x + 2, y - s + 4], fill=(255, 253, 245))


star(1030, 300, 14)
star(760, 180, 11)


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


F_TITLE = font("C:/Windows/Fonts/impact.ttf", 58)
F_CN = font("C:/Windows/Fonts/msyhbd.ttc", 34)
F_SCORE = font("C:/Windows/Fonts/impact.ttf", 176)
F_LABEL = font("C:/Windows/Fonts/msyhbd.ttc", 30)
F_SMALL = font("C:/Windows/Fonts/msyh.ttc", 25)
F_URL = font("C:/Windows/Fonts/consola.ttf", 23)

d.text((82, 70), "PIXEL LEAP", font=F_TITLE, fill=CREAM)
d.text((84, 138), "像素跳跳乐", font=F_CN, fill=GOLD)
d.text((86, 196), "高度 214 m   ·   ★ 3", font=F_SMALL, fill=(255, 243, 214, 235))

d.text((72, 238), "230", font=F_SCORE, fill=GOLD, stroke_width=11, stroke_fill=(36, 16, 38))
d.text((360, 372), "分", font=F_LABEL, fill=CREAM)

# 最高分胶囊
best_text = "最高 230"
tw = d.textlength(best_text, font=F_LABEL)
d.rounded_rectangle([80, 432, 80 + tw + 44, 484], radius=8, fill=CREAM)
d.text((102, 442), best_text, font=F_LABEL, fill=INK)

d.text((84, 508), "打开即玩，来挑战我", font=F_SMALL, fill=(255, 243, 214, 200))
d.text((84, 556), "chenjunquan798.github.io/pixel-leap", font=F_URL, fill=(255, 243, 214, 140))

# 像素边框与四角
d.rectangle([18, 18, W - 18, H - 18], outline=(255, 243, 214, 220), width=6)
d.rectangle([28, 28, W - 28, H - 28], outline=(23, 16, 31, 200), width=2)
for x, y in ((18, 18), (W - 34, 18), (18, H - 34), (W - 34, H - 34)):
    d.rectangle([x, y, x + 16, y + 16], fill=GOLD)

img.save(OUT, "PNG", optimize=True)
print(f"wrote {OUT}  {os.path.getsize(OUT)} bytes")

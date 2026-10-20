"""生成 PWA 图标：512 / 192 两个尺寸，用 32×32 的像素格放大。"""

from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

INK = (23, 16, 31)
CREAM = (255, 243, 214)
WHITE = (255, 253, 245)
PINK = (224, 68, 111)
TEAL = (46, 196, 182)
GOLD = (255, 209, 102)

GRID = 32
SCALE = 16
size = GRID * SCALE

img = Image.new("RGB", (size, size), INK)
d = ImageDraw.Draw(img)


def r(x, y, w, h, col):
    d.rectangle([x * SCALE, y * SCALE, (x + w) * SCALE - 1, (y + h) * SCALE - 1], fill=col)


# 背景：深色 + 一点星空
r(0, 0, GRID, GRID, INK)
for x, y in ((4, 5), (27, 4), (6, 26), (25, 25), (15, 3)):
    r(x, y, 1, 1, (60, 50, 90))

# 耳朵
r(6, 6, 5, 8, INK)
r(7, 7, 3, 5, PINK)
r(21, 6, 5, 8, INK)
r(22, 7, 3, 5, PINK)

# 头
r(5, 11, 22, 16, INK)
r(6, 12, 20, 14, CREAM)
r(6, 12, 20, 2, WHITE)

# 围巾
r(6, 23, 20, 3, TEAL)

# 眼睛
r(9, 16, 4, 4, WHITE)
r(19, 16, 4, 4, WHITE)
r(10, 17, 2, 2, INK)
r(20, 17, 2, 2, INK)

# 腮红 + 嘴
r(7, 20, 2, 1, (240, 160, 180))
r(23, 20, 2, 1, (240, 160, 180))
r(15, 20, 2, 1, INK)

# 星标
r(24, 6, 3, 1, GOLD)
r(25, 5, 1, 3, GOLD)

img.save(os.path.join(OUT, "icon-512.png"), "PNG", optimize=True)
img.resize((192, 192), Image.NEAREST).save(
    os.path.join(OUT, "icon-192.png"), "PNG", optimize=True
)
img.resize((180, 180), Image.NEAREST).save(
    os.path.join(OUT, "apple-touch-icon.png"), "PNG", optimize=True
)

# Maskable 图标：内容缩到 70%，留出 Android 圆形遮罩的安全区
maskable = Image.new("RGB", (size, size), INK)
inner = img.resize((int(size * 0.7), int(size * 0.7)), Image.NEAREST)
offset = (size - inner.width) // 2
maskable.paste(inner, (offset, offset))
maskable.save(os.path.join(OUT, "icon-maskable-512.png"), "PNG", optimize=True)

for name in ("icon-512.png", "icon-192.png", "apple-touch-icon.png", "icon-maskable-512.png"):
    p = os.path.join(OUT, name)
    print(name, os.path.getsize(p), "bytes")

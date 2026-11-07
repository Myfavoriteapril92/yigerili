# -*- coding: utf-8 -*-
"""生成 易个日历 的 PWA / App 图标（纯几何绘制，不依赖中文字体）。"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
os.makedirs(OUT, exist_ok=True)

BLUE_TOP = (90, 169, 255)
BLUE_BOT = (0, 122, 255)
RED = (255, 59, 48)
WHITE = (255, 255, 255)
DOT = (201, 211, 224)
HILITE = (0, 122, 255)


def vgrad(size, top, bot, radius):
    """竖直线性渐变 + 圆角遮罩。"""
    w = h = size
    grad = Image.new("RGB", (1, h))
    px = grad.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = (
            round(top[0] + (bot[0] - top[0]) * t),
            round(top[1] + (bot[1] - top[1]) * t),
            round(top[2] + (bot[2] - top[2]) * t),
        )
    grad = grad.resize((w, h))

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    return img


def draw_calendar(img, size, scale=1.0):
    """在 img 上画白色日历卡片。scale<1 时整体缩小并居中（用于 maskable 安全区）。"""
    d = ImageDraw.Draw(img, "RGBA")
    u = size / 512.0  # 设计稿单位

    def P(x, y):  # 设计坐标 -> 画布坐标（含缩放与居中）
        cx, cy = size / 2, size / 2
        return (cx + (x * u - 256 * u * 1.0) * scale, cy + (y * u - 256 * u * 1.0) * scale)

    def s(v):
        return v * u * scale

    # 卡片投影（先画实心再模糊，边缘才柔和）
    x0, y0 = P(96, 104)
    x1, y1 = P(416, 424)
    from PIL import ImageFilter

    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [x0, y0 + s(12), x1, y1 + s(12)], radius=s(52), fill=(10, 46, 96, 70)
    )
    sh = sh.filter(ImageFilter.GaussianBlur(s(11)))
    img.alpha_composite(sh)

    # 白色卡片
    d.rounded_rectangle([x0, y0, x1, y1], radius=s(52), fill=WHITE)

    # 顶部红色条：用一个与卡片同形状的遮罩裁出
    band = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([x0, y0, x1, y0 + s(78)], fill=RED + (255,))
    card_mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(card_mask).rounded_rectangle([x0, y0, x1, y1], radius=s(52), fill=255)
    img.paste(band, (0, 0), Image.composite(card_mask, Image.new("L", img.size, 0), band.split()[3]))

    # 装订环
    for cx in (176, 256, 336):
        ax, ay = P(cx, 96)
        d.rounded_rectangle(
            [ax - s(8), ay - s(15), ax + s(8), ay + s(15)],
            radius=s(8),
            fill=WHITE + (240,),
        )

    # 日期点阵 3x3
    cols = (150, 256, 362)
    rows = (228, 312, 396)
    r = 13
    for ri, cy in enumerate(rows):
        for ci, cx in enumerate(cols):
            px, py = P(cx, cy)
            color = HILITE if (ri == 1 and ci == 2) else DOT
            d.ellipse([px - s(r), py - s(r), px + s(r), py + s(r)], fill=color + (255,))


def make(size, filename, radius_ratio=0.225, scale=1.0, transparent_bg=False):
    if transparent_bg:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        img = vgrad(size, BLUE_TOP, BLUE_BOT, int(size * radius_ratio))
    draw_calendar(img, size, scale=scale)
    img.save(os.path.join(OUT, filename), "PNG", optimize=True)
    print("写出", filename, size)


make(512, "icon-512.png")
make(192, "icon-192.png")
make(180, "apple-touch-icon.png", radius_ratio=0.0)
make(32, "favicon-32.png", radius_ratio=0.225)
# maskable：Android 会自行裁切，图形收进中心 78% 安全区，背景铺满整块
make(512, "icon-maskable-512.png", radius_ratio=0.0, scale=0.78)
make(192, "icon-maskable-192.png", radius_ratio=0.0, scale=0.78)
print("完成 ->", OUT)

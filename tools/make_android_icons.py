# -*- coding: utf-8 -*-
"""生成安卓工程需要的启动图标（传统各密度 PNG + 自适应图标前景）。"""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_icons import draw_calendar, vgrad, BLUE_TOP, BLUE_BOT  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "app", "src", "main", "res")

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def rounded(img, radius_ratio):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def circular(img):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    for name, px in DENSITIES.items():
        folder = os.path.join(RES, "mipmap-" + name)
        os.makedirs(folder, exist_ok=True)

        base = vgrad(px, BLUE_TOP, BLUE_BOT, int(px * 0.225))
        draw_calendar(base, px)

        rounded(base, 0.225).save(os.path.join(folder, "ic_launcher.png"), "PNG", optimize=True)
        circular(base).save(os.path.join(folder, "ic_launcher_round.png"), "PNG", optimize=True)
        print("写出 mipmap-%s" % name, px)

    # 自适应图标前景：108dp 画布，内容收在中心安全区内
    for name, dp in (("xxxhdpi", 432), ("xxhdpi", 324), ("xhdpi", 216), ("hdpi", 162), ("mdpi", 108)):
        folder = os.path.join(RES, "mipmap-" + name)
        os.makedirs(folder, exist_ok=True)
        fg = Image.new("RGBA", (dp, dp), (0, 0, 0, 0))
        draw_calendar(fg, dp, scale=0.80)
        fg.save(os.path.join(folder, "ic_launcher_foreground.png"), "PNG", optimize=True)
    print("写出 ic_launcher_foreground（各密度）")

    print("完成 ->", RES)


if __name__ == "__main__":
    main()

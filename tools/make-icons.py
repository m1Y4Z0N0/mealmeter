# -*- coding: utf-8 -*-
"""从用户提供的原图生成 Mascot 全套图标（web PWA + Android mipmap）。
   步骤：抠背景 -> 按内容包围盒裁切 -> 居中放进正方形画布 -> 导出各尺寸。"""
import os
import sys
from PIL import Image, ImageDraw

# 项目根目录 = 本脚本的上一级
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 原图路径可用命令行覆盖：python tools/make-icons.py <图片路径>
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets-src", "mascot-source.jpg")

BG_REF = (249, 249, 251)      # 原图背景色
FLOOD_THRESH = 26             # 泛洪容差
CONTENT_ALPHA_THRESH = 240    # 判定"有内容"的通道差阈值


def flood_bg_to_alpha(im):
    """从四边泛洪，把与边缘连通的背景变透明。角色内部的白色（眼睛等）不受影响。"""
    im = im.convert("RGBA")
    W, H = im.size
    px = im.load()

    def near_bg(p):
        return max(abs(p[0] - BG_REF[0]), abs(p[1] - BG_REF[1]), abs(p[2] - BG_REF[2])) <= FLOOD_THRESH

    # 收集边缘上真正是背景色的种子点
    seeds = []
    for x in range(0, W, 7):
        for y in (0, H - 1):
            if near_bg(px[x, y]):
                seeds.append((x, y))
    for y in range(0, H, 7):
        for x in (0, W - 1):
            if near_bg(px[x, y]):
                seeds.append((x, y))

    MARK_RGB = (255, 0, 255)
    MARK = MARK_RGB + (255,)              # RGBA 图必须给 4 元组，3 元组会静默不生效
    for s in seeds:                       # 第一次就会填满整个连通背景，后续为空操作
        ImageDraw.floodfill(im, s, MARK, thresh=FLOOD_THRESH)

    px = im.load()
    hit = 0
    for y in range(H):
        for x in range(W):
            if px[x, y][:3] == MARK_RGB:  # 只能拿 3 元组比，别拿 MARK 比
                px[x, y] = (0, 0, 0, 0)
                hit += 1
    return im, hit


def content_bbox(im, min_alpha=40):
    """alpha>min_alpha 的像素构成的包围盒。"""
    a = im.getchannel("A")
    return a.point(lambda v: 255 if v > min_alpha else 0).getbbox()


def make_icon(content, size, ratio, bg=(249, 249, 251, 255), circular=False):
    """把 content 等比缩放到最大边 = size*ratio，居中贴到 size×size 画布。"""
    canvas = Image.new("RGBA", (size, size), bg)
    cw, ch = content.size
    scale = (size * ratio) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    r = content.resize((nw, nh), Image.LANCZOS)
    canvas.paste(r, ((size - nw) // 2, (size - nh) // 2), r)

    if circular:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        canvas = out
    return canvas


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG", optimize=True)
    return os.path.getsize(path)


# ---------- 1. 抠图 + 居中裁切 ----------
src = Image.open(SRC)
print(f"原图: {src.size[0]}x{src.size[1]}")

cut, npix = flood_bg_to_alpha(src)
print(f"抠掉的背景像素: {npix}  ({npix/(src.size[0]*src.size[1])*100:.1f}%)")

bb = content_bbox(cut)
print(f"抠图后内容包围盒: {bb}  -> {bb[2]-bb[0]}x{bb[3]-bb[1]}")

content = cut.crop(bb)
cw, ch = content.size
print(f"居中素材: {cw}x{ch}  长边比 {max(cw,ch)/min(cw,ch):.3f}")

# 保存一份主素材，方便以后复用
save(content, os.path.join(ROOT, "assets-src", "mascot.png"))

# ---------- 2. 定义所有输出 ----------
# 比例（2026-09-11 定稿第二版：整体再缩一档，视觉更"小图标"）
targets = [
    # web / PWA
    ("www/icon-192.png",          192, 0.48, False),
    ("www/icon-512.png",          512, 0.48, False),
    ("www/icon-maskable-512.png", 512, 0.40, False),
    ("www/apple-touch-icon.png",  180, 0.48, False),
    # Android legacy mipmap
    ("android/app/src/main/res/mipmap-mdpi/ic_launcher.png",     48,  0.46, False),
    ("android/app/src/main/res/mipmap-hdpi/ic_launcher.png",     72,  0.46, False),
    ("android/app/src/main/res/mipmap-xhdpi/ic_launcher.png",    96,  0.46, False),
    ("android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png",   144, 0.46, False),
    ("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",  192, 0.46, False),
    # Android 圆形图标
    ("android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png",    48,  0.40, True),
    ("android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png",    72,  0.40, True),
    ("android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png",   96,  0.40, True),
    ("android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png",  144, 0.40, True),
    ("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", 192, 0.40, True),
    # 启动画面用的高分辨率形象（透明底，nodpi 目录不会按密度缩放）
    ("android/app/src/main/res/drawable-nodpi/splash_mascot.png", 512, 0.54, False),
    # Android 自适应图标前景（108dp 画布，内容占 66dp 安全区，背景透明）
    ("android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png",    108, 0.36, False),
    ("android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png",    162, 0.36, False),
    ("android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png",   216, 0.36, False),
    ("android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png",  324, 0.36, False),
    ("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png", 432, 0.36, False),
]

print("\n生成:")
total = 0
for rel, size, ratio, circ in targets:
    bg = (0, 0, 0, 0) if (rel.endswith("foreground.png") or "splash_mascot" in rel) else (249, 249, 251, 255)
    img = make_icon(content, size, ratio, bg=bg, circular=circ)
    n = save(img, os.path.join(ROOT, rel.replace("/", os.sep)))
    total += n
    print(f"  {size:>4}px  ratio={ratio:<5} {'圆' if circ else '  '}  {n/1024:>7.1f} KB  {rel}")

print(f"\n合计 {total/1024:.0f} KB")

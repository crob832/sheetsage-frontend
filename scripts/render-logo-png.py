import re
import xml.etree.ElementTree as ET
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as MplPath
from matplotlib.patches import FancyBboxPatch, PathPatch
from matplotlib.transforms import Affine2D


def _is_command(token: str) -> bool:
    return len(token) == 1 and token.isalpha()


def _tokenize_path(d: str) -> list[str]:
    pattern = r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?"
    return re.findall(pattern, d)


def _parse_svg_path(d: str) -> MplPath:
    tokens = _tokenize_path(d)
    vertices: list[tuple[float, float]] = []
    codes: list[int] = []

    i = 0
    command: str | None = None
    cx = cy = 0.0
    start: tuple[float, float] | None = None

    while i < len(tokens):
        token = tokens[i]
        if _is_command(token):
            command = token
            i += 1

            if command in {"Z", "z"}:
                if start is None:
                    start = (cx, cy)
                vertices.append(start)
                codes.append(MplPath.CLOSEPOLY)
                command = None
                continue

        if command is None:
            raise ValueError("SVG path parsing error: missing command.")

        if command in {"M", "m"}:
            rel = command == "m"
            x = float(tokens[i])
            y = float(tokens[i + 1])
            i += 2
            if rel:
                x += cx
                y += cy
            cx, cy = x, y
            start = (cx, cy)
            vertices.append((cx, cy))
            codes.append(MplPath.MOVETO)

            while i + 1 < len(tokens) and not _is_command(tokens[i]):
                x = float(tokens[i])
                y = float(tokens[i + 1])
                i += 2
                if rel:
                    x += cx
                    y += cy
                cx, cy = x, y
                vertices.append((cx, cy))
                codes.append(MplPath.LINETO)

        elif command in {"L", "l"}:
            rel = command == "l"
            while i + 1 < len(tokens) and not _is_command(tokens[i]):
                x = float(tokens[i])
                y = float(tokens[i + 1])
                i += 2
                if rel:
                    x += cx
                    y += cy
                cx, cy = x, y
                vertices.append((cx, cy))
                codes.append(MplPath.LINETO)

        elif command in {"C", "c"}:
            rel = command == "c"
            while i + 5 < len(tokens) and not _is_command(tokens[i]):
                x1 = float(tokens[i])
                y1 = float(tokens[i + 1])
                x2 = float(tokens[i + 2])
                y2 = float(tokens[i + 3])
                x = float(tokens[i + 4])
                y = float(tokens[i + 5])
                i += 6

                if rel:
                    x1 += cx
                    y1 += cy
                    x2 += cx
                    y2 += cy
                    x += cx
                    y += cy

                vertices.extend([(x1, y1), (x2, y2), (x, y)])
                codes.extend([MplPath.CURVE4, MplPath.CURVE4, MplPath.CURVE4])
                cx, cy = x, y

        elif command in {"V", "v"}:
            rel = command == "v"
            while i < len(tokens) and not _is_command(tokens[i]):
                y = float(tokens[i])
                i += 1
                if rel:
                    y += cy
                cy = y
                vertices.append((cx, cy))
                codes.append(MplPath.LINETO)

        elif command in {"H", "h"}:
            rel = command == "h"
            while i < len(tokens) and not _is_command(tokens[i]):
                x = float(tokens[i])
                i += 1
                if rel:
                    x += cx
                cx = x
                vertices.append((cx, cy))
                codes.append(MplPath.LINETO)

        else:
            raise ValueError(f"Unsupported SVG path command: {command}")

    return MplPath(vertices, codes)


def _load_favicon_svg(svg_path: Path) -> dict:
    root = ET.parse(svg_path).getroot()
    rect = None
    path = None

    for child in root:
        if child.tag.endswith("rect"):
            rect = child
        elif child.tag.endswith("path"):
            path = child

    if rect is None or path is None:
        raise ValueError("Expected <rect> and <path> in favicon SVG.")

    rect_x = float(rect.attrib.get("x", "0"))
    rect_y = float(rect.attrib.get("y", "0"))
    rect_w = float(rect.attrib["width"])
    rect_h = float(rect.attrib["height"])
    rect_rx = float(rect.attrib.get("rx", "0"))
    rect_fill = rect.attrib.get("fill", "#000000")

    d = path.attrib["d"]
    path_fill = path.attrib.get("fill", "#ffffff")

    return {
        "rect_x": rect_x,
        "rect_y": rect_y,
        "rect_w": rect_w,
        "rect_h": rect_h,
        "rect_rx": rect_rx,
        "rect_fill": rect_fill,
        "path_d": d,
        "path_fill": path_fill,
    }


def _draw_logo(ax, logo: dict, x: float, y: float, size: float) -> None:
    base = logo["rect_w"]
    scale = size / base

    rx = logo["rect_rx"] * scale
    rect_patch = FancyBboxPatch(
        (x, y),
        size,
        size,
        boxstyle=f"round,pad=0,rounding_size={rx}",
        linewidth=0,
        facecolor=logo["rect_fill"],
    )
    ax.add_patch(rect_patch)

    svg_path = _parse_svg_path(logo["path_d"])
    svg_path = MplPath(svg_path.vertices - [logo["rect_x"], logo["rect_y"]], svg_path.codes)

    path_patch = PathPatch(
        svg_path,
        facecolor=logo["path_fill"],
        edgecolor="none",
        transform=Affine2D().scale(scale).translate(x, y) + ax.transData,
        antialiased=True,
    )
    ax.add_patch(path_patch)


def _save_figure(fig, out_path: Path, dpi: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=dpi, transparent=True)
    plt.close(fig)


def render_logo_png(logo: dict, out_path: Path, size_px: int = 1024) -> None:
    dpi = 100
    fig = plt.figure(figsize=(size_px / dpi, size_px / dpi), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])

    ax.set_xlim(0, size_px)
    ax.set_ylim(size_px, 0)
    ax.set_aspect("equal")
    ax.axis("off")

    _draw_logo(ax, logo, x=0, y=0, size=size_px)
    _save_figure(fig, out_path, dpi=dpi)


def render_wordmark_png(logo: dict, out_path: Path, width_px: int = 2000, height_px: int = 512) -> None:
    dpi = 100
    fig = plt.figure(figsize=(width_px / dpi, height_px / dpi), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1])

    ax.set_xlim(0, width_px)
    ax.set_ylim(height_px, 0)
    ax.set_aspect("equal")
    ax.axis("off")

    padding = 64
    icon_size = 384
    gap = 56

    x_icon = padding
    y_icon = (height_px - icon_size) / 2
    _draw_logo(ax, logo, x=x_icon, y=y_icon, size=icon_size)

    ax.text(
        x_icon + icon_size + gap,
        height_px / 2,
        "SheetSage",
        ha="left",
        va="center",
        fontsize=220,
        fontweight="bold",
        color="#1e293b",
    )

    _save_figure(fig, out_path, dpi=dpi)

    from PIL import Image

    im = Image.open(out_path).convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return

    margin = 32
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(im.width, bbox[2] + margin)
    bottom = min(im.height, bbox[3] + margin)

    im.crop((left, top, right, bottom)).save(out_path)


def main() -> None:
    frontend_dir = Path(__file__).resolve().parents[1]
    assets_dir = frontend_dir / "assets"

    logo = _load_favicon_svg(assets_dir / "favicon.svg")
    if logo["rect_w"] != logo["rect_h"]:
        raise ValueError("Expected square logo rect in favicon SVG.")

    render_logo_png(logo, assets_dir / "logo.png", size_px=1024)
    render_wordmark_png(logo, assets_dir / "logo-wordmark.png", width_px=3200)


if __name__ == "__main__":
    main()

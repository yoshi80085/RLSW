"""Generate a print-ready A4 ArUco marker sheet for the RLSW mocap capture."""
import io
import cv2
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas
from PIL import Image

DICT = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)

# id, printed side length of the BLACK square in mm, where it goes
MARKERS = [
    (0, 80, "GUITAR FACE — lower bout"),
    (1, 80, "GUITAR BACK — centre"),
    (2, 55, "GUITAR FACE — upper bout"),
    (3, 55, "GUITAR BACK — upper"),
    (4, 30, "HEADSTOCK — front"),
    (5, 30, "HEADSTOCK — back"),
    (6, 30, "SPARE"),
]


def marker_png(marker_id, px=1200):
    """ArUco marker as a PIL image. The whole image IS the black square."""
    img = cv2.aruco.generateImageMarker(DICT, marker_id, px, borderBits=1)
    return Image.fromarray(img).convert("L")


def quiet(size_mm):
    """White border that must survive the scissors, in mm."""
    return max(8.0, size_mm / 6.0)


def draw_marker(c, x_mm, y_mm, marker_id, size_mm, label):
    """x_mm, y_mm = bottom-left of the BLACK square."""
    q = quiet(size_mm)
    # cut guide: the black square plus its quiet zone
    c.setStrokeColorRGB(0.72, 0.72, 0.72)
    c.setLineWidth(0.4)
    c.setDash(3, 3)
    c.rect((x_mm - q) * mm, (y_mm - q) * mm,
           (size_mm + 2 * q) * mm, (size_mm + 2 * q) * mm, stroke=1, fill=0)
    c.setDash()

    bio = io.BytesIO()
    marker_png(marker_id).save(bio, format="PNG")
    bio.seek(0)
    c.drawImage(ImageReader(bio), x_mm * mm, y_mm * mm,
                width=size_mm * mm, height=size_mm * mm)

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 8)
    c.drawString((x_mm - q) * mm, (y_mm - q - 4.6) * mm,
                 f"ID {marker_id}  ·  {size_mm} mm")
    c.setFont("Helvetica", 7.4)
    c.setFillColorRGB(0.32, 0.32, 0.32)
    c.drawString((x_mm - q) * mm, (y_mm - q - 8.6) * mm, label)
    c.setFillColorRGB(0, 0, 0)


def draw_scale_bar(c, x_mm, y_mm, length_mm=150):
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.9)
    c.line(x_mm * mm, y_mm * mm, (x_mm + length_mm) * mm, y_mm * mm)
    for i in range(0, length_mm + 1, 10):
        big = (i % 50 == 0)
        h = 4.2 if big else 2.4
        c.setLineWidth(0.9 if big else 0.5)
        c.line((x_mm + i) * mm, y_mm * mm, (x_mm + i) * mm, (y_mm + h) * mm)
        if big:
            c.setFont("Helvetica", 6.6)
            c.drawCentredString((x_mm + i) * mm, (y_mm + 5.4) * mm, str(i))
    c.setFont("Helvetica-Bold", 8.4)
    c.drawString(x_mm * mm, (y_mm - 5.4) * mm,
                 "MEASURE THIS LINE. It must be exactly 150 mm.")
    c.setFont("Helvetica", 7.4)
    c.setFillColorRGB(0.32, 0.32, 0.32)
    c.drawString(x_mm * mm, (y_mm - 9.4) * mm,
                 "If it is not, your printer rescaled the page. Reprint at 100% / "
                 "\"Actual size\" — never \"Fit to page\".")
    c.setFillColorRGB(0, 0, 0)


def header(c, H, page, of):
    c.setFont("Helvetica-Bold", 12)
    c.drawString(14 * mm, (H - 15) * mm,
                 f"ROCK LEGENDS: SPIRIT WARS — mocap marker sheet  ({page}/{of})")
    c.setFont("Helvetica", 7.6)
    c.setFillColorRGB(0.32, 0.32, 0.32)
    c.drawString(14 * mm, (H - 19.6) * mm,
                 "ArUco DICT_4X4_50  ·  MATTE paper  ·  print at 100% / \"Actual size\"")
    c.drawString(14 * mm, (H - 23.4) * mm,
                 "Cut on the DASHED line, never on the black edge — the white border is part "
                 "of the marker.")
    c.setFillColorRGB(0, 0, 0)


def build(path):
    c = rl_canvas.Canvas(path, pagesize=A4)
    H = 297.0

    # ── page 1 — the two 80 mm workhorses, stacked ──────────────────────
    header(c, H, 1, 2)
    draw_scale_bar(c, 14, H - 39)
    draw_marker(c, 65, 150, 0, 80, MARKERS[0][2])
    draw_marker(c, 65, 34, 1, 80, MARKERS[1][2])
    c.showPage()

    # ── page 2 — 55 mm pair and the 30 mm headstock trio ────────────────
    header(c, H, 2, 2)
    draw_scale_bar(c, 14, H - 39)
    draw_marker(c, 25, 180, 2, 55, MARKERS[2][2])
    draw_marker(c, 120, 180, 3, 55, MARKERS[3][2])
    draw_marker(c, 25, 95, 4, 30, MARKERS[4][2])
    draw_marker(c, 90, 95, 5, 30, MARKERS[5][2])
    draw_marker(c, 155, 95, 6, 30, MARKERS[6][2])

    c.setFont("Helvetica-Oblique", 7)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawString(14 * mm, 30 * mm,
                 "After printing, measure one 80 mm black square with calipers and write the "
                 "real number into")
    c.drawString(14 * mm, 26 * mm,
                 "docs/mocap-session-protocol.md — it is the scale reference for the entire "
                 "capture.")
    c.showPage()

    # ── page 3 — ChArUco board, for CAMERA calibration ──────────────────
    # ⚠️ A DIFFERENT DICTIONARY ON PURPOSE. Sharing DICT_4X4_50 with the guitar
    # markers would let the calibration board's squares be mistaken for the
    # instrument in any frame that caught both.
    SQ, NX, NY = 25.0, 7, 10
    cdict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_5X5_100)
    board = cv2.aruco.CharucoBoard((NX, NY), SQ, SQ * 0.75, cdict)
    px_per_mm = 8
    bimg = board.generateImage((int(NX * SQ * px_per_mm), int(NY * SQ * px_per_mm)))
    bio = io.BytesIO()
    Image.fromarray(bimg).convert("L").save(bio, format="PNG")
    bio.seek(0)

    c.setFont("Helvetica-Bold", 12)
    c.drawString(14 * mm, (H - 15) * mm,
                 "CAMERA CALIBRATION BOARD  (3/3)")
    c.setFont("Helvetica", 7.6)
    c.setFillColorRGB(0.32, 0.32, 0.32)
    c.drawString(14 * mm, (H - 19.6) * mm,
                 f"ChArUco  ·  {NX}x{NY} squares  ·  {SQ:.0f} mm square  ·  "
                 f"{SQ*0.75:.2f} mm marker  ·  DICT_5X5_100")
    c.drawString(14 * mm, (H - 23.4) * mm,
                 "Do NOT cut this page. Tape it flat to something rigid — a clipboard or "
                 "stiff card. A bent board calibrates a lens that does not exist.")
    c.setFillColorRGB(0, 0, 0)

    bx, by = (210 - NX * SQ) / 2, 22
    c.drawImage(ImageReader(bio), bx * mm, by * mm,
                width=NX * SQ * mm, height=NY * SQ * mm)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(bx * mm, (by - 5) * mm,
                 f"Measure one square: it must be {SQ:.0f} mm.")
    c.showPage()
    c.save()


if __name__ == "__main__":
    out = "/mnt/user-data/outputs/mocap-markers-a4.pdf"
    build(out)
    print("wrote", out)

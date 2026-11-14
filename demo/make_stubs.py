"""Generate fake pay stub PNGs for the demo (needs Pillow).

    python demo/make_stubs.py     # writes demo/stubs/*.png

The employer is fictional. These are test images, not real pay records.
"""
import os
from decimal import Decimal

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "stubs")
W, H = 1240, 1500
INK, MUTED, LINE, BAND = (24, 28, 34), (95, 102, 112), (205, 209, 215), (240, 242, 245)

STUBS = {
    # The demo case: 43.5 hours logged, only 38 regular hours paid.
    "stub_demo.png": {"rate": "17.00", "regular": "38.00", "overtime": "0.00"},
    # Paid correctly for the seeded week: 40 regular + 3.5 overtime.
    "stub_correct.png": {"rate": "17.00", "regular": "40.00", "overtime": "3.50"},
    # Hourly rate below the Arizona minimum wage.
    "stub_low_rate.png": {"rate": "12.00", "regular": "40.00", "overtime": "3.50"},
}


def font(size, bold=False):
    names = (["Arial Bold.ttf", "Helvetica.ttc", "DejaVuSans-Bold.ttf"] if bold
             else ["Arial.ttf", "Helvetica.ttc", "DejaVuSans.ttf"])
    for name in names:
        for folder in ("/System/Library/Fonts/Supplemental", "/System/Library/Fonts",
                       "/Library/Fonts", "/usr/share/fonts/truetype/dejavu"):
            try:
                return ImageFont.truetype(os.path.join(folder, name), size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def money(value):
    return "${:,.2f}".format(value)


def draw_stub(filename, spec):
    rate, regular, overtime = (Decimal(spec[k]) for k in ("rate", "regular", "overtime"))
    ot_rate = (rate * Decimal("1.5")).quantize(Decimal("0.01"))
    regular_pay, ot_pay = regular * rate, overtime * ot_rate
    gross = (regular_pay + ot_pay).quantize(Decimal("0.01"))
    taxes = (gross * Decimal("0.1165")).quantize(Decimal("0.01"))

    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 150], fill=(33, 46, 66))
    d.text((60, 38), "Desert Sun Logistics LLC", font=font(46, True), fill="white")
    d.text((60, 98), "1200 W Example Way, Tempe, AZ 85281   (fictional employer, demo stub)", font=font(22), fill=(200, 208, 220))
    d.text((W - 60, 56), "EARNINGS STATEMENT", font=font(28, True), fill="white", anchor="ra")

    y = 200
    for label, value in [("Employee", "Alex Rivera"), ("Employee ID", "DS-20418"),
                         ("Pay Period Start Date", "11/08/2026"), ("Pay Period End Date", "11/14/2026"),
                         ("Pay Date", "11/15/2026"), ("Hourly Rate", money(rate))]:
        d.text((60, y), label, font=font(28), fill=MUTED)
        d.text((480, y), value, font=font(28, True), fill=INK)
        y += 52

    y += 30
    d.rectangle([60, y, W - 60, y + 56], fill=BAND)
    columns = [(80, "Earnings", "la"), (560, "Hours", "ra"), (800, "Rate", "ra"), (W - 80, "Amount", "ra")]
    for x, title, anchor in columns:
        d.text((x, y + 12), title, font=font(26, True), fill=INK, anchor=anchor)
    y += 56
    for name, hours, row_rate, amount in [("Regular Hours", regular, rate, regular_pay),
                                         ("Overtime Hours", overtime, ot_rate, ot_pay)]:
        d.text((80, y + 16), name, font=font(28), fill=INK)
        d.text((560, y + 16), f"{hours:.2f}", font=font(28), fill=INK, anchor="ra")
        d.text((800, y + 16), money(row_rate), font=font(28), fill=INK, anchor="ra")
        d.text((W - 80, y + 16), money(amount), font=font(28), fill=INK, anchor="ra")
        y += 64
        d.line([60, y, W - 60, y], fill=LINE, width=2)

    y += 30
    d.text((80, y), "Gross Pay", font=font(34, True), fill=INK)
    d.text((W - 80, y), money(gross), font=font(34, True), fill=INK, anchor="ra")

    y += 100
    d.rectangle([60, y, W - 60, y + 56], fill=BAND)
    d.text((80, y + 12), "Deductions", font=font(26, True), fill=INK)
    d.text((W - 80, y + 12), "Amount", font=font(26, True), fill=INK, anchor="ra")
    y += 56
    d.text((80, y + 16), "Taxes and withholding", font=font(28), fill=INK)
    d.text((W - 80, y + 16), money(taxes), font=font(28), fill=INK, anchor="ra")
    y += 64
    d.line([60, y, W - 60, y], fill=LINE, width=2)
    y += 30
    d.text((80, y), "Net Pay", font=font(34, True), fill=INK)
    d.text((W - 80, y), money(gross - taxes), font=font(34, True), fill=INK, anchor="ra")

    d.text((60, H - 80), "Sample document generated for the Stubborn demo at sunhacks 2026. Not a real pay record.",
           font=font(22), fill=MUTED)
    img.save(os.path.join(OUT, filename))
    return gross


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for filename, spec in STUBS.items():
        print(f"{filename}: gross {money(draw_stub(filename, spec))}")

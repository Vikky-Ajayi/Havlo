from pathlib import Path
import fitz

out = Path(".agents/outputs/pdf-review")
out.mkdir(parents=True, exist_ok=True)

for source in (
    Path("attached_assets/stale-listing-5318_1787156407594.pdf"),
    Path("attached_assets/Letter_1787156407595.pdf"),
):
    doc = fitz.open(source)
    print(f"{source.name}: {len(doc)} page(s)")
    for index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        target = out / f"{source.stem}-page-{index + 1}.png"
        pix.save(target)
        print(f"  {target} {page.rect.width:.0f}x{page.rect.height:.0f}")
# Sinh operations thêm nền, ảnh, chữ cho một slide. Usage: python3 canva-ops.py NN PAGE_ID
import json, sys
no, page_id = sys.argv[1], sys.argv[2]
m = json.load(open('deck/tools/canva-media.json'))
d = json.load(open(f'deck/dist/canva/{no}.json'))
ops = [{"type": "insert_fill", "page_id": page_id, "asset_type": "image", "asset_id": m['bg'][no],
        "alt_text": "Nền slide", "left": 0, "top": 0, "width": 1672, "height": 941}]
for im in d['imgs']:
    mid = m['img'].get(im['src'])
    if not mid: raise SystemExit('missing media ' + im['src'])
    ops.append({"type": "insert_fill", "page_id": page_id, "asset_type": "image", "asset_id": mid,
                "alt_text": im['alt'] or 'Ảnh', "left": round(im['left'], 1), "top": round(im['top'], 1),
                "width": round(im['width'], 1), "height": round(im['height'], 1)})
for t in d['texts']:
    ops.append({"type": "add_text", "page_id": page_id, "text": t['text'],
                "left": round(t['left'], 1), "top": round(t['top'], 1), "width": round(t['width'] + 2, 1)})
print(json.dumps(ops, ensure_ascii=False, separators=(',', ':')))

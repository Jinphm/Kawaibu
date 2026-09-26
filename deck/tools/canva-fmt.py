# Sinh format_text ops theo thứ tự chữ trong JSON. Usage: python3 canva-fmt.py NN PAGEID ELID1 ELID2 ...
import json, sys
no, page = sys.argv[1], sys.argv[2]
ids = sys.argv[3:]
d = json.load(open(f'deck/dist/canva/{no}.json'))
assert len(ids) == len(d['texts']), (len(ids), len(d['texts']))
ops = []
for t, i in zip(d['texts'], ids):
    f = {"font_size": max(1, round(t['size'])), "font_weight": t['weight'], "color": t['color'],
         "line_height": round(t['lh'], 2), "text_align": t['align']}
    if t['italic']: f['font_style'] = 'italic'
    ops.append({"type": "format_text", "locator_id": f"{page}-{i}", "formatting": f})
print(json.dumps(ops, ensure_ascii=False))

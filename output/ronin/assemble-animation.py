"""Assemble imagegen's eight frames into a GIF; no background removal or repainting."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parent
sheet = Image.open(root / 'shredding-ronin-strum-sheet.png').convert('RGB')
width, height = sheet.size
frames = [sheet.crop((round(col*width/4), round(row*height/2),
                      round((col+1)*width/4), round((row+1)*height/2)))
          for row in range(2) for col in range(4)]
durations = [350, 160, 140, 110, 140, 160, 180, 250]
frames[0].save(root / 'shredding-ronin-strum.gif', save_all=True,
               append_images=frames[1:], duration=durations, loop=0, disposal=2)
(root / 'shredding-ronin-strum.json').write_text(json.dumps({
    'image': 'shredding-ronin-strum-sheet.png', 'columns': 4, 'rows': 2,
    'frameCount': 8, 'durationMs': durations, 'loop': True,
    'background': 'opaque black', 'status': 'animation concept; not rigged production art',
    'frames': [{'x': round(c*width/4), 'y': round(r*height/2),
                'w': round((c+1)*width/4)-round(c*width/4),
                'h': round((r+1)*height/2)-round(r*height/2)}
               for r in range(2) for c in range(4)]
}, indent=2))
with Image.open(root / 'shredding-ronin-strum.gif') as gif:
    assert gif.n_frames == 8
    assert gif.info['loop'] == 0
    print(f'GIF verified: {gif.n_frames} frames, {gif.size}, {sum(durations)} ms loop')

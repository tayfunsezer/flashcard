"""Generate the PWA icons for fc/ and lg/ with the Python standard library only.
fc: blue square with a white card; lg: dark-blue square with a white circle. Run: python3 tools/icons.py"""
import struct, zlib, os

def png(size, path, bg, inside):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes((255, 255, 255) if inside(x / size, y / size) else bg)
        rows.append(bytes(row))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f: f.write(data)

card = lambda u, v: 0.24 <= u <= 0.76 and 0.32 <= v <= 0.68 and not (0.32 <= u <= 0.68 and 0.47 <= v <= 0.53)
dot = lambda u, v: (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.26 ** 2 and (u - 0.5) ** 2 + (v - 0.5) ** 2 >= 0.13 ** 2
root = os.path.join(os.path.dirname(__file__), '..')
for app, bg, shape in (('fc', (59, 130, 246), card), ('lg', (43, 95, 180), dot)):
    for s in (180, 192, 512):
        png(s, os.path.join(root, app, 'icons', f'icon-{s}.png'), bg, shape)

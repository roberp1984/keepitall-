# Regenerates the brand images: python3 render.py <dir with geist-latin.woff2> <output dir>
# (Geist: node_modules/next/dist/next-devtools/server/font/geist-latin.woff2). Uses Playwright's headless Chromium.
import subprocess, pathlib, sys
S=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(sys.argv[2])
CHROME="/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
GREEN="#0f7a5a"; INK="#10241d"; GOLD="#f5b82e"
FONT=f"@font-face{{font-family:Geist;src:url('{S}/geist-latin.woff2') format('woff2');font-weight:100 900}}"

def icon(size, bg=True):
    # Circle mark: plane + euro coin. Drawn on a 100x100 grid.
    circle = f'<circle cx="50" cy="50" r="50" fill="url(#g)"/>' if bg else ''
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18a578"/><stop offset="1" stop-color="{GREEN}"/></linearGradient></defs>
{circle}
<g transform="translate(27 15) scale(2.35)" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></g>
<circle cx="36" cy="66" r="13" fill="{GOLD}" stroke="white" stroke-width="3"/>
<text x="36" y="71.5" text-anchor="middle" font-family="Geist" font-weight="800" font-size="16" fill="{INK}">€</text>
</svg>'''

def wordmark(px, color=INK):
    return f'<span style="font-family:Geist;font-weight:800;font-size:{px}px;letter-spacing:-0.02em;color:{color}">Keep<span style="color:{GREEN}">ItAll</span></span>'

def page(w,h,body,bg="transparent"):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{FONT}
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:{bg}}}
body{{display:flex;align-items:center;justify-content:center;font-family:Geist}}</style></head><body>{body}</body></html>'''

def render(name,w,h,html,transparent=False):
    f=S/f"{name}.html"; f.write_text(html)
    out=OUT/f"{name}.png"
    args=[CHROME,"--headless","--no-sandbox","--hide-scrollbars","--force-device-scale-factor=1",f"--window-size={w},{h}",f"--screenshot={out}"]
    if transparent: args.append("--default-background-color=00000000")
    args.append(f"file://{f}")
    subprocess.run(args,check=True,capture_output=True)
    print(out.name, w, h)

# Profile pictures: full-bleed square; every platform crops them to a circle.
def profile(name,size):
    body=f'<div style="width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 25%,#18a578,{GREEN})">{icon(int(size*1.0),bg=False)}</div>'
    render(name,size,size,page(size,size,body))

def banner(name,w,h,safe_w,safe_h,offset_x=0):
    ic=int(safe_h*0.8); gap=int(safe_h*0.1)
    # Two lines of headline that must fit next to the icon without wrapping.
    px=int(min((safe_w-ic-gap)/(36*0.56), safe_h*0.17))
    body=f'''<div style="width:{w}px;height:{h}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f3faf6 0%,#dff2e9 100%)">
<div style="width:{safe_w}px;height:{safe_h}px;margin-left:{offset_x}px;display:flex;align-items:center;gap:{gap}px">
 {icon(ic)}
 <div style="display:flex;flex-direction:column;gap:{int(px*0.35)}px;white-space:nowrap">
  {wordmark(int(px*0.95))}
  <div style="font-weight:800;font-size:{px}px;line-height:1.12;letter-spacing:-0.02em;color:{INK}">Your airline may owe you up to <span style="color:{GREEN}">€600</span>.<br><span style="font-weight:600;color:#3d5a50">Claim it yourself. Keep it all.</span></div>
  <div style="align-self:flex-start;background:{GREEN};color:white;font-weight:700;font-size:{int(px*0.55)}px;padding:{int(px*0.2)}px {int(px*0.5)}px;border-radius:999px">Free check · getkeepitall.com</div>
 </div></div></div>'''
    render(name,w,h,page(w,h,body))

# Master logo files
render("logo-icon",1024,1024,page(1024,1024,icon(1024)),transparent=True)
render("logo-horizontal",1600,400,page(1600,400,f'<div style="display:flex;align-items:center;gap:40px">{icon(300)}{wordmark(150)}</div>'),transparent=True)
render("logo-horizontal-white",1600,400,page(1600,400,f'<div style="display:flex;align-items:center;gap:40px">{icon(300)}{wordmark(150,"white")}</div>',bg=INK))

# Per platform
profile("tiktok-profile",1080)
profile("instagram-profile",1080)
profile("youtube-profile",800)
profile("facebook-profile",720)
profile("x-profile",400)
profile("pinterest-profile",600)
profile("reddit-profile",256)
banner("youtube-banner",2560,1440,1500,400)      # safe area for all devices: 1546x423
banner("facebook-cover",1640,624,1240,420)       # mobile shows the centre
banner("x-header",1500,500,1060,330,offset_x=240)             # profile photo overlaps bottom-left
banner("reddit-banner",1920,384,1500,300)

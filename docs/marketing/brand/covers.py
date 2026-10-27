# Renders the TikTok covers: python3 covers.py <dir with render.py and geist-latin.woff2> <output dir>
import sys, pathlib
S=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
src=(S/"render.py").read_text().split("# Master logo files")[0]
ns={"__name__":"covers"}; sys.argv=[sys.argv[0],str(S),str(OUT)]; exec(src,ns)
icon,page,render=ns["icon"],ns["page"],ns["render"]
def wordmark(px,color,accent):
    return f'<span style="font-family:Geist;font-weight:800;font-size:{px}px;letter-spacing:-0.02em;color:{color}">Keep<span style="color:{accent}">ItAll</span></span>'
G="#0f7a5a"; INK="#10241d"; GOLD="#f5b82e"
W,H=1080,1920
THEMES={
 "ink":dict(bg=f"linear-gradient(170deg,#173a2f 0%,{INK} 70%)",fg="white",sub="#bfe3d3",word="white",accent="#3fd19c"),
 "green":dict(bg="linear-gradient(170deg,#18a578 0%,#0f7a5a 75%)",fg="white",sub="#e3f6ee",word="white",accent=GOLD),
 "mint":dict(bg="linear-gradient(170deg,#f3faf6 0%,#d4efe2 100%)",fg=INK,sub="#3d5a50",word=INK,accent=G),
}
def cover(n,theme,top,big,sub):
    t=THEMES[theme]
    hl=f'<span style="background:{GOLD};color:{INK};padding:4px 18px;border-radius:16px;box-decoration-break:clone;-webkit-box-decoration-break:clone;line-height:1.32">{big}</span>'
    # Content stays inside x 80–940 and y ~300–1450: TikTok's grid shows the centre 3:4,
    # and the action buttons / caption cover the right edge and the bottom.
    body=f'''<div style="width:{W}px;height:{H}px;background:{t["bg"]};position:relative;color:{t["fg"]};font-family:Geist">
<div style="position:absolute;left:80px;top:300px;display:flex;align-items:center;gap:20px"><span style="display:flex;border-radius:50%;box-shadow:0 0 0 5px rgba(255,255,255,.9)">{icon(92)}</span>{wordmark(50,t["word"],t["accent"])}</div>
<div style="position:absolute;left:80px;width:860px;top:470px;height:900px;display:flex;flex-direction:column;justify-content:center;gap:44px">
 <div style="font-weight:800;font-size:96px;line-height:1.02;letter-spacing:-0.03em">{top}</div>
 <div style="font-weight:800;font-size:80px;letter-spacing:-0.025em">{hl}</div>
 <div style="font-size:46px;line-height:1.25;color:{t["sub"]};font-weight:600">{sub}</div>
</div>
<div style="position:absolute;left:80px;top:1390px;display:flex;align-items:center;gap:16px;font-size:34px;font-weight:700;color:{t["sub"]}"><span style="background:{GOLD};color:{INK};border-radius:999px;padding:6px 20px">{n}/10</span>Know your flight rights</div>
</div>'''
    render(f"tiktok-cover-{n:02d}",W,H,page(W,H,body))
C=[
 ("ink","3+ hours late?","You may be owed up to €600","Delays measured on arrival. EU261 &amp; UK261."),
 ("green","Claim companies take a third","Keep 100% instead","Claim it yourself in minutes."),
 ("mint","“Technical problem”?","Usually NOT a valid excuse","What airlines don’t tell you."),
 ("ink","When does your delay count?","Not when you land","The minutes that can matter."),
 ("green","Cancelled at short notice?","More than a refund","Less than 14 days’ notice? Check this."),
 ("mint","When you’re NOT owed anything","The honest list","Weather, ATC and more."),
 ("ink","Bumped from your flight?","Up to €600","Overbooked? Know your rights."),
 ("green","Airline offered a voucher?","Ask for cash instead","Don’t accept it too fast."),
 ("mint","That delayed flight last year?","You might still claim","Time limits vary by country."),
 ("ink","How to claim in 3 steps","Check · Send ·<br>Keep it all","Free check at getkeepitall.com"),
]
for i,(th,a,b,c) in enumerate(C,1): cover(i,th,a,b,c)

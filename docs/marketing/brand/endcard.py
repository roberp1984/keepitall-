# Renders the video end card: python3 endcard.py <dir with render.py and geist-latin.woff2> <output dir>
import sys, pathlib
S=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
src=(S/"render.py").read_text().split("# Master logo files")[0]
ns={"__name__":"endcard"}; sys.argv=[sys.argv[0],str(S),str(OUT)]; exec(src,ns)
icon,page,render=ns["icon"],ns["page"],ns["render"]
G="#0f7a5a"; INK="#10241d"; GOLD="#f5b82e"; W,H=1080,1920
body=f'''<div style="width:{W}px;height:{H}px;background:linear-gradient(170deg,#173a2f 0%,{INK} 70%);color:white;font-family:Geist;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;text-align:center">
<span style="display:flex;border-radius:50%;box-shadow:0 0 0 8px rgba(255,255,255,.9)">{icon(260)}</span>
<div style="font-weight:800;font-size:84px;letter-spacing:-0.02em">Keep<span style="color:#3fd19c">ItAll</span></div>
<div style="font-weight:800;font-size:76px;line-height:1.1;letter-spacing:-0.025em">Free check<br>in 60 seconds</div>
<div style="background:{GOLD};color:{INK};font-weight:800;font-size:64px;padding:22px 48px;border-radius:999px">getkeepitall.com</div>
<div style="font-size:46px;font-weight:600;color:#bfe3d3">Link in bio</div>
</div>'''
render("end-card",W,H,page(W,H,body))

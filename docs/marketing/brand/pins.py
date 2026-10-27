# Renders the Pinterest pins: python3 pins.py <dir with render.py and geist-latin.woff2> <output dir>
import sys, importlib.util, pathlib
S=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location("r", S/"render.py")
# reuse helpers without re-rendering: exec only the function defs
src=(S/"render.py").read_text().split("# Master logo files")[0]
ns={"__name__":"pins"}; sys.argv=[sys.argv[0],str(S),str(OUT)]; exec(src,ns)
icon,wordmark,page,render=ns["icon"],ns["wordmark"],ns["page"],ns["render"]
G="#0f7a5a"; INK="#10241d"; GOLD="#f5b82e"; MUTED="#3d5a50"
W,H=1000,1500
def pin(name,inner):
    body=f'''<div style="width:{W}px;height:{H}px;box-sizing:border-box;padding:70px 70px 56px;display:flex;flex-direction:column;background:linear-gradient(160deg,#f3faf6 0%,#dff2e9 100%);color:{INK}">
<div style="display:flex;align-items:center;gap:18px">{icon(84)}{wordmark(48)}</div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px">{inner}</div>
<div style="display:flex;flex-direction:column;align-items:center;gap:22px">
<div style="background:{G};color:white;font-weight:800;font-size:44px;padding:26px 48px;border-radius:999px">Free check · getkeepitall.com</div>
<div style="font-size:22px;color:{MUTED}">Not legal advice. We provide templates and information.</div></div></div>'''
    render(name,W,H,page(W,H,body))
h=lambda t,px=84: f'<div style="font-weight:800;font-size:{px}px;line-height:1.05;letter-spacing:-0.025em">{t}</div>'
p=lambda t,px=40: f'<div style="font-size:{px}px;line-height:1.3;color:{MUTED}">{t}</div>'
card=lambda inner,bg="white": f'<div style="background:{bg};border-radius:32px;padding:34px 40px;box-shadow:0 8px 30px rgba(16,36,29,.08)">{inner}</div>'

pin("pin-2-claim-companies",
 h('Claim companies take up to <span style="color:'+G+'">35%</span> of your compensation')+
 card(f'<div style="font-size:34px;color:{MUTED}">Claim company</div><div style="font-weight:800;font-size:64px">You keep €390 <span style="font-size:34px;color:{MUTED};font-weight:600">of €600</span></div>')+
 card(f'<div style="font-size:34px;color:#d8f3e7">Claim it yourself with KeepItAll</div><div style="font-weight:800;font-size:64px;color:white">You keep <span style="color:{GOLD}">€600</span></div>',bg=G)+
 p("A ready-to-send claim letter and step-by-step guide for a one-off €19."))

rows="".join(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:26px 0;border-bottom:2px solid #e3efe9"><span style="font-size:40px;font-weight:600">{d}</span><span style="font-size:52px;font-weight:800;color:{G}">{e} <span style="color:{MUTED};font-size:36px">/ {g}</span></span></div>' for d,e,g in [("Up to 1,500 km","€250","£220"),("1,500 – 3,500 km","€400","£350"),("Over 3,500 km","€600","£520")])
pin("pin-3-cheat-sheet",
 h("Flight delay compensation cheat sheet",80)+p("EU261 &amp; UK261 · per passenger, by flight distance",36)+
 card(rows)+
 p("You may be entitled if you arrived <b>3+ hours late</b>, your flight was <b>cancelled at short notice</b> or you were <b>denied boarding</b>, unless there were extraordinary circumstances such as bad weather.",34))

steps=["Check your flight for free (60 seconds)","See how much you may be owed","Get your ready-to-send claim letter","Send it to the airline yourself","Refused? Escalate with our templates"]
lst="".join(f'<div style="display:flex;align-items:center;gap:28px;padding:16px 0"><div style="flex:none;width:76px;height:76px;border-radius:50%;background:{G};color:white;font-weight:800;font-size:40px;display:flex;align-items:center;justify-content:center">{i}</div><div style="font-size:42px;font-weight:700;line-height:1.15">{s}</div></div>' for i,s in enumerate(steps,1))
pin("pin-4-five-steps",
 h('How to claim flight compensation <span style="color:'+G+'">yourself</span> in 5 steps',78)+card(lst)+
 p("The airline pays you directly. No commission.",40))

pin("pin-5-vouchers",
 h("Airline offered you a voucher?",88)+
 h(f'<span style="background:{GOLD};padding:2px 16px;border-radius:12px;box-decoration-break:clone;-webkit-box-decoration-break:clone;line-height:1.35">You can ask for cash instead</span>',76)+
 card(f'<div style="display:flex;gap:30px;align-items:center;justify-content:center;font-size:46px;font-weight:800"><span style="text-decoration:line-through;text-decoration-thickness:5px;color:{MUTED}">Voucher</span><span style="color:{G}">→</span><span style="color:{G}">Cash to your bank</span></div>')+
 p("Under EU261 and UK261, compensation is paid in money unless you agree in writing to a voucher. Our claim pack includes a ready-made reply.",36))

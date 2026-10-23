import json,urllib.request,urllib.parse,ssl,statistics,time,sys
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
B="https://prometheus.local.abbottland.io/api/v1/"
def qr(q,s,e,step):
    u=B+"query_range?"+urllib.parse.urlencode(dict(query=q,start=s,end=e,step=step))
    return json.load(urllib.request.urlopen(u,context=ctx,timeout=180))["data"]["result"]
names={'192.168.4.192:9100':('host chimaera',64),'192.168.5.91:9100':('marauders-map',10),'192.168.6.24:9100':('k8s controller',6),'192.168.6.25:9100':('worker-1',15),'192.168.6.26:9100':('worker-2',15),'192.168.6.27:9100':('worker-3',15)}
sel="|".join(k.replace(".","\\\\.") for k in names)
used=f"(node_memory_MemTotal_bytes{{instance=~\"{sel}\"}}-node_memory_MemAvailable_bytes{{instance=~\"{sel}\"}})/1073741824"
def stats(v):
    v=sorted(v); p=lambda x:v[min(len(v)-1,int(x*len(v)))]
    return statistics.mean(v),p(.5),p(.9),p(.99),v[-1],len(v)
now=int(time.time())
def collect(wins,step):
    d={}
    for s,e in wins:
        for ser in qr(used,s,e,step):
            d.setdefault(ser['metric']['instance'],[]).extend(float(x[1]) for x in ser['values'] if x[1]!='NaN')
    return d
for label,wins,step in [("LAST 30 DAYS (5m step)",[(now-30*86400,now)],300),("LAST 7 DAYS (1m step)",[(now-7*86400,now)],60),("DURING 19 CI RUNS (1m step)",json.load(open(sys.argv[1])),60)]:
    print("##",label)
    try: d=collect(wins,step)
    except Exception as ex: print("ERR",ex); continue
    for k,(n,tot) in names.items():
        if k in d:
            a,p50,p90,p99,mx,c=stats(d[k])
            print(f"  {n:15s} prov={tot:3d}G used avg={a:5.1f} p50={p50:5.1f} p90={p90:5.1f} p99={p99:5.1f} max={mx:5.1f}  p90/prov={p90/tot*100:3.0f}% max/prov={mx/tot*100:3.0f}% n={c}")

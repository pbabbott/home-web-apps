import sys, json, urllib.request, urllib.parse, ssl, statistics
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
B="https://prometheus.local.abbottland.io/api/v1/"
# CI windows (UTC epoch), from gh run list
wins=json.load(open(sys.argv[1]))
qs=json.load(open(sys.argv[2]))
def qr(q,s,e):
    u=B+"query_range?"+urllib.parse.urlencode(dict(query=q,start=s,end=e,step=60))
    return json.load(urllib.request.urlopen(u,context=ctx,timeout=60))["data"]["result"]
for name,q in qs.items():
    vals={}
    for w in wins:
        try: r=qr(q,w[0],w[1])
        except Exception as ex: print(name,"ERR",ex); continue
        for ser in r:
            k=json.dumps(ser["metric"],sort_keys=True)
            vals.setdefault(k,[]).extend(float(v[1]) for v in ser["values"] if v[1] not in("NaN","+Inf"))
    print("##",name)
    for k,v in sorted(vals.items()):
        if not v: continue
        v.sort(); p=lambda x:v[min(len(v)-1,int(x*len(v)))]
        print(f"  {k[:110]:110s} avg={statistics.mean(v):8.2f} p50={p(.5):8.2f} p90={p(.9):8.2f} max={v[-1]:8.2f}")

"""Build standalone, printable HTML from the maintained Markdown guides.
Requires markdown-it-py in the documentation environment; no app dependency.
"""
from pathlib import Path
import base64, html, os, re
from markdown_it import MarkdownIt

root=Path(__file__).resolve().parents[2]
docs=root/'docs'
outputs={docs/'USER_GUIDE.md':'USER_GUIDE.html', **{docs/'quick-start'/f'{role}.md':f'{role}.html' for role in ['STUDENT','INSTRUCTOR','ADMIN']}}
out=docs/'print';out.mkdir(exist_ok=True)
css='''body{font:16px/1.6 system-ui,sans-serif;color:#172b36;max-width:1050px;margin:2rem auto;padding:0 1.5rem}a{color:#006b75}h1,h2,h3{line-height:1.25;break-after:avoid}h1{font-size:2.2rem;border-bottom:4px solid #1b9a90;padding-bottom:.5rem}h2{margin-top:2.3rem}table{border-collapse:collapse;width:100%;font-size:.94rem;margin:1rem 0}th,td{border:1px solid #ccd7dc;text-align:left;padding:.5rem;vertical-align:top}th{background:#e9f3f2}img{display:block;max-width:100%;height:auto;border:1px solid #ccd7dc;margin:1rem auto}pre{background:#eef3f4;padding:1rem;white-space:pre-wrap}code{font-size:.9em}blockquote{border-left:4px solid #1b9a90;padding-left:1rem}nav{font-size:.9rem;border-bottom:1px solid #ccd7dc;padding-bottom:.7rem}p:has(+p>em)>img{margin-bottom:.2rem}p>em{font-size:.9rem;color:#465c66}@media print{@page{size:letter;margin:.55in}body{font-size:10pt;line-height:1.4;margin:0;padding:0;max-width:none}nav{display:none}h1{font-size:22pt}h2{font-size:15pt;margin-top:1.2rem}h3{font-size:12pt}img{max-height:7.5in;max-width:100%;width:auto;break-inside:avoid}tr{break-inside:avoid}thead{display:table-header-group}a{color:inherit;text-decoration:underline}body.quick img{max-height:2.25in}body.quick{font-size:9pt}body.quick h1{font-size:20pt}body.quick h2{font-size:12pt;margin-top:.8rem}body.quick table{font-size:9pt}body.quick p,body.quick li{margin-top:.2rem;margin-bottom:.35rem}}'''
for source,name in outputs.items():
    md=MarkdownIt('commonmark',{'html':False}).enable('table')
    tokens=md.parse(source.read_text())
    seen={}
    for i,t in enumerate(tokens):
        if t.type=='heading_open':
            text=tokens[i+1].content
            anchor=re.sub(r'[^\w\- ]','',text.lower()).replace(' ','-')
            count=seen.get(anchor,0);seen[anchor]=count+1
            t.attrSet('id',anchor+(f'-{count}' if count else ''))
        if t.children:
            for child in t.children:
                if child.type=='image':
                    path=(source.parent/child.attrGet('src')).resolve()
                    child.attrSet('src','data:image/jpeg;base64,'+base64.b64encode(path.read_bytes()).decode())
                elif child.type=='link_open':
                    target=child.attrGet('href')
                    if not target.startswith(('http:','https:','#','mailto:')):
                        path,sep,anchor=target.partition('#')
                        resolved=(source.parent/path).resolve()
                        child.attrSet('href',(outputs.get(resolved) or os.path.relpath(resolved,out))+(sep+anchor if sep else ''))
    title=source.read_text().splitlines()[0].lstrip('# ')
    body=md.renderer.render(tokens,md.options,{})
    nav='<nav><a href="USER_GUIDE.html">Full guide</a> · <a href="STUDENT.html">Student tips</a> · <a href="INSTRUCTOR.html">Instructor tips</a> · <a href="ADMIN.html">Admin tips</a> · Use your browser’s Print / Save as PDF.</nav>'
    output=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{css}</style></head><body class="{"quick" if name!="USER_GUIDE.html" else "guide"}">{nav}{body}</body></html>\n'
    # Also make the same four files usable from the app's /training allowlist.
    # Supplemental internal project notes are available in the repository, not published as training pages.
    output=re.sub(r'<a href="(?:\.\./)[^"]*"[^>]*>(.*?)</a>', r'<span>\1 (project repository)</span>', output, flags=re.S)
    (out/name).write_text(output)
    print(f'Built docs/print/{name}')

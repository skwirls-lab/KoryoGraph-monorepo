import type { NextRequest } from "next/server";

/**
 * Embeddable trial widget: <script src="https://…/widget/<school-slug>.js" async></script>
 * Inserts an iframe of the public trial form where the script tag sits, passing the host page's UTM params.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([a-z0-9-]{1,50})\.js$/.exec(file);
  if (!m) return new Response("// unknown widget", { status: 404, headers: { "content-type": "text/javascript" } });
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  const src = `${origin}/s/${m[1]}/trial`;
  const js = `(function(){
  var s=document.currentScript;var q=new URLSearchParams(location.search);var p=new URLSearchParams({embed:"1",ref:location.hostname});
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){if(q.get(k))p.set(k,q.get(k));});
  var f=document.createElement("iframe");f.src=${JSON.stringify(src)}+"?"+p.toString();f.title="Book a trial class";f.loading="lazy";
  f.style.cssText="width:100%;max-width:640px;min-height:760px;border:0;border-radius:12px;";
  (s&&s.parentNode?s.parentNode.insertBefore(f,s.nextSibling):document.body.appendChild(f));
})();`;
  return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}

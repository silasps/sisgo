'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, Code, ChevronDown, ChevronUp } from 'lucide-react'

type SchoolLink = {
  slug: string
  name: string
}

type EmbedTab = 'iframe' | 'modal'

function buildEmbedSnippet(embedUrl: string, slug: string) {
  return `<div style="min-width:320px;max-width:720px;margin:0 auto;width:100%">
  <iframe
    src="${embedUrl}"
    id="sisgo-form-${slug}"
    width="100%"
    height="600"
    style="border:none;display:block;min-width:320px;"
    loading="lazy"
  ></iframe>
</div>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    var el = document.getElementById('sisgo-form-${slug}');
    if (el) el.style.height = e.data.height + 'px';
  }
});
</script>`
}

function buildModalSnippet(embedUrl: string) {
  return `<!-- Cole este script UMA VEZ no seu site (antes de </body>) -->
<script>
(function(){
  var d=document,ov=d.createElement('div'),ct=d.createElement('div'),
      cl=d.createElement('button'),fr=d.createElement('iframe');
  ov.id='sisgo-overlay';
  ov.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;justify-content:center;align-items:center;padding:16px;box-sizing:border-box;';
  ct.style.cssText='background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);-webkit-overflow-scrolling:touch;';
  cl.innerHTML='&times;';
  cl.setAttribute('aria-label','Fechar');
  cl.style.cssText='position:sticky;top:0;float:right;font-size:28px;line-height:1;background:rgba(255,255,255,.9);border:none;cursor:pointer;color:#666;z-index:1;padding:8px 14px;border-radius:0 16px 0 8px;';
  fr.style.cssText='width:100%;min-height:500px;border:none;display:block;border-radius:0 0 16px 16px;';
  fr.setAttribute('loading','lazy');
  ct.appendChild(cl);ct.appendChild(fr);ov.appendChild(ct);
  function close(){ov.style.display='none';fr.src='about:blank';d.body.style.overflow='';}
  cl.onclick=close;
  ov.onclick=function(e){if(e.target===ov)close();};
  d.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov.style.display==='flex')close();});
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='sisgo-height')fr.style.height=e.data.height+'px';
  });
  d.body.appendChild(ov);
  window.sisgoModal=function(url){
    fr.src=url||'${embedUrl}';
    ov.style.display='flex';
    d.body.style.overflow='hidden';
  };
})();
</script>

<!-- Substitua o link do seu botão por isto: -->
<a href="${embedUrl}" onclick="event.preventDefault();sisgoModal()">Inscreva-se</a>`
}

export function InscricaoLinkCard({ orgSlug, schools }: { orgSlug: string; schools: SchoolLink[] }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedEmbed, setExpandedEmbed] = useState<string | null>(null)
  const [embedTab, setEmbedTab] = useState<EmbedTab>('iframe')
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2500)
  }

  if (schools.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-brand-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Formulário de pré-inscrição</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Compartilhe o link direto para receber pré-inscrições de alunos interessados.
        </p>
      </div>

      {schools.map(school => {
        const publicUrl = `${origin}/${orgSlug}/escola/${school.slug}/inscricao`
        const embedUrl = `${origin}/${orgSlug}/escola/${school.slug}/embed`
        const embedSnippet = buildEmbedSnippet(embedUrl, school.slug)
        const modalSnippet = buildModalSnippet(embedUrl)
        const isExpanded = expandedEmbed === school.slug
        const linkKey = `link-${school.slug}`
        const embedKey = `embed-${school.slug}`
        const modalKey = `modal-${school.slug}`
        const activeSnippet = embedTab === 'iframe' ? embedSnippet : modalSnippet
        const activeKey = embedTab === 'iframe' ? embedKey : modalKey

        return (
          <div key={school.slug} className="space-y-2">
            {schools.length > 1 && (
              <p className="text-xs font-semibold text-indigo-700">{school.name}</p>
            )}

            <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2">
              <input
                readOnly
                value={origin ? publicUrl : 'Carregando…'}
                className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate font-mono"
              />
              <button
                onClick={() => copyText(publicUrl, linkKey)}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {copied === linkKey ? <><Check className="size-3" /> Copiado!</> : <><Copy className="size-3" /> Copiar</>}
              </button>
              <a
                href={`/${orgSlug}/escola/${school.slug}/inscricao`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setExpandedEmbed(isExpanded ? null : school.slug)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Code className="size-3.5" />
              Código de incorporação
              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {isExpanded && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEmbedTab('iframe')}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        embedTab === 'iframe'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Embed (iframe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedTab('modal')}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        embedTab === 'modal'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Botão + Modal
                    </button>
                  </div>
                  <button
                    onClick={() => copyText(activeSnippet, activeKey)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      copied === activeKey
                        ? 'bg-green-100 text-green-700'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {copied === activeKey ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="p-3 text-xs text-gray-500 overflow-x-auto whitespace-pre font-mono leading-relaxed select-all">
                  {origin ? activeSnippet : 'Carregando…'}
                </pre>
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400">
                    {embedTab === 'iframe'
                      ? 'Cole este código no HTML do seu site. O iframe se redimensiona automaticamente.'
                      : 'Cole o <script> uma vez no site e use o <a> no lugar do botão do Google Forms.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

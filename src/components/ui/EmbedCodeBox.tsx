'use client'

import { useState, useEffect } from 'react'

type Tab = 'iframe' | 'modal'

export function EmbedCodeBox({ embedPath }: { embedPath: string }) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Tab>('iframe')
  const [embedUrl, setEmbedUrl] = useState('')

  useEffect(() => {
    setEmbedUrl(`${window.location.origin}${embedPath}`)
  }, [embedPath])

  const iframeSnippet = embedUrl
    ? `<div style="min-width:320px;max-width:720px;margin:0 auto;width:100%">
  <iframe
    src="${embedUrl}"
    id="sisgo-form"
    width="100%"
    height="600"
    style="border:none;display:block;min-width:320px;"
    loading="lazy"
  ></iframe>
</div>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'sisgo-height') {
    var el = document.getElementById('sisgo-form');
    if (el) el.style.height = e.data.height + 'px';
  }
});
</script>`
    : ''

  const modalSnippet = embedUrl
    ? `<!-- Cole este script UMA VEZ no seu site (antes de </body>) -->
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
    : ''

  const activeSnippet = tab === 'iframe' ? iframeSnippet : modalSnippet

  function handleCopy() {
    if (!activeSnippet) return
    navigator.clipboard.writeText(activeSnippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setTab('iframe'); setCopied(false) }}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              tab === 'iframe'
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Embed (iframe)
          </button>
          <button
            type="button"
            onClick={() => { setTab('modal'); setCopied(false) }}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
              tab === 'modal'
                ? 'bg-brand-100 text-brand-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Botão + Modal
          </button>
        </div>
        <button
          onClick={handleCopy}
          className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
          }`}
        >
          {copied ? '✓ Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-600 overflow-x-auto whitespace-pre font-mono leading-relaxed select-all">
        {activeSnippet || 'Carregando…'}
      </pre>
      <div className="px-4 py-2.5 border-t border-gray-100 bg-white">
        <p className="text-xs text-gray-400">
          {tab === 'iframe'
            ? 'Cole este código no HTML do seu site onde deseja exibir o formulário. O iframe se redimensiona automaticamente.'
            : 'Cole o <script> uma vez no site e use o <a> no lugar do botão do Google Forms.'}
        </p>
      </div>
    </div>
  )
}

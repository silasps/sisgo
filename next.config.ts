import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Permite que a página /embed seja incorporada em iframes de qualquer origem
        source: '/:slug/escola/:schoolSlug/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      // Seções de documentos enviam vários arquivos numa única action (até
      // 10MB cada, já validado em código) — com 10mb total, 4-5 arquivos
      // reais (fotos de RG, CNH, CPF, passaporte, foto 3x4) estouravam esse
      // limite e a Next.js nem chegava a rodar a action, retornando uma
      // resposta que o client não sabe interpretar ("An unexpected response
      // was received from the server"), travando o formulário sem nenhuma
      // mensagem clara. 50mb cobre o pior caso (todos os documentos no
      // limite individual de 10MB) com folga.
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
}

export default nextConfig

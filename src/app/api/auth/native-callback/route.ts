import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')

  if (!code) {
    return new Response('Missing code', { status: 400 })
  }

  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>window.location.replace("sisgo://auth/callback?code=${encodeURIComponent(code)}");</script>
<p style="font-family:system-ui;text-align:center;margin-top:40vh">Voltando ao SISGO…</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  )
}

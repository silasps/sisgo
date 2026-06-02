import { redirect } from 'next/navigation'

// Middleware já redireciona, mas por segurança:
export default function Home() {
  redirect('/login')
}

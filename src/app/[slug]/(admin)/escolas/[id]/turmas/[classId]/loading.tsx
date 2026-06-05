import { Header } from '@/components/layout/Header'
import { Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <Header title="Carregando..." />
      <main className="p-4 md:p-6 space-y-6">
        <Sk className="h-72 rounded-xl" />
        <Sk className="h-48 rounded-xl" />
      </main>
    </>
  )
}

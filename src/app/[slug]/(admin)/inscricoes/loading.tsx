import { Header } from '@/components/layout/Header'
import { Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <Header title="Inscrições" />
      <main className="p-4 md:p-6 space-y-3">
        {[...Array(5)].map((_, i) => <Sk key={i} className="h-20 rounded-xl" />)}
      </main>
    </>
  )
}

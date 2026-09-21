import { SkHeader, Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <main className="p-4 md:p-6 space-y-6">
        <Sk className="h-72 rounded-xl" />
        <Sk className="h-48 rounded-xl" />
      </main>
    </>
  )
}

import { SkHeader, Sk, SkStatCards } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-6 space-y-6 max-w-4xl">
        <Sk className="h-12 w-full rounded-xl" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <Sk className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Sk className="h-3 w-16" />
                <Sk className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
        <SkStatCards n={5} />
      </div>
    </>
  )
}

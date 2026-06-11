import { SkHeader, SkStatCards, Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-4">
        <SkStatCards n={2} />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <Sk className="w-10 h-6 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-4 w-48" />
                <Sk className="h-3 w-32" />
              </div>
              <Sk className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

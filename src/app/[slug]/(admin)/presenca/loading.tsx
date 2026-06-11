import { SkHeader, SkStatCards, Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-4">
        <SkStatCards n={2} />
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Sk className="w-9 h-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-4 w-40" />
                <Sk className="h-3 w-24" />
              </div>
              <Sk className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

import { SkHeader, Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-6 max-w-lg space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Sk className="h-5 w-28" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex justify-between">
                <Sk className="h-4 w-20" />
                <Sk className="h-4 w-32" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

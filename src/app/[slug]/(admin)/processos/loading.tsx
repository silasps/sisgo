import { SkHeader, Sk } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-5 max-w-5xl w-full mx-auto">
        <Sk className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <Sk className="h-4 w-40" />
              <Sk className="h-3 w-56" />
              <Sk className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

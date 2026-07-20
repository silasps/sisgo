import { SkHeader, Sk } from '@/components/ui/Skeleton'

function SkStatCard() {
  return (
    <div className="bg-gray-100 rounded-xl p-4 flex flex-col gap-2">
      <Sk className="w-6 h-6 rounded" />
      <Sk className="h-7 w-14" />
      <Sk className="h-3 w-20" />
    </div>
  )
}

function SkSectionCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Sk className="h-4 w-28" />
        <Sk className="h-3 w-16" />
      </div>
      <div className="p-4 flex-1">
        {tall ? (
          <Sk className="h-40 w-full rounded-lg" />
        ) : (
          <div className="space-y-2.5">
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-5/6" />
            <Sk className="h-3 w-3/4" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkStatCard key={i} />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkSectionCard key={i} />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkSectionCard tall />
          <SkSectionCard tall />
        </div>
      </div>
    </>
  )
}

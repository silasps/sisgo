import { SkHeader, SkCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-24 animate-pulse" />
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SkCardGrid n={4} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-32 animate-pulse" />
      </div>
    </>
  )
}

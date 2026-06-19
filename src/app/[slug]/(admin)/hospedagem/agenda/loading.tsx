import { SkHeader } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-50 rounded-xl border border-gray-200 animate-pulse" />
      </div>
    </>
  )
}

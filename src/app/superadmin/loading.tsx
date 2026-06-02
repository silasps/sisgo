import { SkHeader, SkStatCards, SkTable } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-6 space-y-8">
        <SkStatCards n={3} />
        <div className="space-y-4">
          <div className="shimmer h-5 w-32" />
          <SkTable rows={4} cols={5} />
        </div>
      </div>
    </>
  )
}

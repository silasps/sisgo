import { SkHeader, SkStatCards, SkCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-6">
        <SkStatCards n={4} />
        <SkCardGrid n={3} />
      </div>
    </>
  )
}

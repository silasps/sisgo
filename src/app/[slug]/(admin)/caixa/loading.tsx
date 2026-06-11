import { SkHeader, SkStatCards, SkTable } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6 space-y-6">
        <SkStatCards n={3} />
        <SkTable rows={6} cols={3} />
      </div>
    </>
  )
}

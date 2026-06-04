import { SkHeader, SkStatCards } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-6">
        <SkStatCards n={4} />
      </div>
    </>
  )
}

import { SkHeader, SkCardGrid } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-6"><SkCardGrid n={6} /></div>
    </>
  )
}

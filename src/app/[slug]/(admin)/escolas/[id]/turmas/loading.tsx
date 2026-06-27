import { SkHeader, SkTable } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <>
      <SkHeader />
      <div className="p-4 md:p-6"><SkTable rows={5} cols={5} /></div>
    </>
  )
}

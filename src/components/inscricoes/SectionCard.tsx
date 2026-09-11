'use client'

import { useStickyHeaderHeight } from './StickyPageHeader'

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const headerHeight = useStickyHeaderHeight()

  return (
    <details className="group bg-white rounded-xl border border-gray-200" open>
      <summary
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 sticky z-[5] bg-white rounded-t-xl group-open:border-b group-open:border-gray-100"
        style={{ top: headerHeight }}
      >
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-5 pb-5">
        {children}
      </div>
    </details>
  )
}

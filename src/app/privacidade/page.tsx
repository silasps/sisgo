import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { PrivacyPolicyContent } from '@/components/marketing/PrivacyPolicyContent'

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <MarketingHeader />
      <PrivacyPolicyContent />
      <MarketingFooter />
    </div>
  )
}

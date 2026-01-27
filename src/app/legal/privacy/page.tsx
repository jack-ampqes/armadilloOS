import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Privacy Policy | Armadillo Safety Products',
  description: 'Privacy Policy for Armadillo Safety Products management software',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#181818] text-white p-6 lg:p-10">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" asChild className="mb-6 text-white/70 hover:text-white">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-white/60 text-sm mb-8">Last updated: January 2025</p>

        <Card className="bg-[#1f1f1f] border-white/20">
          <CardContent className="p-6 lg:p-8 space-y-6 text-white/90 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
              <p>
                Armadillo Safety Products (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Armadillo management software (&quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our Service. By using the Service, you consent to the practices described here.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
              <p>We may collect:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>
                  <strong className="text-white">Account and profile data:</strong> name, email, role, and login credentials you provide when signing up or updating your profile.
                </li>
                <li>
                  <strong className="text-white">Business data:</strong> orders, quotes, customers, inventory, products, sales reps, distributors, and related content you create or upload in the Service.
                </li>
                <li>
                  <strong className="text-white">Usage data:</strong> how you use the Service (e.g., pages visited, actions taken) to improve the product and support.
                </li>
                <li>
                  <strong className="text-white">Device and log data:</strong> IP address, browser type, and similar technical information when you access the Service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>provide, operate, and maintain the Service;</li>
                <li>authenticate users and manage accounts;</li>
                <li>process and store your business data (orders, quotes, inventory, etc.);</li>
                <li>improve the Service, fix issues, and develop new features;</li>
                <li>communicate with you about the Service, security, or policy changes;</li>
                <li>comply with legal obligations and enforce our terms.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">4. Sharing and Disclosure</h2>
              <p>
                We do not sell your personal information. We may share information:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>with service providers (e.g., hosting, databases, auth) who assist in operating the Service under confidentiality obligations;</li>
                <li>when integrating with third-party services you connect (e.g., Shopify, QuickBooks), as governed by their respective policies;</li>
                <li>if required by law, court order, or government request, or to protect our rights, safety, or property;</li>
                <li>in connection with a merger, sale, or other transfer of assets, with notice to you as required by law.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention and Security</h2>
              <p>
                We retain your data for as long as your account is active or as needed to provide the Service and comply with legal obligations. We use administrative, technical, and physical measures to help protect your information against unauthorized access, loss, or alteration. No method of transmission or storage is completely secure; you use the Service at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights and Choices</h2>
              <p>
                Depending on your location, you may have the right to access, correct, delete, or restrict processing of your personal data, or to data portability. You can update account and profile information in the Service. To exercise other rights or ask questions, contact us through your account or designated support channel. You may also have the right to lodge a complaint with a supervisory authority.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">7. Cookies and Similar Technologies</h2>
              <p>
                We use cookies and similar technologies to maintain your session, remember preferences, and understand how the Service is used. You can adjust browser settings to limit or block cookies; some features may not work correctly if cookies are disabled.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">8. Children</h2>
              <p>
                The Service is not intended for individuals under the age of 16. We do not knowingly collect personal information from children under 16. If you believe we have collected such information, please contact us so we can delete it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will post the revised policy in the Service and update the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy. Where required by law, we will seek your consent for material changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
              <p>
                For questions or requests about this Privacy Policy or our privacy practices, contact Armadillo Safety Products through your account, your designated support channel, or the contact details provided in your agreement with us.
              </p>
            </section>

            <p className="pt-4 text-white/60 text-xs">
              This policy applies to the Armadillo management software and related services operated by Armadillo Safety Products.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

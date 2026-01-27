import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'End-User License Agreement | Armadillo Safety Products',
  description: 'End-User License Agreement for Armadillo Safety Products management software',
}

export default function EULAPage() {
  return (
    <div className="min-h-screen bg-[#181818] text-white p-6 lg:p-10">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" asChild className="mb-6 text-white/70 hover:text-white">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <h1 className="text-3xl font-bold text-white mb-2">End-User License Agreement</h1>
        <p className="text-white/60 text-sm mb-8">Last updated: January 2025</p>

        <Card className="bg-[#1f1f1f] border-white/20">
          <CardContent className="p-6 lg:p-8 space-y-6 text-white/90 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">1. Agreement</h2>
              <p>
                This End-User License Agreement (&quot;EULA&quot;) is a legal agreement between you (either an individual or a single entity) and Armadillo Safety Products for the Armadillo management software and associated documentation (&quot;Software&quot;). By accessing or using the Software, you agree to be bound by this EULA. If you do not agree, do not use the Software.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">2. License Grant</h2>
              <p>
                Subject to the terms of this EULA, Armadillo Safety Products grants you a limited, non-exclusive, non-transferable license to use the Software for your internal business purposes. The license permits use only by authorized users for managing orders, inventory, customers, quotes, and related operations as provided through the Software.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">3. Restrictions</h2>
              <p>You may not:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>copy, modify, or create derivative works of the Software;</li>
                <li>reverse engineer, decompile, or disassemble the Software except to the extent permitted by applicable law;</li>
                <li>rent, lease, lend, sell, sublicense, or otherwise transfer the Software or your rights under this EULA;</li>
                <li>use the Software for any illegal or unauthorized purpose;</li>
                <li>remove or alter any proprietary notices on the Software;</li>
                <li>use the Software to build a competing product or service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">4. Ownership</h2>
              <p>
                Armadillo Safety Products retains all right, title, and interest in and to the Software, including all intellectual property rights. This EULA does not grant you any rights to trademarks, logos, or branding of Armadillo Safety Products.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">5. Term and Termination</h2>
              <p>
                This EULA is effective until terminated. Your rights under this license will terminate automatically without notice if you fail to comply with any term. Upon termination, you must cease all use of the Software and destroy any copies. Sections that by their nature should survive (including ownership, disclaimers, and limitation of liability) will survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">6. Disclaimer of Warranties</h2>
              <p>
                THE SOFTWARE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. ARMADILLO SAFETY PRODUCTS DOES NOT WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARMADILLO SAFETY PRODUCTS AND ITS SUPPLIERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THIS EULA OR USE OF THE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL TOTAL LIABILITY EXCEED THE AMOUNT PAID BY YOU FOR THE SOFTWARE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">8. General</h2>
              <p>
                This EULA constitutes the entire agreement between you and Armadillo Safety Products regarding the Software. It may be amended only in writing. If any provision is held invalid, the remaining provisions remain in effect. Governing law and venue will be as agreed with Armadillo Safety Products or, in the absence of agreement, the laws of the jurisdiction of Armadillo Safety Products’ principal place of business.
              </p>
            </section>

            <p className="pt-4 text-white/60 text-xs">
              For questions about this EULA, contact Armadillo Safety Products through your account or designated support channel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

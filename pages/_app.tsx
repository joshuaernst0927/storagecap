import type { AppProps } from 'next/app'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import Layout from '@/components/Layout'
import '@/styles/globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${cormorant.variable} ${jost.variable}`}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  )
}

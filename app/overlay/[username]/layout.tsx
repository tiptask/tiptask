import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'TipTask Overlay' }
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><style>{`*{margin:0;padding:0;box-sizing:border-box;}html,body{background:transparent!important;background-color:transparent!important;overflow:hidden;width:100vw;height:100vh;}`}</style></head>
      <body style={{ background: 'transparent', backgroundColor: 'transparent' }}>{children}</body>
    </html>
  )
}

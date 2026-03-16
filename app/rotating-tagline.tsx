'use client'
import { useEffect, useState } from 'react'

const TAGLINES = [
  'Get paid for what you do best.',
  'Tips. Tasks. Get paid instantly.',
  'Your audience pays. You perform. Simple.',
  'For creators, coaches, performers & more.',
  'Accept tips and task requests — live.',
]

export default function RotatingTagline() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % TAGLINES.length)
        setVisible(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <p
      className="text-white/50 text-lg mb-4 leading-relaxed min-h-[2rem] transition-all duration-400"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}>
      {TAGLINES[index]}
    </p>
  )
}

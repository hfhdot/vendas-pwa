import { useState, useRef } from 'react'

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef(null)

  const THRESHOLD = 80

  function handleTouchStart(e) {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
    }
  }

  function handleTouchMove(e) {
    if (!startY.current || refreshing) return
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      setPulling(true)
      setPullDistance(Math.min(diff * 0.5, 120))
    }
  }

  async function handleTouchEnd() {
    if (!pulling) return
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(50)
      await onRefresh()
      setRefreshing(false)
    }
    setPulling(false)
    setPullDistance(0)
    startY.current = 0
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Indicador */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        {refreshing ? (
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <p className="text-xs text-slate-400">
            {pullDistance >= THRESHOLD ? 'Solte para atualizar' : 'Puxe para atualizar'}
          </p>
        )}
      </div>

      {children}
    </div>
  )
}

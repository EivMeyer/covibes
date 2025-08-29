import React, { useEffect, useRef, useState } from 'react'

interface MetricsData {
  cpu?: number[]      // CPU usage history (last 30 values)
  memory?: number[]   // Memory usage history
  outputRate?: number[] // Lines per second history
  timestamp?: number
}

interface AgentMetricsProps {
  metrics?: MetricsData
  compact?: boolean
}

export const AgentMetrics: React.FC<AgentMetricsProps> = ({ 
  metrics, 
  compact = false 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentMetrics, setCurrentMetrics] = useState<MetricsData>({
    cpu: [],
    memory: [],
    outputRate: [],
  })

  // Generate mock data for demo purposes (remove when real metrics are available)
  useEffect(() => {
    if (!metrics) {
      // Generate smooth mock data
      const mockInterval = setInterval(() => {
        setCurrentMetrics(prev => ({
          cpu: [...(prev.cpu || []).slice(-29), 20 + Math.random() * 60],
          memory: [...(prev.memory || []).slice(-29), 30 + Math.random() * 40],
          outputRate: [...(prev.outputRate || []).slice(-29), Math.random() * 10],
          timestamp: Date.now(),
        }))
      }, 1000)
      
      return () => clearInterval(mockInterval)
    } else {
      setCurrentMetrics(metrics)
    }
  }, [metrics])

  // Draw sparkline graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size (account for device pixel ratio)
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)
    
    // Draw CPU usage sparkline
    if (currentMetrics.cpu && currentMetrics.cpu.length > 0) {
      drawSparkline(ctx, currentMetrics.cpu, rect.width, rect.height, '#10b981') // Green
    }
    
    // Draw output rate sparkline (overlaid)
    if (currentMetrics.outputRate && currentMetrics.outputRate.length > 0) {
      drawSparkline(ctx, currentMetrics.outputRate.map(v => v * 10), rect.width, rect.height, '#3b82f6', 0.5) // Blue
    }
  }, [currentMetrics])

  const drawSparkline = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    width: number,
    height: number,
    color: string,
    opacity: number = 0.8
  ) => {
    if (data.length < 2) return
    
    const padding = compact ? 2 : 4
    const graphWidth = width - padding * 2
    const graphHeight = height - padding * 2
    const stepX = graphWidth / (data.length - 1)
    
    // Find min and max for scaling
    const max = Math.max(...data, 100)
    const min = 0
    const range = max - min || 1
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, color + '40') // 25% opacity at top
    gradient.addColorStop(1, color + '00') // 0% opacity at bottom
    
    // Draw filled area
    ctx.beginPath()
    ctx.moveTo(padding, height - padding)
    
    data.forEach((value, index) => {
      const x = padding + index * stepX
      const y = padding + (1 - (value - min) / range) * graphHeight
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        // Smooth curve using quadratic bezier
        const prevX = padding + (index - 1) * stepX
        const prevY = padding + (1 - (data[index - 1] - min) / range) * graphHeight
        const cpX = (prevX + x) / 2
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2)
      }
    })
    
    // Complete the filled area
    const lastX = padding + (data.length - 1) * stepX
    const lastY = padding + (1 - (data[data.length - 1] - min) / range) * graphHeight
    ctx.lineTo(lastX, height - padding)
    ctx.lineTo(padding, height - padding)
    ctx.closePath()
    
    ctx.fillStyle = gradient
    ctx.fill()
    
    // Draw line
    ctx.beginPath()
    data.forEach((value, index) => {
      const x = padding + index * stepX
      const y = padding + (1 - (value - min) / range) * graphHeight
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        const prevX = padding + (index - 1) * stepX
        const prevY = padding + (1 - (data[index - 1] - min) / range) * graphHeight
        const cpX = (prevX + x) / 2
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2)
      }
    })
    
    ctx.strokeStyle = color + Math.round(opacity * 255).toString(16).padStart(2, '0')
    ctx.lineWidth = compact ? 1 : 1.5
    ctx.stroke()
    
    // Draw current value dot
    if (data.length > 0) {
      const lastValue = data[data.length - 1]
      const lastX = padding + (data.length - 1) * stepX
      const lastY = padding + (1 - (lastValue - min) / range) * graphHeight
      
      ctx.beginPath()
      ctx.arc(lastX, lastY, compact ? 2 : 3, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      
      // Glow effect
      ctx.beginPath()
      ctx.arc(lastX, lastY, compact ? 4 : 6, 0, Math.PI * 2)
      ctx.fillStyle = color + '20'
      ctx.fill()
    }
  }

  // Get latest values for display
  const latestCPU = currentMetrics.cpu?.[currentMetrics.cpu.length - 1] || 0
  const latestMemory = currentMetrics.memory?.[currentMetrics.memory.length - 1] || 0
  const latestOutputRate = currentMetrics.outputRate?.[currentMetrics.outputRate.length - 1] || 0

  if (compact) {
    return (
      <div className="relative h-8 bg-gray-900/30 rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'crisp-edges' }}
        />
        <div className="absolute top-0.5 right-1 flex items-center space-x-2 text-[9px]">
          <span className="text-green-400/70">
            {latestCPU.toFixed(0)}%
          </span>
          <span className="text-blue-400/70">
            {latestOutputRate.toFixed(1)}/s
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3 bg-gray-900/30 rounded-lg">
      {/* Main graph */}
      <div className="relative h-16 bg-gray-900/50 rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>
      
      {/* Metrics labels */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-gray-400">CPU</span>
            <span className="text-green-400 font-mono">{latestCPU.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
            <span className="text-gray-400">Output</span>
            <span className="text-blue-400 font-mono">{latestOutputRate.toFixed(1)}/s</span>
          </div>
          {latestMemory > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span className="text-gray-400">Mem</span>
              <span className="text-purple-400 font-mono">{latestMemory.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <span className="text-gray-600">Last 30s</span>
      </div>
    </div>
  )
}
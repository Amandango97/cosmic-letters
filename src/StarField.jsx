// StarField.jsx — animated star canvas, purely visual
// To adjust: star density, speed, shooting star frequency are at the top of initStars()

import { useEffect, useRef } from 'react'

export default function StarField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId
    let stars = []
    let shooters = []
    let W, H

    let resizeTimer

    function resize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        W = canvas.width  = window.innerWidth  * (window.devicePixelRatio || 1)
        H = canvas.height = window.innerHeight * (window.devicePixelRatio || 1)
        canvas.style.width  = window.innerWidth  + 'px'
        canvas.style.height = window.innerHeight + 'px'
        initStars()
      }, 200)
    }

    function initStars() {
      const density    = 1600   // lower = more stars
      const maxRadius  = 1.2    // px
      const driftSpeed = 0.05   // vertical drift
      const twinkleSpeed = 0.003

      stars = []
      const n = Math.floor(W * H / ((window.devicePixelRatio || 1) ** 2 * density))
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * maxRadius + 0.2,
          a: Math.random(),
          da: (Math.random() - 0.5) * twinkleSpeed,
          dy: Math.random() * driftSpeed + 0.005,
          hue: Math.random() < 0.15 ? 270 + Math.random() * 50 : 0,
        })
      }
    }

    function maybeShoot() {
      const frequency = 0.006  // chance per frame
      if (Math.random() < frequency) {
        shooters.push({
          x: Math.random() * W * 0.7,
          y: Math.random() * H * 0.3,
          vx: (Math.random() * 2 + 1.5) * (window.devicePixelRatio || 1),
          vy: (Math.random() * 0.8 + 0.3) * (window.devicePixelRatio || 1),
          life: 1,
          decay: 0.025 + Math.random() * 0.015,
          len: 55 + Math.random() * 70,
        })
      }
    }

    function frame() {
      ctx.clearRect(0, 0, W, H)

      stars.forEach(s => {
        s.a += s.da
        if (s.a > 1 || s.a < 0.08) s.da *= -1
        s.y += s.dy
        if (s.y > H) s.y = 0
        ctx.fillStyle = s.hue
          ? `hsla(${s.hue},75%,78%,${s.a})`
          : `rgba(215,210,238,${s.a * 0.85})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * (window.devicePixelRatio || 1), 0, Math.PI * 2)
        ctx.fill()
      })

      maybeShoot()
      shooters = shooters.filter(s => s.life > 0)
      shooters.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.life -= s.decay
        const vl = Math.max(Math.abs(s.vx), 0.1)
        const g = ctx.createLinearGradient(
          s.x - s.vx * s.len / vl, s.y - s.vy * s.len / vl, s.x, s.y
        )
        g.addColorStop(0, 'rgba(200,180,255,0)')
        g.addColorStop(1, `rgba(220,200,255,${s.life * 0.65})`)
        ctx.strokeStyle = g
        ctx.lineWidth = window.devicePixelRatio || 1
        ctx.beginPath()
        ctx.moveTo(s.x - s.vx * s.len / vl, s.y - s.vy * s.len / vl)
        ctx.lineTo(s.x, s.y)
        ctx.stroke()
      })

      animId = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    frame()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="stars-canvas" />
}

/**
 * A real spring as a CSS `linear()` easing, sampled from the damped-oscillator
 * step response. Apple-style parameters: `duration` is the perceptual length
 * (it reads as done by then), `bounce` 0 is critically damped and 0.3 is playful.
 * The curve is sampled until the spring is truly at rest (within 0.2%), and that
 * settle time is returned so the CSS animation ends exactly when the motion does,
 * with no snap at the end.
 */
export function springEasing(duration = 0.45, bounce = 0.3) {
  const w = (2 * Math.PI) / duration
  const z = 1 - bounce
  const wd = w * Math.sqrt(1 - z * z)
  const at = (t: number) => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
  // envelope / sqrt(1 - z²) bounds the error; solve it for 0.2%
  const settle = Math.log(1 / (0.002 * Math.sqrt(1 - z * z))) / (z * w)
  const samples = 60
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) pts.push(String(i === samples ? 1 : Math.round(at((i / samples) * settle) * 10000) / 10000))
  return { easing: `linear(${pts.join(', ')})`, ms: Math.round(settle * 1000) }
}

/** Published once as CSS variables so stylesheets can use the spring directly. */
export function installSpring() {
  const pop = springEasing(0.45, 0.3)
  document.documentElement.style.setProperty('--sp-spring-pop', pop.easing)
  document.documentElement.style.setProperty('--sp-spring-pop-ms', `${pop.ms}ms`)
}

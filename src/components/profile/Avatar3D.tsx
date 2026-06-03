import { Component, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { ContactShadows, Float, OrbitControls } from '@react-three/drei'
import { TextureLoader } from 'three'
import { TEAM_COLORS } from '../../config/workItems'
import type { Employee } from '../../types'

// Tiny error boundary so a missing photo never crashes the canvas.
class Safe extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const SKIN = '#e8b48c'
const HAIR = '#241c1c'

function PhotoFace({ src }: { src: string }) {
  const tex = useLoader(TextureLoader, src)
  return (
    <mesh position={[0, 1.5, 0.46]}>
      <circleGeometry args={[0.42, 48]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

function Figure({ employee }: { employee: Employee }) {
  const teamColor = TEAM_COLORS[employee.team] ?? '#6d5efc'
  const isFemale = employee.gender === 'female'
  // Saree: warmer drape colour; Kurta: team colour.
  const garment = isFemale ? '#d6336c' : teamColor
  const accent = isFemale ? teamColor : '#f4f1ea'

  return (
    <group position={[0, -0.6, 0]}>
      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      {/* Hair / top */}
      <mesh position={[0, 1.72, isFemale ? -0.06 : 0]} castShadow>
        <sphereGeometry args={[isFemale ? 0.56 : 0.52, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <meshStandardMaterial color={HAIR} roughness={0.8} />
      </mesh>
      {/* Optional cartoon photo on the face */}
      {employee.photo && (
        <Safe fallback={null}>
          <Suspense fallback={null}>
            <PhotoFace src={employee.photo} />
          </Suspense>
        </Safe>
      )}
      {/* Neck */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.25, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      {/* Kurta / saree body (tapered) */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.78, 1.5, 40]} />
        <meshStandardMaterial color={garment} roughness={0.5} />
      </mesh>
      {/* Collar / neckline accent */}
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.05, 16, 40]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      {/* Saree pallu drape (diagonal sash) for women */}
      {isFemale && (
        <mesh position={[0.12, 0.5, 0.28]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.18, 1.3, 0.06]} />
          <meshStandardMaterial color={accent} roughness={0.5} />
        </mesh>
      )}
      {/* Arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.52, 0.5, 0]} rotation={[0, 0, s * 0.18]} castShadow>
          <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
          <meshStandardMaterial color={garment} roughness={0.5} />
        </mesh>
      ))}
      {/* Pyjama / legs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.22, -0.85, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.13, 0.9, 20]} />
          <meshStandardMaterial color={isFemale ? garment : '#f4f1ea'} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export default function Avatar3D({ employee }: { employee: Employee }) {
  return (
    <Canvas camera={{ position: [0, 0.5, 4.2], fov: 42 }} dpr={[1, 2]} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#9bb8ff" />
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.7}>
        <Figure employee={employee} />
      </Float>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.35} scale={6} blur={2.4} far={3} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.8} />
    </Canvas>
  )
}

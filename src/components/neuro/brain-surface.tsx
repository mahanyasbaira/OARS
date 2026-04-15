'use client'

import { useRef, useMemo, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { activationsToColors } from './colormap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BrainMesh {
  vertices: number[][]
  faces: number[][]
  hemisphere_split: number
}

interface BrainSurfaceProps {
  /** Flat array of per-vertex activation values (length = mesh.vertices.length) */
  activations: number[]
  /** Which frames to animate; if provided, animates through cortical_frames */
  frames?: number[][]
  /** View: 'lateral-left' | 'lateral-right' | 'top' | 'both' */
  view?: 'lateral-left' | 'lateral-right' | 'top' | 'both'
  height?: number
}

// ---------------------------------------------------------------------------
// Internal mesh builder
// ---------------------------------------------------------------------------
function BrainGeometry({
  mesh,
  activations,
}: {
  mesh: BrainMesh
  activations: number[]
}) {
  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(mesh.vertices.length * 3)
    for (let i = 0; i < mesh.vertices.length; i++) {
      positions[i * 3]     = mesh.vertices[i][0]
      positions[i * 3 + 1] = mesh.vertices[i][1]
      positions[i * 3 + 2] = mesh.vertices[i][2]
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const indices = new Uint32Array(mesh.faces.length * 3)
    for (let i = 0; i < mesh.faces.length; i++) {
      indices[i * 3]     = mesh.faces[i][0]
      indices[i * 3 + 1] = mesh.faces[i][1]
      indices[i * 3 + 2] = mesh.faces[i][2]
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
    return geometry
  }, [mesh])

  // Update colors whenever activations change
  const colorAttr = useMemo(() => {
    const colors = activationsToColors(activations, mesh.vertices.length)
    return new THREE.BufferAttribute(colors, 3)
  }, [activations, mesh.vertices.length])

  useEffect(() => {
    geo.setAttribute('color', colorAttr)
    geo.attributes.color.needsUpdate = true
  }, [geo, colorAttr])

  return (
    <mesh geometry={geo}>
      <meshPhongMaterial
        vertexColors
        shininess={20}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Animated brain: cycles through frames
// ---------------------------------------------------------------------------
function AnimatedBrain({
  mesh,
  frames,
}: {
  mesh: BrainMesh
  frames: number[][]
}) {
  const ref = useRef<THREE.Mesh>(null)
  const frameIdx = useRef(0)
  const elapsed = useRef(0)
  const FRAME_DURATION = 0.6 // seconds per frame

  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(mesh.vertices.length * 3)
    for (let i = 0; i < mesh.vertices.length; i++) {
      positions[i * 3]     = mesh.vertices[i][0]
      positions[i * 3 + 1] = mesh.vertices[i][1]
      positions[i * 3 + 2] = mesh.vertices[i][2]
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const indices = new Uint32Array(mesh.faces.length * 3)
    for (let i = 0; i < mesh.faces.length; i++) {
      indices[i * 3]     = mesh.faces[i][0]
      indices[i * 3 + 1] = mesh.faces[i][1]
      indices[i * 3 + 2] = mesh.faces[i][2]
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()

    const colors = activationsToColors(frames[0], mesh.vertices.length)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geometry
  }, [mesh, frames])

  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current >= FRAME_DURATION) {
      elapsed.current = 0
      frameIdx.current = (frameIdx.current + 1) % frames.length
      const colors = activationsToColors(frames[frameIdx.current], mesh.vertices.length)
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.attributes.color.needsUpdate = true
    }
  })

  return (
    <mesh ref={ref} geometry={geo}>
      <meshPhongMaterial vertexColors shininess={20} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Scene wrapper
// ---------------------------------------------------------------------------
function Scene({
  mesh,
  activations,
  frames,
}: {
  mesh: BrainMesh
  activations: number[]
  frames?: number[][]
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 280]} fov={45} />
      <OrbitControls enablePan={false} minDistance={150} maxDistance={450} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 150]} intensity={0.8} />
      <directionalLight position={[-100, -100, -100]} intensity={0.3} />
      {frames && frames.length > 1 ? (
        <AnimatedBrain mesh={mesh} frames={frames} />
      ) : (
        <BrainGeometry mesh={mesh} activations={activations} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Colorbar legend
// ---------------------------------------------------------------------------
function Colorbar() {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1">
      <span className="text-[10px] text-white/80">High</span>
      <div
        className="w-3 h-24 rounded"
        style={{
          background: 'linear-gradient(to bottom, #fff, #ef4444, #f97316, #fbbf24, #374151)',
        }}
      />
      <span className="text-[10px] text-white/80">Low</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------
export function BrainSurface({ activations, frames, height = 400 }: BrainSurfaceProps) {
  const [mesh, setMesh] = useState<BrainMesh | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/brain/fsaverage5.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load mesh: ${r.status}`)
        return r.json()
      })
      .then((data: BrainMesh) => setMesh(data))
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div
        className="rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Brain mesh unavailable: {error}
      </div>
    )
  }

  if (!mesh) {
    return (
      <div
        className="rounded-lg border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground animate-pulse"
        style={{ height }}
      >
        Loading brain mesh…
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-black" style={{ height }}>
      <Canvas>
        <Suspense fallback={null}>
          <Scene mesh={mesh} activations={activations} frames={frames} />
        </Suspense>
      </Canvas>
      <Colorbar />
      <div className="absolute bottom-3 left-3 text-[10px] text-white/50">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  )
}

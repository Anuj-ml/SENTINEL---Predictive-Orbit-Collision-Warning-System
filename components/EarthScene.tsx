import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OrbitalObject, Vector3, Maneuver } from '../types';
import { getPositionAtTime, getPostManeuverObject } from '../services/orbitalPhysics';

// --- HOLOGRAPHIC SHADER MATERIAL ---
const HologramMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#06b6d4') }, // Cyan
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Fresnel Effect (Rim Glow)
      float fresnel = pow(1.0 - dot(normal, viewDir), 2.5);
      
      // Digital Scanlines (Moving up)
      float scanline = sin(vPosition.y * 4.0 - uTime * 1.5) * 0.1 + 0.9;
      
      // Tech Grid / Interference pattern
      float grid = (sin(vPosition.y * 20.0) + 1.0) * 0.05;
      
      // Combine
      vec3 finalColor = uColor * (fresnel + 0.2) * scanline;
      
      // Alpha gradient based on fresnel for transparency in center
      float alpha = fresnel * 1.2 + 0.1;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

const Earth = () => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
    if (groupRef.current) {
       groupRef.current.rotation.y += 0.0005; // Slow Earth rotation
    }
  });

  return (
    <group ref={groupRef}>
        {/* 1. Core Occlusion Sphere (Black body to block stars behind) */}
      <Sphere args={[9.95, 64, 64]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* 2. Holographic Surface Shader */}
      <Sphere args={[10, 64, 64]}>
        <shaderMaterial
            ref={shaderRef}
            args={[HologramMaterial]}
            transparent={true}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
            depthWrite={false}
        />
      </Sphere>

      {/* 3. Structural Wireframe Grid */}
      <Sphere args={[10.05, 24, 24]}>
        <meshBasicMaterial 
            color="#0891b2" 
            wireframe 
            transparent 
            opacity={0.15} 
        />
      </Sphere>
      
      {/* 4. Equator Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[10.1, 0.02, 16, 100]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
      </mesh>

      {/* 5. Atmosphere/Glow Halo */}
      <Sphere args={[11.5, 32, 32]}>
          <meshBasicMaterial
            color="#06b6d4"
            transparent
            opacity={0.03}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
      </Sphere>
    </group>
  );
};

const OrbitPath = ({ object, color, opacity = 0.3 }: { object: OrbitalObject, color?: string, opacity?: number }) => {
    const points = useMemo(() => {
        const pts = [];
        // Calculate one full orbit path
        // Period approx 90 mins = 5400s, take 100 steps
        for(let i=0; i<100; i++) {
            const t = i * (6000 / 100);
            const pos = getPositionAtTime(object, t);
            pts.push(new THREE.Vector3(pos.x / 637.1, pos.y / 637.1, pos.z / 637.1)); // Scale down by 100 (Radius 6371km -> 10u)
        }
        pts.push(pts[0]); // Close loop
        return pts;
    }, [object]);

    const finalColor = color || (object.type === 'SATELLITE' ? '#0891b2' : '#7f1d1d');

    return (
        <Line 
            points={points} 
            color={finalColor} 
            lineWidth={0.5} 
            transparent 
            opacity={opacity} 
        />
    );
};

const SatelliteMarker = ({ object, time }: { object: OrbitalObject, time: number }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (meshRef.current) {
            const pos = getPositionAtTime(object, time);
            // Scale factor: Earth Radius in 3D is 10 units. Real is 6371km. Scale = 1/637.1
            meshRef.current.position.set(pos.x / 637.1, pos.y / 637.1, pos.z / 637.1);
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color={object.color} />
            {object.type === 'SATELLITE' && (
                <Html distanceFactor={15}>
                    <div className="pointer-events-none text-[10px] font-mono text-cyan-400 bg-black/80 px-2 py-0.5 rounded border border-cyan-900/50 whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                        {object.name}
                    </div>
                </Html>
            )}
        </mesh>
    );
};

interface SceneProps {
    objects: OrbitalObject[];
    time: number;
    maneuver: Maneuver | null;
}

const EarthScene: React.FC<SceneProps> = ({ objects, time, maneuver }) => {
    
    // Calculate the predicted orbit if a maneuver is active
    const predictedObject = useMemo(() => {
        if (!maneuver) return null;
        const target = objects.find(o => o.name === maneuver.targetId); // Currently targetId stores Name in mockup
        if (!target) return null;
        return getPostManeuverObject(target, maneuver);
    }, [maneuver, objects]);

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[50, 20, 20]} intensity={1.5} />
      <pointLight position={[-20, -10, -10]} intensity={0.5} color="#0ea5e9" />
      
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <Earth />
      
      {objects.map(obj => (
          <React.Fragment key={obj.id}>
              <SatelliteMarker object={obj} time={time} />
              <OrbitPath object={obj} />
          </React.Fragment>
      ))}

      {predictedObject && (
          <>
             {/* Render predicted path in Green */}
             <OrbitPath object={predictedObject} color="#4ade80" opacity={0.8} />
             {/* Optional: Show ghost marker for predicted position */}
             {/* <SatelliteMarker object={{...predictedObject, color: '#4ade80'}} time={time} /> */}
          </>
      )}
    </>
  );
};

export default EarthScene;
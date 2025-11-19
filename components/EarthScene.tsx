import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OrbitalObject, Vector3, Maneuver } from '../types';
import { getPositionAtTime, getPostManeuverObject } from '../services/orbitalPhysics';

// SCENE SCALE FACTOR: 1 unit = 637.1 km (Earth Radius = 10 units)
const SCENE_SCALE = 1 / 637.1;

// --- ADVANCED HOLOGRAPHIC SHADER ---
const HologramMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#06b6d4') }, // Cyan
    uGlowColor: { value: new THREE.Color('#22d3ee') }, // Light Cyan
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uGlowColor;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    // Simplex Noise helper
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // 1. Fresnel Rim Glow (The "Atmosphere" edge)
      float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
      
      // 2. Animated Noise Surface (Data Clouds / Terrain)
      float noiseVal = snoise(vPosition.xy * 0.5 + vec2(0.0, uTime * 0.05));
      float terrain = smoothstep(0.4, 0.6, noiseVal) * 0.15;

      // 3. Digital Scanlines (Moving up)
      float scanline = sin(vPosition.y * 8.0 - uTime * 2.5);
      scanline = smoothstep(0.96, 1.0, scanline) * 0.8;
      
      // 4. Procedural Latitude/Longitude Grid
      float gridDensity = 4.0;
      float lat = abs(cos(vPosition.y * gridDensity));
      float lon = abs(sin(atan(vPosition.z, vPosition.x) * gridDensity * 2.0));
      float grid = (step(0.98, lat) + step(0.98, lon)) * 0.3;

      // Combine
      vec3 finalColor = uColor * 0.1; // Dark base
      finalColor += uGlowColor * fresnel; // Rim light
      finalColor += uGlowColor * grid; // Wireframe grid
      finalColor += uColor * terrain; // Noise texture
      finalColor += vec3(1.0) * scanline; // Bright scan beam

      // Alpha Logic
      float alpha = fresnel + grid + terrain + scanline + 0.05;
      
      gl_FragColor = vec4(finalColor, min(0.9, alpha));
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
       groupRef.current.rotation.y += 0.0008; // Slow Earth rotation
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Core Occlusion Sphere (Black body to block stars behind) */}
      <Sphere args={[9.9, 64, 64]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* 2. Complex Holographic Surface Shader */}
      <Sphere args={[10, 128, 128]}>
        <shaderMaterial
            ref={shaderRef}
            args={[HologramMaterial]}
            transparent={true}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
            depthWrite={false}
        />
      </Sphere>

      {/* 3. Equator Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[10.5, 0.03, 16, 100]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[11.0, 0.01, 16, 100]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} />
      </mesh>

      {/* 4. Faint Outer Atmosphere Glow */}
      <Sphere args={[12, 32, 32]}>
          <meshBasicMaterial
            color="#06b6d4"
            transparent
            opacity={0.05}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
      </Sphere>
    </group>
  );
};

const ExpandingRing = ({ delay, period = 6, color = "#06b6d4" }: { delay: number, period?: number, color?: string }) => {
    const ref = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
      if(!ref.current) return;
      const time = state.clock.getElapsedTime();
      const t = (time + delay) % period;
      const progress = t / period;
      
      // Start slightly inside earth or at surface (approx scale 10)
      // Expand out to scale 45
      const currentScale = 10 + (progress * 35);
      
      ref.current.scale.set(currentScale, currentScale, currentScale);
      
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      // Opacity: Fade in quickly, then fade out
      // High opacity near Earth (0.3), low at edge (0)
      if (progress < 0.1) {
          mat.opacity = progress * 3;
      } else {
          mat.opacity = (1 - progress) * 0.3; 
      }
    });
  
    return (
      <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]}>
          {/* Ring geometry: inner, outer. Thin ring. */}
          <ringGeometry args={[0.98, 1, 128]} />
          <meshBasicMaterial 
              color={color} 
              transparent 
              side={THREE.DoubleSide} 
              blending={THREE.AdditiveBlending}
              depthWrite={false} 
          />
      </mesh>
    );
};

const ExpandingSphere = ({ delay, period = 8 }: { delay: number, period?: number }) => {
    const ref = useRef<THREE.Mesh>(null);
    
    useFrame((state) => {
      if(!ref.current) return;
      const time = state.clock.getElapsedTime();
      const t = (time + delay) % period;
      const progress = t / period;
      
      const currentScale = 10 + (progress * 30);
      ref.current.scale.set(currentScale, currentScale, currentScale);
      
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.08; 
    });
  
    return (
      <mesh ref={ref}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial 
              color="#22d3ee" 
              transparent 
              wireframe 
              blending={THREE.AdditiveBlending}
              depthWrite={false}
          />
      </mesh>
    );
  };

const OrbitPath: React.FC<{ object: OrbitalObject, color?: string, opacity?: number }> = ({ object, color, opacity = 0.3 }) => {
    const points = useMemo(() => {
        const pts = [];
        // Calculate one full orbit path
        // Period approx 90 mins = 5400s, take 100 steps
        for(let i=0; i<100; i++) {
            const t = i * (6000 / 100);
            const pos = getPositionAtTime(object, t);
            pts.push(new THREE.Vector3(pos.x * SCENE_SCALE, pos.y * SCENE_SCALE, pos.z * SCENE_SCALE)); 
        }
        pts.push(pts[0]); // Close loop
        return pts;
    }, [object]);

    const finalColor = color || (object.type === 'SATELLITE' ? '#0891b2' : '#7f1d1d');

    return (
        <Line 
            points={points} 
            color={finalColor} 
            lineWidth={1} 
            transparent 
            opacity={opacity} 
        />
    );
};

const SatelliteMarker: React.FC<{ object: OrbitalObject, time: number }> = ({ object, time }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (meshRef.current) {
            const pos = getPositionAtTime(object, time);
            meshRef.current.position.set(pos.x * SCENE_SCALE, pos.y * SCENE_SCALE, pos.z * SCENE_SCALE);
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color={object.color} toneMapped={false} />
            {object.type === 'SATELLITE' && (
                <Html distanceFactor={20} zIndexRange={[100, 0]}>
                    <div className="pointer-events-none text-[10px] font-mono text-cyan-400 bg-black/80 px-2 py-0.5 rounded border border-cyan-900/50 whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                        {object.name}
                    </div>
                </Html>
            )}
        </mesh>
    );
};

// --- DEBRIS CLUSTERING COMPONENTS ---

const DebrisClusterMarker: React.FC<{ count: number, position: THREE.Vector3 }> = ({ count, position }) => {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.4 + Math.log(count) * 0.1, 16, 16]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
        <Html center zIndexRange={[100, 0]}>
           <div className="flex items-center justify-center w-5 h-5 bg-red-900/80 border border-red-500 rounded-full text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.6)] select-none">
               {count}
           </div>
        </Html>
      </mesh>
    );
  };
  
  const DebrisField = ({ objects, time }: { objects: OrbitalObject[], time: number }) => {
    const { clusters, singles } = useMemo(() => {
        // Calculate positions for all debris in current frame (since 'time' changes every frame)
        const data = objects.map(obj => {
            const pos = getPositionAtTime(obj, time);
            return {
                obj,
                vec: new THREE.Vector3(pos.x * SCENE_SCALE, pos.y * SCENE_SCALE, pos.z * SCENE_SCALE)
            };
        });
  
        const clusters: { center: THREE.Vector3, count: number, id: string }[] = [];
        const singles: { obj: OrbitalObject, vec: THREE.Vector3 }[] = [];
        const processed = new Set<number>();
        
        // Simple greedy clustering
        // Threshold of 2.5 units (approx 1500km visually)
        const CLUSTER_THRESHOLD = 2.5; 
  
        for(let i=0; i<data.length; i++) {
            if(processed.has(i)) continue;
            
            const group = [data[i]];
            processed.add(i);
            
            for(let j=i+1; j<data.length; j++) {
                if(processed.has(j)) continue;
                if(data[i].vec.distanceTo(data[j].vec) < CLUSTER_THRESHOLD) {
                    group.push(data[j]);
                    processed.add(j);
                }
            }
  
            if(group.length > 1) {
                // Calculate centroid
                const center = new THREE.Vector3();
                group.forEach(g => center.add(g.vec));
                center.divideScalar(group.length);
                clusters.push({ center, count: group.length, id: `cluster-${i}-${time}` });
            } else {
                singles.push(group[0]);
            }
        }
        
        return { clusters, singles };
    }, [objects, time]);
  
    return (
      <>
          {singles.map(item => (
              <mesh key={item.obj.id} position={item.vec}>
                   <sphereGeometry args={[0.15, 8, 8]} />
                   <meshBasicMaterial color={item.obj.color} toneMapped={false} />
              </mesh>
          ))}
          {clusters.map(cluster => (
              <DebrisClusterMarker key={cluster.id} count={cluster.count} position={cluster.center} />
          ))}
      </>
    )
  };

interface SceneProps {
    objects: OrbitalObject[];
    time: number;
    maneuver: Maneuver | null;
}

const EarthScene: React.FC<SceneProps> = ({ objects, time, maneuver }) => {
    
    // Split objects for optimized rendering
    const { satellites, debris } = useMemo(() => {
        return {
            satellites: objects.filter(o => o.type === 'SATELLITE'),
            debris: objects.filter(o => o.type === 'DEBRIS')
        };
    }, [objects]);

    // Calculate the predicted orbit if a maneuver is active
    const predictedObject = useMemo(() => {
        if (!maneuver) return null;
        const target = objects.find(o => o.name === maneuver.targetId); // Currently targetId stores Name in mockup
        if (!target) return null;
        return getPostManeuverObject(target, maneuver);
    }, [maneuver, objects]);

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[50, 20, 20]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-50, -20, -20]} intensity={0.5} color="#0ea5e9" />
      
      <Stars radius={300} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
      
      <Earth />

      {/* Radar Scan Animation */}
      <ExpandingRing delay={0} />
      <ExpandingRing delay={2} />
      <ExpandingRing delay={4} />
      <ExpandingSphere delay={1} />
      
      {/* Render Active Satellites individually (Important Assets) */}
      {satellites.map(obj => (
          <React.Fragment key={obj.id}>
              <SatelliteMarker object={obj} time={time} />
              <OrbitPath object={obj} />
          </React.Fragment>
      ))}

      {/* Render Debris with Visual Clustering to reduce clutter */}
      <DebrisField objects={debris} time={time} />
      {/* Optional: Still show orbital paths for debris, but maybe fainter? */}
      {debris.map(obj => (
          <OrbitPath key={`path-${obj.id}`} object={obj} opacity={0.1} />
      ))}

      {predictedObject && (
          <>
             {/* Render predicted path in Green */}
             <OrbitPath object={predictedObject} color="#4ade80" opacity={0.8} />
          </>
      )}
    </>
  );
};

export default EarthScene;
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Stars, Html, Sparkles } from '@react-three/drei';
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
    uGlowColor: { value: new THREE.Color('#3b82f6') }, // Deep Blue
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
      
      // 1. Glassy Fresnel Rim (The "Bubble" effect)
      float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
      
      // 2. Continents (Noise)
      // Rotate noise with time
      float noiseVal = snoise(vPosition.xy * 0.4 + vec2(uTime * 0.02, 0.0));
      // Sharp threshold for "Landmass" look
      float landMask = smoothstep(0.45, 0.46, noiseVal);
      
      // 3. Dot Matrix Pattern on Land
      float dots = sin(vUv.x * 300.0) * sin(vUv.y * 150.0);
      float dotGrid = smoothstep(0.9, 1.0, dots);
      
      // 4. Latitude Lines
      float lat = abs(cos(vPosition.y * 6.0));
      float grid = step(0.99, lat);

      // Composition
      vec3 finalColor = vec3(0.0);
      
      // Ocean/Space (Transparent Dark Blue)
      finalColor += uGlowColor * 0.1 * fresnel; 
      
      // Landmass (Cyan Dots + Glow)
      finalColor += uColor * landMask * dotGrid * 0.8;
      finalColor += uColor * landMask * 0.1; // Base land glow
      
      // Grid Lines
      finalColor += uColor * grid * 0.3;

      // Alpha: High at edges (fresnel), low in center (glassy), visible on land
      float alpha = fresnel * 0.8 + landMask * 0.4 + grid * 0.2;
      
      gl_FragColor = vec4(finalColor, min(0.95, alpha));
    }
  `
};

const CloudMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#ffffff') }, 
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Reuse simplex noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ; m = m*m ;
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
      // Moving clouds
      float noise = snoise(vPosition.xy * 0.3 + vec2(uTime * 0.04, uTime * 0.01));
      float cloud = smoothstep(0.4, 0.6, noise);
      
      gl_FragColor = vec4(uColor, cloud * 0.15);
    }
  `
};

const Earth = () => {
  const earthRef = useRef<THREE.ShaderMaterial>(null);
  const cloudRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const cloudsMeshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (earthRef.current) {
      earthRef.current.uniforms.uTime.value = t;
    }
    if (cloudRef.current) {
      cloudRef.current.uniforms.uTime.value = t;
    }
    if (groupRef.current) {
       groupRef.current.rotation.y += 0.0005; 
    }
    if (cloudsMeshRef.current) {
        // Clouds rotate slightly faster
        cloudsMeshRef.current.rotation.y = -t * 0.02; 
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Occlusion Core (Deep Blue/Black) */}
      <Sphere args={[9.95, 64, 64]}>
        <meshBasicMaterial color="#020617" />
      </Sphere>

      {/* 2. Main Holographic Glass Surface */}
      <Sphere args={[10, 128, 128]}>
        <shaderMaterial
            ref={earthRef}
            args={[HologramMaterial]}
            transparent={true}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
            depthWrite={false}
        />
      </Sphere>

      {/* 3. Digital Cloud Layer */}
      <mesh ref={cloudsMeshRef}>
         <sphereGeometry args={[10.2, 64, 64]} />
         <shaderMaterial 
            ref={cloudRef}
            args={[CloudMaterial]}
            transparent={true}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
         />
      </mesh>

      {/* 4. Outer Atmosphere Glow */}
      <Sphere args={[11.5, 32, 32]}>
          <meshBasicMaterial
            color="#3b82f6"
            transparent
            opacity={0.06}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
      </Sphere>

       {/* 5. Floating Data Particles */}
       <Sparkles count={150} scale={25} size={2} speed={0.4} opacity={0.5} color="#22d3ee" />
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
      
      const currentScale = 10 + (progress * 35);
      
      ref.current.scale.set(currentScale, currentScale, currentScale);
      
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      if (progress < 0.1) {
          mat.opacity = progress * 3;
      } else {
          mat.opacity = (1 - progress) * 0.3; 
      }
    });
  
    return (
      <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]}>
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
        // Calculate positions for all debris in current frame
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

    const predictedObject = useMemo(() => {
        if (!maneuver) return null;
        const target = objects.find(o => o.name === maneuver.targetId); 
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
      
      {satellites.map(obj => (
          <React.Fragment key={obj.id}>
              <SatelliteMarker object={obj} time={time} />
              <OrbitPath object={obj} />
          </React.Fragment>
      ))}

      <DebrisField objects={debris} time={time} />
      {debris.map(obj => (
          <OrbitPath key={`path-${obj.id}`} object={obj} opacity={0.1} />
      ))}

      {predictedObject && (
          <OrbitPath object={predictedObject} color="#4ade80" opacity={0.8} />
      )}
    </>
  );
};

export default EarthScene;
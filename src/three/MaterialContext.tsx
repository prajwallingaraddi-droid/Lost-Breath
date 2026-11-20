import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { createIndustrialMaterials, IndustrialMaterialLibrary } from './materials';
import { createProceduralTextures } from './proceduralTextures';
import { detectSoftwareWebGL } from './webglSupport';

const MaterialContext = createContext<IndustrialMaterialLibrary | null>(null);

export const MaterialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { gl } = useThree();
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);

  const library = useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);
    const materials = createIndustrialMaterials(textures, isSoftwareGl);

    return {
      materials,
      dispose: () => {
        materials.dispose();
        textures.dispose();
      },
    };
  }, [gl, isSoftwareGl]);

  useEffect(() => {
    return () => {
      library.dispose();
    };
  }, [library]);

  return <MaterialContext.Provider value={library.materials}>{children}</MaterialContext.Provider>;
};

export function useIndustrialMaterials(): IndustrialMaterialLibrary {
  const ctx = useContext(MaterialContext);
  if (!ctx) {
    throw new Error('useIndustrialMaterials must be used inside MaterialProvider');
  }
  return ctx;
}

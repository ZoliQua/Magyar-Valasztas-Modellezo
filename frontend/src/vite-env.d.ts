/// <reference types="vite/client" />

declare module '*.geojson' {
  const value: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: unknown };
    }>;
  };
  export default value;
}

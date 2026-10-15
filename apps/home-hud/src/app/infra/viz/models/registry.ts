/**
 * Every procedural 3D model available to attach to a host, for the
 * "Model" picker in AddHostModal/EditHostModal. Add an entry here (and a
 * case in ../../hosts/Host3DModel.tsx) when a new model
 * (models/<slug>/) is ready to be host-attachable — see
 * docs/home-hud-3d-model-guide.md.
 */
export interface ModelRegistryEntry {
  slug: string;
  label: string;
}

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  { slug: 'nas', label: 'ASUSTOR NAS' },
  { slug: 'pironman4', label: 'Pironman4 Case' },
];

export function isKnownModelSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return MODEL_REGISTRY.some((entry) => entry.slug === slug);
}

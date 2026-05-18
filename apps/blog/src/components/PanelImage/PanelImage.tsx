import { Panel } from '@abbottland/fui-components';
import Image from 'next/image';

type PanelImageProps = {
  src: string;
  alt: string;
  sizes?: string;
};

export default function PanelImage({
  src,
  alt,
  sizes = '100vw',
}: PanelImageProps) {
  return (
    <Panel
      color="primary"
      className="flex-shrink-0 py-4 min-h-64 bg-neutral-950"
    >
      <Image
        src={src}
        alt={alt}
        sizes={sizes}
        className="object-contain"
        fill
      />
    </Panel>
  );
}

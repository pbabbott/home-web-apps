import { ArchSectionHeader } from './ArchSectionHeader';
import { ServiceComponents } from './ServiceComponents';

export function ServiceComponentsSection() {
  return (
    <section className="mb-20">
      <ArchSectionHeader
        levelLabel="Component Level :: C3"
        heading="Service Components"
        description="Maximum resolution. Individual service components, inter-process communication, and dependency chains fully mapped. Proceed with intent."
        complexity={{ label: 'High', color: 'error' }}
      />
      <ServiceComponents />
    </section>
  );
}

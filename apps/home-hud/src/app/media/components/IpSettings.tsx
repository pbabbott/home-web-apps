import { StatusIndicator } from '@abbottland/fui-components';
import type { PublicIp } from '../lib/gluetun-sync-api';
import { Row, Section } from './Section';

interface IpSettingsProps {
  publicIp: PublicIp | null;
  homeIp: string | null;
}

export function IpSettings({ publicIp, homeIp }: IpSettingsProps) {
  const matched =
    publicIp !== null && homeIp !== null && publicIp.ip === homeIp;
  const known = publicIp !== null && homeIp !== null;

  return (
    <Section
      title="IP Settings"
      available={publicIp !== null || homeIp !== null}
      before={
        // Differing IPs are the healthy state: traffic leaves via the VPN, not home.
        <StatusIndicator
          component="div"
          className="max-w-md"
          color={!known ? 'neutral' : matched ? 'error' : 'success'}
          status={!known ? '—' : matched ? 'Matched' : 'Not matched'}
        >
          IP Difference
        </StatusIndicator>
      }
    >
      <Row label="Home IP">{homeIp ?? '—'}</Row>
      <Row label="Public IP">{publicIp?.ip ?? '—'}</Row>
      <Row label="Region">{publicIp?.region ?? '—'}</Row>
      <Row label="Country">{publicIp?.country ?? '—'}</Row>
      <Row label="City">{publicIp?.city ?? '—'}</Row>
    </Section>
  );
}

import type { PublicIp } from '../lib/gluetun-sync-api';
import { BAD_CLASS, OK_CLASS, Row, Section } from './Section';

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
    >
      {/* Differing IPs are the healthy state: traffic leaves via the VPN, not home. */}
      <Row
        label="IP Difference"
        className={!known ? undefined : matched ? BAD_CLASS : OK_CLASS}
      >
        {!known ? '—' : matched ? 'Matched' : 'Not matched'}
      </Row>
      <Row label="Home IP">{homeIp ?? '—'}</Row>
      <Row label="Public IP">{publicIp?.ip ?? '—'}</Row>
      <Row label="Region">{publicIp?.region ?? '—'}</Row>
      <Row label="Country">{publicIp?.country ?? '—'}</Row>
      <Row label="City">{publicIp?.city ?? '—'}</Row>
    </Section>
  );
}

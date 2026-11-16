/** The IP this server reaches the internet from, i.e. the home WAN IP (outside the VPN). `null` if ipify can't be reached. */
export async function getHomeIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { ip: string }).ip;
  } catch (err) {
    console.error('Failed to look up the home IP via ipify:', err);
    return null;
  }
}

// https://www.ipify.org/
// curl 'https://api.ipify.org?format=json'

// TODO: call this only in production
export type IpAddressResult =
{
    ip: string
};

export const getIpAddress = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data as IpAddressResult
  } catch (error) {
    console.error('Error fetching IP address:', error);
    return null
  }
}
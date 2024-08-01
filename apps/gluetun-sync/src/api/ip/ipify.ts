// https://www.ipify.org/
// curl 'https://api.ipify.org?format=json'
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
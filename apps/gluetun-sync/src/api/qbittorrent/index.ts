/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import { config } from "../../config";

const loginFailed = () => {
    console.error("Login failed");
    return null
}

const getApiPath = (apiName: string, methodName: string) => {
  const relativeUrl = `/api/v2/${apiName}/${methodName}`;
  const uri = path.join(config.qbitTorrent.apiHost, relativeUrl);
  return uri
}

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#login
export const login = async () => {
  try {
    const uri = getApiPath("auth", "login")
    const formData = new URLSearchParams();
    formData.append("username", config.qbitTorrent.username);
    formData.append("password", config.qbitTorrent.password);

    const response = await fetch(uri, {
      method: "post",
      body: formData,
    });

    if (response.status !== 200) {
      return loginFailed()
    }

    const { headers } = response;
    const cookie = headers.get('set-cookie')
    if (cookie == null) {
        return loginFailed();
    }

    const sidValue = cookie.split(';')[0]
    const token = sidValue.split('=')[1]

    return token

  } catch (err) {
    console.log('could not log into qbittorrent', err);
    return null;
  }
};

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-application-preferences
export const getApplicationPreferences = async (cookieToken: string) => {
  const uri = getApiPath("app", "preferences")

  const response = await fetch(uri, {
    headers: {
      cookie: `SID=${cookieToken}`
    }
  })

  const data = await response.json()
  console.log('data', data)
}
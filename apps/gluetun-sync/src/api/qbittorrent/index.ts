/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import { config } from "../../config";

const loginFailed = (message: string) => {
    console.error("Login failed", message);
    return null
}

const getApiPath = (apiName: string, methodName: string) => {
  const relativeUrl = `/api/v2/${apiName}/${methodName}`;
  const uri = path.join(config.qbitTorrent.apiHost, relativeUrl);
  return uri
}

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#login
export const login = async (): Promise<string | null> => {
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
      return loginFailed(`Response status code was: ${response.status} ${response.statusText}`)
    }

    const { headers } = response;
    const cookie = headers.get('set-cookie')
    if (cookie == null) {
        return loginFailed(`Cookie was null. headers are ${headers}`);
    }

    const sidValue = cookie.split(';')[0]
    const token = sidValue.split('=')[1]

    return token

  } catch (err) {
    console.log('could not log into qbittorrent', err);
    return null;
  }
};

export type QBitTorrentPreferences = 
{
    listen_port: number
};

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#get-application-preferences
export const getApplicationPreferences = async (cookieToken: string): Promise<QBitTorrentPreferences|null> => {

  try{
    const uri = getApiPath("app", "preferences")

    const response = await fetch(uri, {
      headers: {
        cookie: `SID=${cookieToken}`
      }
    })
    const data = (await response.json()) as any
    
    return {
      listen_port: data.listen_port
    }
  }
  catch(err){
    console.log('could not get preferences', err)
    return null
  }
}

// https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)#set-application-preferences

export type UpdateResult = {
  status: number,
  statusText: string
}
export const setApplicationPreference = async (cookieToken: string, key: string, value: string): Promise<UpdateResult | null> => {

  try{
    const uri = getApiPath("app", "setPreferences")

    const bodyObject = {
      [key]: value
    }

    const formData = new URLSearchParams();
    formData.append("json", JSON.stringify(bodyObject));

    const response = await fetch(uri, {
      method: 'post',
      headers: {
        cookie: `SID=${cookieToken}`,
      },
      body: formData
    })
  
    return {
      statusText: response.statusText,
      status: response.status
    }
  }
  catch(err){
    console.log('could not set preferences', err)
    return null
  }
}
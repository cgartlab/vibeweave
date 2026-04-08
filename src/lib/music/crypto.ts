import CryptoJS from 'crypto-js';
import forge from 'node-forge';

// ===== Old non-official API encryption (kept as fallback) =====

const AES_KEY = '0CoJUm6Qyw8W8jud';

const RSA_PUBKEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd71iZ6
Jmk1+M9g7f7wjSNn9Q3XzVJhD2p4uvbJHrGqM8kZOKUqRtJLIXvKUOxhQ8bDE1g+
R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3
jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxT
POYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx
3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3R3D3jxTPOYx3QID
AQAB
-----END PUBLIC KEY-----`;

export class NetEaseCrypto {
  /**
   * Encrypts request parameters using AES-128-ECB + RSA scheme.
   *
   * The process:
   * 1. Generate a random 16-character key.
   * 2. AES-128-ECB encrypt the JSON-stringified params with the random key.
   * 3. RSA encrypt the random key with NetEase's public key.
   *
   * @param params - The plain object to encrypt.
   * @returns An object with `params` (AES ciphertext, Base64) and `encSecKey` (RSA ciphertext, hex).
   */
  static encryptParams(params: object): { params: string; encSecKey: string } {
    // 1. Generate random 16-char key
    const randomKey = CryptoJS.lib.WordArray.random(16).toString();

    // 2. AES encrypt params with random key (ECB mode, PKCS7 padding)
    const text = JSON.stringify(params);
    const aesEncrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Utf8.parse(randomKey), {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 3. RSA encrypt random key with NetEase's public key
    const publicKey = forge.pki.publicKeyFromPem(RSA_PUBKEY);
    const rsaEncrypted = publicKey.encrypt(randomKey, 'RSAES-PKCS1-V1_5');
    const encSecKey = forge.util.bytesToHex(rsaEncrypted);

    return {
      params: aesEncrypted.toString(),
      encSecKey: encSecKey,
    };
  }

  /**
   * Returns the fixed AES key used as the "second layer" in NetEase's
   * two-pass encryption scheme. Kept here for potential future use.
   */
  static getAesKey(): string {
    return AES_KEY;
  }
}

// ===== New Official Open Platform API signing =====

export class NetEaseOpenSigner {
  private appId: string;
  private appSecret: string;
  private privateKey: forge.pki.rsa.PrivateKey;

  constructor(appId: string, appSecret: string, privateKeyPem: string) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  }

  /**
   * Sign request parameters using SHA256WithRSA.
   *
   * Process:
   * 1. Add common params: appid, timestamp, sign_type
   * 2. Sort all params alphabetically by key
   * 3. Concatenate as key=value&key=value
   * 4. Sign with SHA256WithRSA using private key
   * 5. Add 'sign' param with base64-encoded signature
   */
  sign(params: Record<string, string>): Record<string, string> {
    const timestamp = String(Date.now());

    // Add common params
    const allParams: Record<string, string> = {
      ...params,
      appid: this.appId,
      timestamp,
      sign_type: 'RSA',
    };

    // Sort by key alphabetically
    const sortedKeys = Object.keys(allParams).sort();

    // Build sign string: key1=value1&key2=value2...
    const signString = sortedKeys
      .map(key => `${key}=${allParams[key]}`)
      .join('&');

    // Sign with SHA256WithRSA
    const md = forge.md.sha256.create();
    md.update(signString, 'utf8');
    const signature = this.privateKey.sign(md, 'base64');

    // Add signature
    allParams.sign = signature;

    return allParams;
  }

  /**
   * Make a signed POST request to the NetEase Open Platform API.
   *
   * @param endpoint - The API method name (e.g. '/openapi/playlist/detail')
   * @param bizContent - The business content object to send
   * @returns Parsed JSON response
   */
  async signedPost(endpoint: string, bizContent: Record<string, unknown>): Promise<unknown> {
    const baseUrl = 'https://interface.music.163.com';

    // Build params - bizContent goes as a JSON string
    const params: Record<string, string> = {
      method: endpoint,
      bizContent: JSON.stringify(bizContent),
    };

    const signedParams = this.sign(params);

    const response = await fetch(`${baseUrl}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signedParams),
    });

    if (!response.ok) {
      throw new Error(`NetEase Open API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

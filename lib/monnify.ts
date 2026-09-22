export async function getMonnifyToken() {
    const apiKey = process.env.MONNIFY_API_KEY;
    const secretKey = process.env.MONNIFY_SECRET_KEY;
    const baseUrl = process.env.MONNIFY_BASE_URL;
  
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
  
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      cache: 'no-store'
    });
  
    if (!response.ok) throw new Error('Failed to authenticate with Monnify');
    
    const data = await response.json();
    return data.responseBody.accessToken;
  }
export async function verifyPaystackTransaction(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const baseUrl = 'https://api.paystack.co';

  const response = await fetch(`${baseUrl}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Paystack verification failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data;
}
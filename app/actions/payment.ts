'use server';

export async function initializeKoraCheckout(payload: {
  amount: number;
  mac: string;
  ip: string;
  routerId: string;
  planId: string;
  phone: string;
}) {
  const secretKey = process.env.KORA_SECRET_KEY;

  if (!secretKey) throw new Error("Missing Kora Secret Key configuration.");
  
  const safeMac = payload.mac || "00:00:00:00:00:00";
  const safeIp = payload.ip || "127.0.0.1";
  const safeRouter = payload.routerId || "local_test_router";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reference: `CONN${Date.now()}`, 
      amount: Math.round(payload.amount),
      currency: "NGN",
      customer: {
        name: "Connectly User",
        email: "user@getconnectly.net"
      },
      metadata: {
        mac_address: safeMac,
        ip_address: safeIp,
        router_id: safeRouter,
        plan_id: payload.planId,
        customer_phone: payload.phone
      },
      redirect_url: `${appUrl}/success`,
      notification_url: "https://getconnectly.net/api/webhook" 
    })
  });

  const data = await response.json();
  
  if (!data.status) {
    // This will print the exact failing field in your VS Code terminal
    console.error("KORA VALIDATION ERROR:", JSON.stringify(data, null, 2));
    
    const errorDetails = data.errors || data.data || data.message || "Unknown error";
    throw new Error(`Validation Failed: ${JSON.stringify(errorDetails)}`);
  }

  return data.data.checkout_url;
}
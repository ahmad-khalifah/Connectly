// Server-only module. Do NOT add 'use server': that would turn this into a
// public Server Function anyone could call to send SMS on our account.

export async function sendTermiiSMS(phone: string, message: string) {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID || "N-Alert";

  if (!apiKey) {
    console.error("Missing Termii API Key");
    return false;
  }

  // Format phone number to international standard (remove leading 0, add 234 for Nigeria)
  let formattedPhone = phone.trim();
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '234' + formattedPhone.slice(1);
  } else if (!formattedPhone.startsWith('234') && !formattedPhone.startsWith('+')) {
    formattedPhone = '234' + formattedPhone;
  }
  
  formattedPhone = formattedPhone.replace('+', '');

  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedPhone,
        from: senderId,
        sms: message,
        type: "plain",
        channel: "generic", 
        api_key: apiKey,
      }),
    });

    const data = await response.json();

    if (data.message === "Successfully Sent") {
      console.log(`SMS sent successfully to ${formattedPhone}`);
      return true;
    } else {
      console.error("Termii Error:", data);
      return false;
    }
  } catch (error) {
    console.error("Failed to send Termii SMS:", error);
    return false;
  }
}
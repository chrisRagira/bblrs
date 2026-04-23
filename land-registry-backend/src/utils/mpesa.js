import axios from "axios";

const MPESA_BASE = "https://sandbox.safaricom.co.ke"; // swap for prod

// Get OAuth token from Safaricom
export async function getMpesaToken() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth   = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await axios.get(
    `${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  return res.data.access_token;
}

// Initiate STK Push
export async function stkPush({ phone, amount, accountRef, description, callbackUrl }) {
  const token     = await getMpesaToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  // Normalize phone: 0712... → 254712...
  const normalized = phone.replace(/^0/, "254").replace(/^\+/, "");

  const res = await axios.post(
    `${MPESA_BASE}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            amount,
      PartyA:            normalized,
      PartyB:            shortcode,
      PhoneNumber:       normalized,
      CallBackURL:       callbackUrl,
      AccountReference:  accountRef,
      TransactionDesc:   description,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return res.data; // contains CheckoutRequestID
}
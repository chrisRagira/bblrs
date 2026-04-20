router.post("/mpesa/search-pay", verifyToken, async (req, res) => {
  const { phone, query } = req.body;

  const amount = 20;

  const queryHash = require("crypto")
    .createHash("sha256")
    .update(query)
    .digest("hex");

  // 1. Save pending payment
  const [result] = await req.db.execute(
    `INSERT INTO search_payments (user_id, query_hash, amount)
     VALUES (?, ?, ?)`,
    [req.user.id, queryHash, amount]
  );

  // 2. Trigger STK push (pseudo - replace with real M-Pesa API)
  const stkResponse = await mpesa.stkPush({
    phone,
    amount,
    accountReference: `SEARCH-${result.insertId}`,
    transactionDesc: "Parcel Search Access"
  });

  res.json({
    paymentId: result.insertId,
    message: "STK push sent",
    stkResponse
  });
});

router.post("/mpesa/callback", async (req, res) => {
  const data = req.body;

  const receipt = data?.Body?.stkCallback?.CallbackMetadata?.Item
    ?.find(i => i.Name === "MpesaReceiptNumber")?.Value;

  const accountRef = data?.Body?.stkCallback?.AccountReference;

  const paymentId = accountRef?.split("-")[1];

  if (receipt && paymentId) {
    await req.db.execute(
      `UPDATE search_payments
       SET status='PAID', mpesa_receipt=?
       WHERE id=?`,
      [receipt, paymentId]
    );
  }

  res.json({ ResultCode: 0 });
});
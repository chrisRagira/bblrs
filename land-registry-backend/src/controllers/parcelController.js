import { connectFabric } from "../fabric.js";


import { submitTx } from "../fabric.js";

export const createParcel = async (req, res) => {
  try {
    const { parcelID, titleNumber, ownerID, county } = req.body;

    // 🔗 1. Write to Fabric
    const { txId } = await submitTx(
      "createParcel",
      parcelID,
      titleNumber,
      ownerID,
      county
    );

    // 💾 2. Store in MySQL
    await req.db.execute(
      `INSERT INTO parcels 
      (parcel_id, title_number, owner_id, county, blockchain_ref)
      VALUES (?, ?, ?, ?, ?)`,
      [parcelID, titleNumber, ownerID, county, txId]
    );

    res.json({ message: "Parcel created", txId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getParcels = (req, res) => {
    res.json({
      data: [
        {
          parcelID: "1",
          titleNumber: "NKR/001",
          county: "Nakuru",
          landUseType: "Residential",
          status: "ACTIVE"
        }
      ]
    });
  };
  
  // export const getParcel = (req, res) => {
  //   res.json({
  //     data: {
  //       parcelID: req.params.id,
  //       titleNumber: "NKR/001",
  //       county: "Nakuru",
  //       status: "ACTIVE",
  //       currentOwner: { fullName: "John Doe" }
  //     }
  //   });
  // };

  export const getParcel = async (req, res) => {
    try {
      const { contract, gateway } = await connectFabric();
  
      const result = await contract.evaluateTransaction(
        "getParcel",
        req.params.id
      );
  
      await gateway.disconnect();
  
      res.json({ data: JSON.parse(result.toString()) });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  export const initiateTransfer = async (req, res) => {
  try {
    const { parcel_id, new_owner_id } = req.body;

    // 🔗 Fabric call
    const { txId } = await submitTx(
      "initiateTransfer",
      Date.now().toString(),
      parcel_id,
      new_owner_id
    );

    // 💾 Save locally
    await req.db.execute(
      `INSERT INTO transfers 
      (parcel_id, new_owner_id, blockchain_ref)
      VALUES (?, ?, ?)`,
      [parcel_id, new_owner_id, txId]
    );

    res.json({ message: "Transfer initiated", txId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await req.db.execute(
      "SELECT * FROM transfers WHERE transfer_id=?",
      [id]
    );

    const transfer = rows[0];

    // 🔗 Fabric
    const { txId } = await submitTx(
      "approveTransfer",
      transfer.transfer_id.toString()
    );

    // 💾 Update DB
    await req.db.execute(
      "UPDATE transfers SET status='APPROVED', blockchain_ref=? WHERE transfer_id=?",
      [txId, id]
    );

    await req.db.execute(
      "UPDATE parcels SET owner_id=? WHERE parcel_id=?",
      [transfer.new_owner_id, transfer.parcel_id]
    );

    res.json({ message: "Transfer approved", txId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

await req.db.execute(
  `INSERT INTO audit_logs 
  (entity, entity_id, action, actor_id, blockchain_ref)
  VALUES (?, ?, ?, ?, ?)`,
  ["PARCEL", parcelID, "CREATE", req.user.id, txId]
);
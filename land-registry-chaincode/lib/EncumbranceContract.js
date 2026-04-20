'use strict';

const { Contract } = require('fabric-contract-api');

class EncumbranceContract extends Contract {

  async registerEncumbrance(
  ctx,
  encumbranceID,
  parcelID,
  type,
  creditorName,
  creditorID,
  amount,
  registrationDate,
  expiryDate
) {
  const txTimestamp = ctx.stub.getTxTimestamp();
  const createdAt = new Date(txTimestamp.seconds.low * 1000).toISOString();
  const encumbrance = {
    encumbranceID,
    parcelID,
    type,
    creditorName,
    creditorID,
    amount,
    registrationDate,
    expiryDate,
    status: "ACTIVE",
    docType: "ENCUMBRANCE",
    createdAt
  };

  await ctx.stub.putState(
    encumbranceID,
    Buffer.from(JSON.stringify(encumbrance))
  );

  // Update parcel status
  const parcelBytes = await ctx.stub.getState(parcelID);

  if (!parcelBytes || parcelBytes.length === 0) {
    throw new Error("Parcel does not exist");
  }

  const parcel = JSON.parse(parcelBytes.toString());
  parcel.status = "ENCUMBERED";

  await ctx.stub.putState(
    parcelID,
    Buffer.from(JSON.stringify(parcel))
  );

  return JSON.stringify(encumbrance);
}

  async dischargeEncumbrance(ctx, encumbranceID) {
    const enc = JSON.parse((await ctx.stub.getState(encumbranceID)).toString());

    enc.status = "DISCHARGED";

    await ctx.stub.putState(encumbranceID, Buffer.from(JSON.stringify(enc)));

    const parcel = JSON.parse((await ctx.stub.getState(enc.parcelID)).toString());
    parcel.status = "ACTIVE";

    await ctx.stub.putState(enc.parcelID, Buffer.from(JSON.stringify(parcel)));

    return JSON.stringify(enc);
  }

  // ✅ Moved inside the class
  async getEncumbrancesByParcel(ctx, parcelID) {
    const iterator = await ctx.stub.getStateByRange('', '');

    const results = [];

    while (true) {
      const res = await iterator.next();

      if (res.value) {
        const record = JSON.parse(res.value.value.toString());

        if (record.docType === "ENCUMBRANCE" && record.parcelID === parcelID) {
          results.push(record);
        }
      }

      if (res.done) break;
    }

    await iterator.close();

    return JSON.stringify(results);
  }

  async getAllEncumbrances(ctx) {
  const iterator = await ctx.stub.getStateByRange('', '');
  const results = [];

  while (true) {
    const res = await iterator.next();

    if (res.value) {
      const record = JSON.parse(res.value.value.toString());

      if (record.docType === "ENCUMBRANCE") {
        results.push(record);
      }
    }

    if (res.done) break;
  }

  await iterator.close();

  return JSON.stringify(results);
}

}

module.exports = EncumbranceContract;
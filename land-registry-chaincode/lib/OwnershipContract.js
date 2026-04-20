'use strict';

const { Contract } = require('fabric-contract-api');

class OwnershipContract extends Contract {

  async initiateTransfer(ctx, transferID, parcelID, newOwnerID) {
    const transfer = {
      transferID,
      parcelID,
      newOwnerID,
      status: "PENDING",
      docType: "OWNERSHIP"
    };

    await ctx.stub.putState(transferID, Buffer.from(JSON.stringify(transfer)));

    return JSON.stringify(transfer);
  }

  async approveTransfer(ctx, transferID) {
    const transfer = JSON.parse(await ctx.stub.getState(transferID));

    if (transfer.status !== "PENDING") throw new Error("Invalid transfer");

    transfer.status = "APPROVED";

    const parcelData = await ctx.stub.getState(transfer.parcelID);
    const parcel = JSON.parse(parcelData.toString());

    parcel.ownerID = transfer.newOwnerID;

    await ctx.stub.putState(transfer.parcelID, Buffer.from(JSON.stringify(parcel)));
    await ctx.stub.putState(transferID, Buffer.from(JSON.stringify(transfer)));

    return JSON.stringify(transfer);
  }

  async getOwnershipHistory(ctx, parcelID) {
    const iterator = await ctx.stub.getHistoryForKey(parcelID);

    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.value) {
        results.push(res.value.value.toString());
      }
      if (res.done) break;
    }

    return JSON.stringify(results);
  }
}

module.exports = OwnershipContract;
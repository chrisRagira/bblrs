'use strict';

const { Contract } = require('fabric-contract-api');

class LandParcelContract extends Contract {

  async createParcel(
  ctx,
  titleNumber,
  county,
  subCounty,
  ward,
  areaHectares,
  landUseType,
  gpsCoordinates,
  ownerNationalId,
  registrationDate,
  registrarID,
  cid // IPFS CID
) {
  const exists = await this.parcelExists(ctx, titleNumber);
  if (exists) throw new Error('Parcel already exists');

  const timestamp = ctx.stub.getTxTimestamp();

  const parcel = {
    titleNumber,
    county,
    subCounty,
    ward,
    areaHectares: parseFloat(areaHectares),
    landUseType,

    gpsCoordinates: JSON.parse(gpsCoordinates), // expects stringified JSON

    owner: {
      nationalId: ownerNationalId
    },

    registration: {
      date: registrationDate,
      registrarID
    },

    document: {
      cid, // IPFS CID
      type: "pdf"
    },

    status: "ACTIVE",
    docType: "LAND_PARCEL",
    createdAt: new Date(timestamp.seconds.low * 1000).toISOString()
  };

  await ctx.stub.putState(titleNumber, Buffer.from(JSON.stringify(parcel)));

  // 🔗 Log event (optional but good practice)
ctx.stub.setEvent('PARCEL_CREATED', Buffer.from(JSON.stringify({
  action: 'CREATE',
  ownerNationalId,
  resourceType: 'PARCEL',
  titleNumber,
  timestamp: new Date(timestamp.seconds.low * 1000).toISOString()
})));

  return JSON.stringify(parcel);
}

  async getParcel(ctx, titleNumber) {
    const data = await ctx.stub.getState(titleNumber);
    if (!data || data.length === 0) throw new Error('Parcel not found');

    return data.toString();
  }

  async updateParcelStatus(ctx, titleNumber, status) {
    const parcel = JSON.parse(await this.getParcel(ctx, titleNumber));
    parcel.status = status;

    await ctx.stub.putState(titleNumber, Buffer.from(JSON.stringify(parcel)));

    return JSON.stringify(parcel);
  }

  async parcelExists(ctx, titleNumber) {
    const data = await ctx.stub.getState(titleNumber);
    return data && data.length > 0;
  }

  async getOwnershipHistory(ctx, parcelID) {
    const iterator = await ctx.stub.getHistoryForKey(parcelID);

    const history = [];

    while (true) {
      const res = await iterator.next();

      if (res.value) {
        const record = {
          txId:      res.value.txId,
          timestamp: res.value.timestamp,
          isDelete:  res.value.isDelete,
          data:      res.value.value.toString() 
                      ? JSON.parse(res.value.value.toString()) 
                      : null
        };
        history.push(record);
      }

      if (res.done) break;
    }

    await iterator.close();

    return JSON.stringify(history);
  }
}

module.exports = LandParcelContract;
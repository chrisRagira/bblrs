'use strict';

const { Contract } = require('fabric-contract-api');

class AuditContract extends Contract {

  async logEvent(ctx, eventType, actorID, entity, entityID) {
    const eventID = ctx.stub.getTxID();

    const log = {
      eventID,
      eventType,
      actorID,
      entity,
      entityID,
      timestamp: new Date().toISOString(),
      docType: "AUDIT"
    };

    await ctx.stub.putState(eventID, Buffer.from(JSON.stringify(log)));

    return JSON.stringify(log);
  }

  async getAuditTrail(ctx, entityID) {
    const iterator = await ctx.stub.getStateByRange('', '');

    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.value) {
        const record = JSON.parse(res.value.value.toString());
        if (record.entityID === entityID) {
          results.push(record);
        }
      }
      if (res.done) break;
    }

    return JSON.stringify(results);
  }
}

module.exports = AuditContract;
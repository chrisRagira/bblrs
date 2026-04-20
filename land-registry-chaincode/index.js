'use strict';

const LandParcelContract = require('./lib/LandParcelContract');
const OwnershipContract = require('./lib/OwnershipContract');
const EncumbranceContract = require('./lib/EncumbranceContract');
const AuditContract = require('./lib/AuditContract');

module.exports.contracts = [
  LandParcelContract,
  OwnershipContract,
  EncumbranceContract,
  AuditContract
];
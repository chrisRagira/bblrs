import { Gateway, Wallets } from 'fabric-network';
import fs from 'fs';
import path from 'path';

const ccpPath = '/home/user/bblrs/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json'

let listenerGateway = null; // kept alive for listener

// ─── Core Connection ────────────────────────────────────────────────────────

export const connectFabric = async (contractName=null) => {
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  const wallet = await Wallets.newFileSystemWallet('./wallet');
  const gateway = new Gateway();

  await gateway.connect(ccp, {
    wallet,
    identity: 'appUser',
    discovery: { enabled: true, asLocalhost: true }
  });

  const network = await gateway.getNetwork('mychannel');
  const contract = contractName
    ? network.getContract('land', contractName)
    : network.getContract('land');

  return { contract, gateway, network };
};

// ─── Submit Transaction ──────────────────────────────────────────────────────

export const submitTx = async (fn, ...args) => {
  const { contract, gateway } = await connectFabric();

  try {
    const transaction = contract.createTransaction(fn);
    const txId = transaction.getTransactionId();
    const result = await transaction.submit(...args);
    return { txId, result: result.toString() };
  } finally {
    await gateway.disconnect(); // safe — separate from listener gateway
  }
};

// ─── Evaluate (Read-Only) Transaction ───────────────────────────────────────

export const evaluateTx = async (fn, ...args) => {
  const { contract, gateway } = await connectFabric();

  try {
    const result = await contract.evaluateTransaction(fn, ...args);
    return result.toString();
  } finally {
    await gateway.disconnect();
  }
};

export const submitEncumbranceTx = async (fn, ...args) => {
  const { contract, gateway } = await connectFabric('EncumbranceContract');
  try {
    const transaction = contract.createTransaction(fn);
    const txId = transaction.getTransactionId();
    const result = await transaction.submit(...args);
    return { txId, result: result.toString() };
  } finally {
    await gateway.disconnect();
  }
};

export const evaluateEncumbranceTx = async (fn, ...args) => {
  const { contract, gateway } = await connectFabric('EncumbranceContract');
  try {
    const result = await contract.evaluateTransaction(fn, ...args);
    return result.toString();
  } finally {
    await gateway.disconnect();
  }
}

// ─── Event Listener ─────────────────────────────────────────────────────────

export const startFabricListener = async () => {
  if (listenerGateway) return; // prevent duplicate listener on hot reload

  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  const wallet = await Wallets.newFileSystemWallet('./wallet');

  listenerGateway = new Gateway();
  await listenerGateway.connect(ccp, {
    wallet,
    identity: 'appUser',
    discovery: { enabled: true, asLocalhost: true }
  });

  const network = await listenerGateway.getNetwork('mychannel');
  const contract = network.getContract('land');

  await contract.addContractListener((event) => {
    console.log(`[Fabric Event] ${event.eventName}`);

    if (event.eventName === 'PARCEL_CREATED') {
      const payload = JSON.parse(event.payload.toString());
      console.log('[PARCEL_CREATED]', payload);
    }

    if (event.eventName === 'PARCEL_TRANSFERRED') {
      const payload = JSON.parse(event.payload.toString());
      console.log('[PARCEL_TRANSFERRED]', payload);
    }
  });

  console.log('✅ Fabric event listener running');

  process.on('SIGINT', async () => {
    await listenerGateway.disconnect();
    process.exit();
  });
};
import { create } from "ipfs-http-client";

// Using public IPFS gateway (for dev)
const ipfs = create({ 
  url: 'http://localhost:5001'
});


export default ipfs;
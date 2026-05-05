echo 'export PATH=$PATH:$HOME/bblrs/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc
docker pull hyperledger/fabric-nodeenv:2.5
docker pull hyperledger/fabric-baseos:2.5
npm install fabric-ca-client fabric-network 
cd ~/bblrs/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -ca
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go
./network.sh deployCC \
  -ccn land \
  -ccp ../../land-registry-chaincode \
  -ccl javascript
<!-- enrolluser -->




cd ~/bblrs/land-registry-frontend
npm install
npm run dev

wget https://dist.ipfs.tech/kubo/v0.40.1/kubo_v0.40.1_linux-amd64.tar.gz
npm install ipfs-http-client
tar -xvzf kubo_v0.40.1_linux-amd64.tar.gz
cd kubo
sudo bash install.sh
ipfs init
ipfs daemon


cd ~/bblrs/fabric-samples/asset-transfer-basic/application-gateway-javascript
npm install
rm -rf wallet
node src/enrollAdmin.js
node src/registerUser.js
cp wallet/admin.id wallet/appUser.id ~/bblrs/land-registry-backend/wallet


cd ~/bblrs/land-registry-backend
npm install
npx nodemon src/server.js 

ngrok http 3000

export CRYPTO_PATH=~/bblrs/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com
export CHANNEL_NAME=mychannel
export CHAINCODE_NAME=basic
export MSP_ID=Org1MSP
export PEER_ENDPOINT=localhost:7051
export PEER_HOST_ALIAS=peer0.org1.example.com
export FABRIC_CFG_PATH=~/bblrs/fabric-samples/config
export CORE_PEER_MSPCONFIGPATH=~/bblrs/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=~/bblrs/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt


curl -sSL https://bit.ly/2ysbOFE -o install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh 2.5.15 1.5.17


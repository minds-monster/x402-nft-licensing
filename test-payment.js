const { createWalletClient, http, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { Alchemy, Network } = require('alchemy-sdk');
require('dotenv').config();

// ---------------------------------------------------------
// ⚠️ SECURITY WARNING: NEVER COMMIT YOUR PRIVATE KEY! ⚠️
// ---------------------------------------------------------
// Put your private key here (without 0x prefix if it doesn't have one)
const PRIVATE_KEY = 'YOUR_PRIVATE_KEY_HERE'; 

// Example NFT on Base: BasePaint token #1
// Feel free to change these to any NFT you want to query!
const CONTRACT_ADDRESS = '0xBa5e05cb26b78eDa3A2f8e3b3814726305dcAc83'; 
const TOKEN_ID = '1';

async function main() {
  if (PRIVATE_KEY === 'YOUR_PRIVATE_KEY_HERE') {
    console.error('❌ Please set your PRIVATE_KEY in the script.');
    return;
  }

  // Set up Viem Account
  const formattedPrivateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  const account = privateKeyToAccount(formattedPrivateKey);
  
  // Set up RPC URL
  const rpcUrl = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl)
  });

  const alchemy = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.BASE_MAINNET,
  });

  console.log(`\n🔍 Starting test for NFT:\n   Contract: ${CONTRACT_ADDRESS}\n   Token ID: ${TOKEN_ID}`);
  console.log(`💼 Using wallet: ${account.address}\n`);

  // 1. Get the NFT owner
  console.log('1️⃣ Fetching NFT owner from Alchemy...');
  const ownersRes = await alchemy.nft.getOwnersForNft(CONTRACT_ADDRESS, TOKEN_ID);
  const ownerAddress = ownersRes.owners[0];

  if (!ownerAddress) {
    console.error('❌ No owner found for this NFT. Are the contract and token ID correct?');
    return;
  }

  console.log(`✅ Owner found: ${ownerAddress}\n`);

  // 2. Send 1 wei to the owner
  console.log('2️⃣ Sending 1 wei to the owner...');
  let hash;
  try {
    hash = await walletClient.sendTransaction({
      to: ownerAddress,
      value: 1n, // 1 wei
    });
    console.log(`✅ Transaction sent! Hash: ${hash}\n`);
  } catch (error) {
    console.error('❌ Failed to send transaction:', error.message);
    return;
  }

  // 3. Wait for confirmation
  console.log('3️⃣ Waiting for transaction to be confirmed on-chain (this usually takes 2-5 seconds)...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (receipt.status !== 'success') {
    console.error('❌ Transaction failed on-chain.');
    return;
  }
  console.log('✅ Transaction confirmed!\n');

  // 4. Call the local API
  console.log('4️⃣ Calling local API to fetch metadata using X402 payment flow...');
  try {
    const response = await fetch(`http://localhost:3000/api/nft/${CONTRACT_ADDRESS}/${TOKEN_ID}`, {
      headers: {
        'X-Payment-Tx': hash
      }
    });

    const data = await response.json();
    console.log('\n📦 API Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Failed to call API. Make sure your server is running (npm start)! Error:', error);
  }
}

main().catch(console.error);

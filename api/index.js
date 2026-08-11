const express = require('express');
const { Network, Alchemy } = require('alchemy-sdk');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuration
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || '0xPlaceholderAddress...';
// 0.0001 ETH placeholder
const REQUIRED_AMOUNT_WEI = process.env.REQUIRED_AMOUNT_WEI || '100000000000000'; 

// Alchemy configuration for Base Mainnet
const settings = {
  apiKey: process.env.ALCHEMY_API_KEY || 'demo', 
  network: Network.BASE_MAINNET,
};
const alchemy = new Alchemy(settings);

// Viem public client for Base network to verify transactions
const viemClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
});

// In-memory store to prevent transaction replay attacks
// In production, use Redis or a database
const usedTransactions = new Set();

/**
 * X402 Payment Middleware
 * Verifies that the request includes a valid Base network transaction hash
 * that satisfies the payment requirements.
 */
async function x402Middleware(req, res, next) {
  const txHash = req.headers['x-payment-tx'];

  if (!txHash) {
    // Standard X402 / HTTP 402 Payment Required Response
    return res.status(402).json({
      error: 'Payment Required',
      x402: {
        network: 'base',
        token: 'ETH',
        amount: REQUIRED_AMOUNT_WEI,
        recipient: PAYMENT_ADDRESS,
        instruction: 'Please send the required amount to the recipient address on Base and include the transaction hash in the X-Payment-Tx header.'
      }
    });
  }

  try {
    // 1. Check if transaction was already used
    if (usedTransactions.has(txHash)) {
      return res.status(400).json({ error: 'Transaction already used for payment' });
    }

    // 2. Fetch the transaction from the Base network
    const transaction = await viemClient.getTransaction({ hash: txHash });
    const receipt = await viemClient.getTransactionReceipt({ hash: txHash });

    if (!transaction || !receipt) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Transaction failed on-chain' });
    }

    // 3. Verify recipient
    if (transaction.to.toLowerCase() !== PAYMENT_ADDRESS.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid payment recipient' });
    }

    // 4. Verify amount
    if (transaction.value < BigInt(REQUIRED_AMOUNT_WEI)) {
      return res.status(400).json({ error: 'Insufficient payment amount' });
    }

    // Payment is valid. Record the tx as used.
    usedTransactions.add(txHash);

    // Proceed to the protected route
    next();
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
}

/**
 * NFT Endpoint
 * Protected by X402 Middleware
 * Expects GET /api/nft/:contractAddress/:tokenId
 */
app.get('/api/nft/:contractAddress/:tokenId', x402Middleware, async (req, res) => {
  const { contractAddress, tokenId } = req.params;

  try {
    const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
    
    return res.json({
      success: true,
      metadata: nft.rawMetadata,
      image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.rawMetadata?.image,
      name: nft.title || nft.rawMetadata?.name,
      description: nft.description || nft.rawMetadata?.description,
      tokenType: nft.tokenType
    });
  } catch (error) {
    console.error('Alchemy NFT API error:', error);
    return res.status(500).json({ error: 'Failed to fetch NFT data from Alchemy' });
  }
});

/**
 * NFT Search Endpoint
 * FREE TO USE
 * Expects GET /api/nft/search?owner=0x...&contract=0x...
 */
app.get('/api/nft/search', async (req, res) => {
  const { owner, contract } = req.query;
  
  try {
    if (owner) {
      const options = contract ? { contractAddresses: [contract] } : {};
      const nfts = await alchemy.nft.getNftsForOwner(owner, options);
      return res.json({
        success: true, 
        nfts: nfts.ownedNfts.map(nft => ({
          contractAddress: nft.contract.address,
          tokenId: nft.tokenId,
          name: nft.title || nft.rawMetadata?.name,
          image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.rawMetadata?.image
        }))
      });
    } else if (contract) {
      const nfts = await alchemy.nft.getNftsForContract(contract);
      return res.json({
        success: true, 
        nfts: nfts.nfts.map(nft => ({
          contractAddress: nft.contract.address,
          tokenId: nft.tokenId,
          name: nft.title || nft.rawMetadata?.name,
          image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.rawMetadata?.image
        }))
      });
    } else {
      return res.status(400).json({ error: 'Please provide an owner or contract query parameter' });
    }
  } catch (error) {
    console.error('Alchemy NFT API error:', error);
    return res.status(500).json({ error: 'Failed to search NFTs from Alchemy' });
  }
});

// A simple health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', x402: 'enabled' });
});

// Export the express app for Vercel serverless functions
module.exports = app;

// Allow running locally
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Payment required: ${REQUIRED_AMOUNT_WEI} wei to ${PAYMENT_ADDRESS}`);
  });
}

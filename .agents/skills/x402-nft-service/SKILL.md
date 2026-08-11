---
name: x402-nft-service
description: Skill for interacting with the local X402 NFT API Service. Use this skill when the user asks you to interact with or test the NFT metadata or search endpoints that require an X402 payment flow on Base.
---

# Interacting with the X402 NFT API

This workspace contains an X402 payment-gated API for retrieving and searching NFT metadata using Alchemy.

## Endpoints

### 1. Get NFT Metadata
- **URL**: `GET /api/nft/:contractAddress/:tokenId`
- **Description**: Returns the raw metadata and image for a specific NFT.

### 2. Search NFTs
- **URL**: `GET /api/nft/search?owner=0x...&contract=0x...`
- **Description**: Search for NFTs by owner address or contract address. You must provide at least one of these query parameters.

## X402 Payment Flow

All endpoints (except `/api/health`) are protected by an X402 payment middleware on the Base network.

1. **Payment Required (402)**
   If you call an endpoint without an `X-Payment-Tx` header, the server returns an HTTP 402 status code containing payment instructions:
   ```json
   {
     "error": "Payment Required",
     "x402": {
       "network": "base",
       "token": "ETH",
       "amount": "100000000000000",
       "recipient": "<PAYMENT_ADDRESS>",
       "instruction": "Please send the required amount to the recipient address on Base and include the transaction hash in the X-Payment-Tx header."
     }
   }
   ```

2. **Accessing the Data (200)**
   To successfully access the endpoint, you must provide a valid Base network transaction hash that matches the required recipient and amount:
   ```bash
   curl -H "X-Payment-Tx: <ValidBaseTxHash>" http://localhost:3000/api/nft/0xContractAddress/1
   ```
   **Note**: The server prevents transaction replay, so each transaction hash can only be used once.

## Usage Guidelines for Agents
- If asked to fetch NFT data using this service, start the server locally (`npm start`) if it's not already running.
- To test a successful request, you will need a real transaction hash on the Base network that matches the `PAYMENT_ADDRESS` and `REQUIRED_AMOUNT_WEI` defined in the `.env` file, or you will need to modify the server's validation logic temporarily for mocking.

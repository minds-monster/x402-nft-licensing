---
name: x402-nft-licensing-consumer
description: Use this skill to query NFT metadata and search for NFTs via the X402 payment-gated API. Trigger this when you need to fetch NFT details and the user agrees to pay the required fee on the Base network.
---

# X402 NFT Licensing API

This skill allows you to retrieve high-quality NFT metadata and images using an X402 payment-gated API. 
Because this is an X402 API, it requires an on-chain transaction on the **Base** network to unlock the data.

## API Base URL
**Production URL**: `https://<YOUR_PRODUCTION_DOMAIN>` *(Replace with actual deployed Vercel domain)*

## Endpoints

### 1. Get NFT Metadata
- **URL**: `GET {BASE_URL}/api/nft/:contractAddress/:tokenId`
- **Description**: Returns the raw metadata and image for a specific NFT.

### 2. Search NFTs
- **URL**: `GET {BASE_URL}/api/nft/search`
- **Query Parameters**:
  - `owner`: (Optional) The wallet address of the owner.
  - `contract`: (Optional) The contract address of the NFT collection.
  *(Note: You must provide at least one of the query parameters)*

---

## How to Interact (The X402 Flow)

As a consumer agent, you must execute the following two-step process:

### Step 1: Request Payment Instructions (402)
Make a standard GET request to your desired endpoint WITHOUT any payment headers.
The server will reject the request and return an HTTP `402 Payment Required` status.

**Example Response:**
```json
{
  "error": "Payment Required",
  "x402": {
    "network": "base",
    "token": "ETH",
    "amount": "100000000000000",
    "recipient": "0xYourPaymentAddress...",
    "instruction": "Please send the required amount to the recipient address on Base and include the transaction hash in the X-Payment-Tx header."
  }
}
```

### Step 2: Fulfill Payment & Retry (200)
1. Read the `amount`, `recipient`, and `network` from the 402 response.
2. Ask your user for permission to execute this transaction, or use your integrated wallet (if authorized) to send the exact amount to the recipient on the Base network.
3. Once the transaction is submitted, obtain the **Transaction Hash**.
4. Retry the exact same GET request, but this time include the `X-Payment-Tx` header:

```bash
curl -H "X-Payment-Tx: 0x123abc..." {BASE_URL}/api/nft/0xContractAddress/1
```

If the transaction is valid, the server will return the NFT data (HTTP 200).

> **Important Restrictions:**
> - The transaction hash is verified on-chain. It must be successful, sent to the correct recipient, and match or exceed the required amount.
> - Transaction replay is prohibited. You cannot use the same transaction hash for multiple requests.

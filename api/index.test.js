process.env.PAYMENT_ADDRESS = '0x1234';
process.env.REQUIRED_AMOUNT_WEI = '100';

const request = require('supertest');
const app = require('./index');

// Mock viem and alchemy-sdk
jest.mock('viem', () => {
  const mockClient = {
    getTransaction: jest.fn(),
    getTransactionReceipt: jest.fn()
  };
  return {
    createPublicClient: jest.fn(() => mockClient),
    http: jest.fn(),
    __mockClient: mockClient
  };
});

jest.mock('alchemy-sdk', () => {
  const mockNft = {
    getNftMetadata: jest.fn(),
    getNftsForOwner: jest.fn(),
    getNftsForContract: jest.fn()
  };
  return {
    Alchemy: jest.fn().mockImplementation(() => ({ nft: mockNft })),
    Network: { BASE_MAINNET: 'base-mainnet' },
    __mockNft: mockNft
  };
});

const viem = require('viem');
const alchemySdk = require('alchemy-sdk');

describe('API Endpoints', () => {
  let viemClient;
  let alchemyNft;

  beforeEach(() => {
    viemClient = viem.__mockClient;
    alchemyNft = alchemySdk.__mockNft;
    jest.clearAllMocks();
    
    // Set standard environment variables for tests
    process.env.PAYMENT_ADDRESS = '0x1234';
    process.env.REQUIRED_AMOUNT_WEI = '100';
  });

  describe('GET /api/nft/search', () => {
    it('should allow search without payment (free endpoint)', async () => {
      alchemyNft.getNftsForOwner.mockResolvedValue({
        ownedNfts: [{ contract: { address: '0xabc' }, tokenId: '1', title: 'Test NFT' }]
      });

      const response = await request(app).get('/api/nft/search?owner=0xuser');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.nfts.length).toBe(1);
    });
  });

  describe('GET /api/nft/:contractAddress/:tokenId', () => {
    it('should return 402 Payment Required if no X-Payment-Tx header is provided', async () => {
      const response = await request(app).get('/api/nft/0xabc/1');
      
      expect(response.status).toBe(402);
      expect(response.body.error).toBe('Payment Required');
      expect(response.body.x402).toBeDefined();
    });

    it('should return 400 if transaction fails on-chain', async () => {
      viemClient.getTransaction.mockResolvedValue({});
      viemClient.getTransactionReceipt.mockResolvedValue({ status: 'reverted' });

      const response = await request(app)
        .get('/api/nft/0xabc/1')
        .set('X-Payment-Tx', '0xfail');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Transaction failed on-chain');
    });

    it('should return 400 if payment recipient is invalid', async () => {
      viemClient.getTransaction.mockResolvedValue({ to: '0xwrong', value: BigInt('100') });
      viemClient.getTransactionReceipt.mockResolvedValue({ status: 'success' });

      const response = await request(app)
        .get('/api/nft/0xabc/1')
        .set('X-Payment-Tx', '0xbadrecipient');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid payment recipient');
    });

    it('should return 400 if payment amount is insufficient', async () => {
      viemClient.getTransaction.mockResolvedValue({ to: '0x1234', value: BigInt('50') }); // 50 < 100
      viemClient.getTransactionReceipt.mockResolvedValue({ status: 'success' });

      const response = await request(app)
        .get('/api/nft/0xabc/1')
        .set('X-Payment-Tx', '0xbadamount');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Insufficient payment amount');
    });

    it('should return 200 and NFT metadata if payment is valid', async () => {
      viemClient.getTransaction.mockResolvedValue({ to: '0x1234', value: BigInt('100') });
      viemClient.getTransactionReceipt.mockResolvedValue({ status: 'success' });

      alchemyNft.getNftMetadata.mockResolvedValue({
        rawMetadata: {},
        title: 'Paid NFT',
        tokenType: 'ERC721'
      });

      const response = await request(app)
        .get('/api/nft/0xabc/1')
        .set('X-Payment-Tx', '0xgoodtx');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.name).toBe('Paid NFT');
    });
    
    it('should prevent replay attacks by rejecting a used transaction hash', async () => {
      const response = await request(app)
        .get('/api/nft/0xabc/1')
        .set('X-Payment-Tx', '0xgoodtx'); // Used in the previous test
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Transaction already used for payment');
    });
  });
});

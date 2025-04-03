const express = require('express');
const Web3 = require('web3');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Web3
const web3 = new Web3(process.env.ETHEREUM_NODE || 'http://localhost:8545');
const contractABI = require('../client/src/contracts/FaceID.json').abi;
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Admin verification endpoint
app.post('/verify-user', async (req, res) => {
  try {
    const { userAddress, isVerified } = req.body;
    
    // In production, you would verify the face match here server-side
    // For now, we'll just trust the admin (you would secure this in production)
    
    const accounts = await web3.eth.getAccounts();
    await contract.methods.verifyUser(userAddress, isVerified)
      .send({ from: accounts[0] });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const killPort = require('kill-port');

require('dotenv').config();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

const checkPort = async (port, maxPort = 65535) => {

    if (port > maxPort) {
        throw new Error("No available ports found");
    }

    try {
        await killPort(port, "tcp");
        await killPort(port, "udp");
        return port;
    } catch (err) {
        return checkPort(port + 1, maxPort);
    }
};

(async () => {
    const safePort = await checkPort(PORT);
    const getPort = (await import('get-port')).default; // dynamic import
    const final_port = await getPort({ port: safePort });

    console.log(`Port ${final_port} is free. Ready to start server.`);

    // Middleware
    app.use(cors({ origin: `http://localhost:${final_port}` }));
    app.use(express.json());
    app.use(morgan('dev'));

    // Routes
    app.use('/api/items', require('./routes/items'));
    app.use('/api/stats', require('./routes/stats'));

    require('./config/dbHandler.js').connect();

    /**
     * @route    GET /api/TapaswiniApiTest
     * @desc     Fetches the ETH balance of a well-known public address (Vitalik Buterin)
     *           from the Ethereum mainnet using JSON-RPC.
     * @author   Tapaswini
     * @access   public
     * @returns  {JSON} { address, balanceWei, balanceEth }
     */
    app.get('/api/TapaswiniApiTest', async (req, res) => {
        const RPC_URL = 'https://cloudflare-eth.com'; // public, no API key needed
        const ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address

        try {
            const axios = require('axios');
            const response = await axios.post(RPC_URL, {
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [ADDRESS, 'latest'],
                id: 1,
            });

            const balanceWei = parseInt(response.data.result, 16);
            const balanceEth = (balanceWei / 1e18).toFixed(4);

            const result = { address: ADDRESS, balanceWei, balanceEth };
            console.log('[TapaswiniApiTest] ETH balance fetched:', result);

            res.json(result);
        } catch (err) {
            console.error('[TapaswiniApiTest] Error fetching balance:', err.message);
            res.status(500).json({ error: 'Failed to fetch contract data' });
        }
    });

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static('client/build'));
        app.get('*', (req, res) => {
            res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
        });
    }

    // Start server
    app.listen(final_port, () => {
        console.log(`Backend running on http://localhost:${final_port}`);
    });
})();
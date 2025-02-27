const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();
const API_KEY = process.env.DELHIVERY_API_KEY;

router.get('/generate-labels', async (req, res) => {
    try {
        if (!API_KEY) {
            return res.status(500).json({ message: 'API key is missing' });
        }

        // Fetch waybill numbers
        const waybillRes = await axios.get(
            `https://track.delhivery.com/waybill/api/bulk/json/?count=6`,
            {
                headers: {
                    "Authorization": `Token ${API_KEY}`,
                    "Accept": "application/json"
                }
            }
        );

        // Return waybill numbers as JSON
        res.json({ waybills: waybillRes.data });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching waybills', error: error.response?.data || error.message });
    }
});

module.exports = router;

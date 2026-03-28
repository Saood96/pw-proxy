const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

app.get('/', (req, res) => res.send('PW Proxy Active ✅'));

// /pw?url=...&token=...
app.get('/pw', async (req, res) => {
    const { url, token } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        const fetch = (await import('node-fetch')).default;
        const headers = {
            'Origin': 'https://www.pw.live',
            'Referer': 'https://www.pw.live/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { headers });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        response.body.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Wildcard: /sec-prod-mediacdn.pw.live/path?query
app.get('/:domain/*', async (req, res) => {
    const domain = req.params.domain;
    const path = req.params[0];
    const query = new URLSearchParams(req.query).toString();
    const targetUrl = `https://${domain}/${path}${query ? '?' + query : ''}`;

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(targetUrl, {
            headers: {
                'Origin': 'https://www.pw.live',
                'Referer': 'https://www.pw.live/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        response.body.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

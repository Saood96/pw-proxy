const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

app.options('*', cors());

app.get('/', (req, res) => res.send('PW Proxy Active ✅'));

const PW_HEADERS = {
    'Origin': 'https://www.pw.live',
    'Referer': 'https://www.pw.live/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
};

// /pw?url=FULL_URL
app.get('/pw', async (req, res) => {
    const { url, token } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        const fetch = (await import('node-fetch')).default;
        const headers = { ...PW_HEADERS };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`Upstream error ${response.status} for ${url}`);
            return res.status(response.status).send(`Upstream error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');

        // If MPD, rewrite segment URLs to go through this proxy
        if (url.includes('.mpd') || contentType.includes('dash')) {
            let text = await response.text();
            // Get base URL from the original MPD URL
            const urlObj = new URL(url);
            const baseUrl = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
            const proxyBase = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
            
            // Rewrite relative URLs in MPD to go through proxy
            text = text.replace(/([a-zA-Z0-9_\-\/]+\.(mp4|m4s|m4a|m4v))(\?[^"<\s]*)?/g, (match, path, ext, query) => {
                if (match.startsWith('http')) return match;
                const fullUrl = baseUrl + match;
                return `${proxyBase}/segment?url=${encodeURIComponent(fullUrl)}`;
            });
            
            return res.send(text);
        }

        response.body.pipe(res);

    } catch (err) {
        console.error('Proxy /pw error:', err);
        res.status(500).send(err.message);
    }
});

// Segment proxy
app.get('/segment', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('url required');

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, { headers: PW_HEADERS });

        if (!response.ok) {
            console.error(`Segment error ${response.status} for ${url}`);
            return res.status(response.status).send(`Segment error: ${response.status}`);
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
        response.body.pipe(res);

    } catch (err) {
        console.error('Segment error:', err);
        res.status(500).send(err.message);
    }
});

// Wildcard for any pw.live CDN path
app.get('/*', async (req, res) => {
    const path = req.path;
    const query = new URLSearchParams(req.query).toString();
    const targetUrl = `https://sec-prod-mediacdn.pw.live${path}${query ? '?' + query : ''}`;

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(targetUrl, { headers: PW_HEADERS });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        response.body.pipe(res);

    } catch (err) {
        console.error('Wildcard error:', err);
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

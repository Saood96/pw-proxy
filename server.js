const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));
app.options('*', cors());

app.get('/', (req, res) => res.send('PW Proxy Active ✅'));

// /pw?url=...&token=...
app.get('/pw', async (req, res) => {
    const { url, token, parentId, childId } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        const fetch = (await import('node-fetch')).default;

        const headers = {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.pw.live',
            'Referer': 'https://www.pw.live/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['Cookie'] = `token=${token}`;
        }

        const response = await fetch(url, { headers, redirect: 'follow' });

        console.log(`[${response.status}] ${url.substring(0, 80)}`);

        if (!response.ok) {
            return res.status(response.status).send(`Upstream error: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');

        // If MPD, rewrite segment URLs
        if (url.includes('.mpd') || contentType.includes('dash')) {
            let text = await response.text();
            const urlObj = new URL(url);
            const basePath = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
            const queryParams = urlObj.search;
            const myBase = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

            // Rewrite relative segment paths to go through /segment proxy
            text = text.replace(/^(?!#)(\S+)$/gm, (match) => {
                if (match.startsWith('http')) {
                    return `${myBase}/segment?url=${encodeURIComponent(match)}${token ? '&token=' + encodeURIComponent(token) : ''}`;
                }
                const fullUrl = basePath + match.split('?')[0] + queryParams;
                return `${myBase}/segment?url=${encodeURIComponent(fullUrl)}${token ? '&token=' + encodeURIComponent(token) : ''}`;
            });

            return res.send(text);
        }

        response.body.pipe(res);

    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send(err.message);
    }
});

// Segment proxy
app.get('/segment', async (req, res) => {
    const { url, token } = req.query;
    if (!url) return res.status(400).send('url required');

    try {
        const fetch = (await import('node-fetch')).default;

        const headers = {
            'Accept': '*/*',
            'Origin': 'https://www.pw.live',
            'Referer': 'https://www.pw.live/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['Cookie'] = `token=${token}`;
        }

        const response = await fetch(url, { headers, redirect: 'follow' });
        console.log(`[segment ${response.status}] ${url.substring(0, 60)}`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
        response.body.pipe(res);

    } catch (err) {
        console.error('Segment error:', err.message);
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

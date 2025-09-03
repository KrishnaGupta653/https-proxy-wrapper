// // const express = require("express");
// // const { createProxyMiddleware } = require("http-proxy-middleware");
// // const crypto = require("crypto");
// // const fs = require("fs");
// // const Redis = require("ioredis");
// // const bodyParser = require("body-parser");
// // require("dotenv").config();
// // const app = express();
// // app.use(bodyParser.json());

// // // File path for persistent backup
// // // const DATA_FILE = '/mnt/data/path-map.json';
// // // const DATA_FILE = 'C:/Users/kg060/Desktop/projects/http-proxy-wrapper/data.json';

// // // Connect to Redis
// // const redis = new Redis(process.env.REDIS_URL);

// // // Load existing mapping from file
// // let pathMap = {};
// // // if (fs.existsSync(DATA_FILE)) {
// // //   try {
// // //     pathMap = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
// // //     console.log('Loaded mapping from file:', pathMap);
// // //   } catch (err) {
// // //     console.error('Error reading mapping file, starting fresh', err);
// // //     pathMap = {};
// // //   }
// // // }

// // // Sync mapping to Redis
// // const syncToRedis = async () => {
// //   for (const [key, url] of Object.entries(pathMap)) {
// //     await redis.set(key, url);
// //   }
// //   console.log("Synced mapping to Redis");
// // };

// // // Save mapping to file
// // const saveToFile = () => {
// //   // fs.writeFileSync(DATA_FILE, JSON.stringify(pathMap, null, 2));
// //   // console.log('Saved mapping to file');
// // };

// // // Initialize mapping from SITE* env vars
// // const BACKENDS = Object.keys(process.env)
// //   .filter((key) => key.startsWith("SITE"))
// //   .map((key) => process.env[key]);

// // BACKENDS.forEach(async (url) => {
// //   if (!Object.values(pathMap).includes(url)) {
// //     const shortPath = crypto.randomBytes(3).toString("hex"); // 6-char path
// //     pathMap[shortPath] = url;
// //     await redis.set(shortPath, url);
// //   }
// // });
// // // saveToFile();
// // syncToRedis();

// // // Dynamic proxy for all short paths
// // app.use("/:shortPath", async (req, res, next) => {
// //   const { shortPath } = req.params;
// //   const targetUrl = await redis.get(shortPath);

// //   if (!targetUrl) return res.status(404).send("Site not found");

// //   createProxyMiddleware({
// //     target: targetUrl,
// //     changeOrigin: true,
// //     pathRewrite: { [`^/${shortPath}`]: "" },
// //   })(req, res, next);
// // });

// // // Root route: list all links
// // app.get("/", async (req, res) => {
// //   const keys = await redis.keys("*");
// //   res.send(
// //     `<h2>Available proxied sites:</h2>
// //      <ul>
// //        ${keys.map((k) => `<li><a href="/${k}">${k}</a></li>`).join("")}
// //      </ul>`
// //   );
// // });

// // // Admin route: add new backend
// // app.post("/admin/add", async (req, res) => {
// //   const { url } = req.body;
// //   if (!url) return res.status(400).send("Missing URL");
// //   if (Object.values(pathMap).includes(url))
// //     return res.status(400).send("URL already exists");

// //   const shortPath = crypto.randomBytes(3).toString("hex");
// //   pathMap[shortPath] = url;
// //   await redis.set(shortPath, url);
// //   // saveToFile();

// //   res.send({ shortPath, url });
// // });

// // // Admin route: remove backend
// // app.post("/admin/remove", async (req, res) => {
// //   const { shortPath } = req.body;
// //   if (!shortPath) return res.status(400).send("Missing shortPath");
// //   if (!pathMap[shortPath]) return res.status(404).send("Short path not found");

// //   const removedUrl = pathMap[shortPath];
// //   delete pathMap[shortPath];
// //   await redis.del(shortPath);
// //   // saveToFile();

// //   res.send({ removed: shortPath, url: removedUrl });
// // });

// // // Admin route: list all backends
// // app.get("/admin/list", async (req, res) => {
// //   const keys = await redis.keys("*");
// //   const mapping = {};
// //   for (const key of keys) {
// //     mapping[key] = await redis.get(key);
// //   }
// //   res.send(mapping);
// // });

// // // Start server
// // const PORT = process.env.PORT || 10000;
// // app.listen(PORT, () => {
// //   console.log(`Multi-proxy with Redis running on port ${PORT}`);
// // });

const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const crypto = require("crypto");
const fs = require("fs");
const Redis = require("ioredis");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// File path for local backup
const DATA_FILE = './path-map.json';

// Connect to Redis
const redis = new Redis(process.env.REDIS_URL);

// In-memory mapping (synced with Redis and file)
let pathMap = {};

// Load from local file first
const loadFromFile = () => {
  if (fs.existsSync(DATA_FILE)) {
    try {
      pathMap = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      console.log('Loaded mapping from file:', pathMap);
    } catch (err) {
      console.error('Error reading mapping file, starting fresh', err);
      pathMap = {};
    }
  }
};

// Save to local file
const saveToFile = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(pathMap, null, 2));
    console.log('Saved mapping to file');
  } catch (err) {
    console.error('Error saving to file:', err);
  }
};

// Load from Redis and sync with local
const loadFromRedis = async () => {
  try {
    const keys = await redis.keys("*");
    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        pathMap[key] = value;
      }
    }
    console.log('Loaded mapping from Redis:', pathMap);
    saveToFile(); // Keep local file in sync
  } catch (err) {
    console.error('Error loading from Redis:', err);
  }
};

// Save to Redis
const saveToRedis = async (key, value) => {
  try {
    await redis.set(key, value);
    console.log(`Saved to Redis: ${key} -> ${value}`);
  } catch (err) {
    console.error('Error saving to Redis:', err);
  }
};

// Delete from Redis
const deleteFromRedis = async (key) => {
  try {
    await redis.del(key);
    console.log(`Deleted from Redis: ${key}`);
  } catch (err) {
    console.error('Error deleting from Redis:', err);
  }
};

// Generate unique short path
const generateShortPath = () => {
  let shortPath;
  let attempts = 0;
  do {
    shortPath = crypto.randomBytes(3).toString("hex");
    attempts++;
    if (attempts > 100) {
      // Fallback to incremental naming
      shortPath = `site${Object.keys(pathMap).length + 1}`;
      break;
    }
  } while (pathMap[shortPath]);
  return shortPath;
};

// Initialize - load from file first, then Redis, then env vars
const initialize = async () => {
  loadFromFile();
  await loadFromRedis();
  
  // Add sites from environment variables
  const BACKENDS = Object.keys(process.env)
    .filter((key) => key.startsWith("SITE"))
    .map((key) => process.env[key]);

  for (const url of BACKENDS) {
    if (!Object.values(pathMap).includes(url)) {
      const shortPath = generateShortPath();
      pathMap[shortPath] = url;
      await saveToRedis(shortPath, url);
      saveToFile();
      console.log(`Added from env: ${shortPath} -> ${url}`);
    }
  }
};

// Redirect HTTP to HTTPS in production
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});

// Root route: list all links
app.get("/", async (req, res) => {
  const host = req.get('host');
  const protocol = req.header('x-forwarded-proto') || req.protocol;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Multi-Site Proxy</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            ul { list-style-type: none; padding: 0; }
            li { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            a { text-decoration: none; color: #007bff; font-weight: bold; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <h2>Available Proxied Sites</h2>
        <ul>
          ${Object.entries(pathMap).map(([key, url]) => 
            `<li><a href="/${key}/" target="_blank">${key}</a> → ${url}</li>`
          ).join("")}
        </ul>
        <p><strong>Total sites:</strong> ${Object.keys(pathMap).length}</p>
    </body>
    </html>
  `);
});

// Admin route: add new backend
app.post("/admin/add", async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }
  
  if (Object.values(pathMap).includes(url)) {
    return res.status(400).json({ error: "URL already exists" });
  }

  const shortPath = generateShortPath();
  pathMap[shortPath] = url;
  await saveToRedis(shortPath, url);
  saveToFile();

  res.json({ shortPath, url, message: "Backend added successfully" });
});

// Admin route: remove backend
app.post("/admin/remove", async (req, res) => {
  const { shortPath } = req.body;
  
  if (!shortPath) {
    return res.status(400).json({ error: "Missing shortPath" });
  }
  
  if (!pathMap[shortPath]) {
    return res.status(404).json({ error: "Short path not found" });
  }

  const removedUrl = pathMap[shortPath];
  delete pathMap[shortPath];
  await deleteFromRedis(shortPath);
  saveToFile();

  res.json({ removed: shortPath, url: removedUrl, message: "Backend removed successfully" });
});

// Admin route: list all backends
app.get("/admin/list", (req, res) => {
  res.json(pathMap);
});

// Dynamic proxy for all short paths
app.use("/:shortPath", (req, res, next) => {
  const { shortPath } = req.params;
  const targetUrl = pathMap[shortPath];

  if (!targetUrl) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <body>
          <h2>Site not found</h2>
          <p>The path "/${shortPath}" is not configured.</p>
          <a href="/">← Back to site list</a>
      </body>
      </html>
    `);
  }

  // Create proxy middleware
  const proxy = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { [`^/${shortPath}`]: "" },
    onProxyReq: (proxyReq, req, res) => {
      // Forward original host and protocol info
      proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
      proxyReq.setHeader('X-Forwarded-Proto', req.header('x-forwarded-proto') || req.protocol);
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${shortPath}:`, err.message);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <body>
            <h2>Proxy Error</h2>
            <p>Unable to connect to the backend service.</p>
            <p>Error: ${err.message}</p>
            <a href="/">← Back to site list</a>
        </body>
        </html>
      `);
    }
  });

  proxy(req, res, next);
});

// Start server
const PORT = process.env.PORT || 10000;

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`Multi-proxy server running on port ${PORT}`);
    console.log(`Active sites: ${Object.keys(pathMap).length}`);
  });
}).catch(err => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});

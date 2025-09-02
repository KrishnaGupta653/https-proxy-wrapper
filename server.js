const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const crypto = require("crypto");
const fs = require("fs");
const Redis = require("ioredis");
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
app.use(bodyParser.json());

// File path for persistent backup
// const DATA_FILE = '/mnt/data/path-map.json';
// const DATA_FILE = 'C:/Users/kg060/Desktop/projects/http-proxy-wrapper/data.json';

// Connect to Redis
const redis = new Redis(process.env.REDIS_URL);

// Load existing mapping from file
let pathMap = {};
// if (fs.existsSync(DATA_FILE)) {
//   try {
//     pathMap = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
//     console.log('Loaded mapping from file:', pathMap);
//   } catch (err) {
//     console.error('Error reading mapping file, starting fresh', err);
//     pathMap = {};
//   }
// }

// Sync mapping to Redis
const syncToRedis = async () => {
  for (const [key, url] of Object.entries(pathMap)) {
    await redis.set(key, url);
  }
  console.log("Synced mapping to Redis");
};

// Save mapping to file
const saveToFile = () => {
  // fs.writeFileSync(DATA_FILE, JSON.stringify(pathMap, null, 2));
  // console.log('Saved mapping to file');
};

// Initialize mapping from SITE* env vars
const BACKENDS = Object.keys(process.env)
  .filter((key) => key.startsWith("SITE"))
  .map((key) => process.env[key]);

BACKENDS.forEach(async (url) => {
  if (!Object.values(pathMap).includes(url)) {
    const shortPath = crypto.randomBytes(3).toString("hex"); // 6-char path
    pathMap[shortPath] = url;
    await redis.set(shortPath, url);
  }
});
// saveToFile();
syncToRedis();

// Dynamic proxy for all short paths
app.use("/:shortPath", async (req, res, next) => {
  const { shortPath } = req.params;
  const targetUrl = await redis.get(shortPath);

  if (!targetUrl) return res.status(404).send("Site not found");

  createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { [`^/${shortPath}`]: "" },
  })(req, res, next);
});

// Root route: list all links
app.get("/", async (req, res) => {
  const keys = await redis.keys("*");
  res.send(
    `<h2>Available proxied sites:</h2>
     <ul>
       ${keys.map((k) => `<li><a href="/${k}">${k}</a></li>`).join("")}
     </ul>`
  );
});

// Admin route: add new backend
app.post("/admin/add", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send("Missing URL");
  if (Object.values(pathMap).includes(url))
    return res.status(400).send("URL already exists");

  const shortPath = crypto.randomBytes(3).toString("hex");
  pathMap[shortPath] = url;
  await redis.set(shortPath, url);
  // saveToFile();

  res.send({ shortPath, url });
});

// Admin route: remove backend
app.post("/admin/remove", async (req, res) => {
  const { shortPath } = req.body;
  if (!shortPath) return res.status(400).send("Missing shortPath");
  if (!pathMap[shortPath]) return res.status(404).send("Short path not found");

  const removedUrl = pathMap[shortPath];
  delete pathMap[shortPath];
  await redis.del(shortPath);
  // saveToFile();

  res.send({ removed: shortPath, url: removedUrl });
});

// Admin route: list all backends
app.get("/admin/list", async (req, res) => {
  const keys = await redis.keys("*");
  const mapping = {};
  for (const key of keys) {
    mapping[key] = await redis.get(key);
  }
  res.send(mapping);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Multi-proxy with Redis running on port ${PORT}`);
});

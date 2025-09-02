# HTTP Proxy Wrapper

A dynamic HTTP proxy service that creates short-path redirects to backend services using Redis for storage and Express.js for routing.

## 🚀 Features

- **Dynamic Proxy Routing**: Automatically generates short paths (e.g., `/a1b2c3`) for backend URLs
- **Redis Storage**: Fast, persistent mapping storage with file backup
- **Admin API**: RESTful endpoints to manage backend services
- **Environment Variables**: Auto-load backends from `SITE*` environment variables
- **Web Interface**: Simple HTML interface to view all available proxied sites

## 📋 Prerequisites

- Node.js (v14 or higher)
- Redis server
- npm or yarn

## 🛠️ Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd http-proxy-wrapper
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file:

```env
REDIS_URL=redis://localhost:6379
PORT=10000
SITE1=https://example1.com
SITE2=https://example2.com
```

4. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## 🔧 Configuration

### Environment Variables

- `REDIS_URL`: Redis connection string (required)
- `PORT`: Server port (default: 10000)
- `SITE*`: Backend URLs to auto-register (e.g., SITE1, SITE2, etc.)

### Data Persistence

- **Redis**: Primary storage for fast lookups
- **File Backup**: `data.json` for persistence across restarts

## 📡 API Endpoints

### Public Routes

- `GET /` - List all available proxied sites
- `GET /:shortPath` - Proxy to backend service

### Admin Routes

#### Add Backend

```bash
curl -X POST http://localhost:10000/admin/add \
  -H "Content-Type: application/json" \
  -d '{"url":"https://newbackend.com"}'
```

#### Remove Backend

```bash
curl -X POST http://localhost:10000/admin/remove \
  -H "Content-Type: application/json" \
  -d '{"shortPath":"a1b2c3"}'
```

#### List All Backends

```bash
curl http://localhost:10000/admin/list
```

## 🎯 Usage Examples

1. **Auto-registered sites** (from environment variables):

   - Visit `http://localhost:10000/` to see all available short paths
   - Click any link to be proxied to the backend service

2. **Add a new backend**:

   ```bash
   curl -X POST http://localhost:10000/admin/add \
     -H "Content-Type: application/json" \
     -d '{"url":"https://api.example.com"}'
   ```

   Response: `{"shortPath":"f4e2d1","url":"https://api.example.com"}`

3. **Access the proxied service**:
   - Visit `http://localhost:10000/f4e2d1` to be proxied to `https://api.example.com`

## 🏗️ Architecture

```
Client Request → Express Server → Redis Lookup → Proxy Middleware → Backend Service
                     ↓
                File Backup (data.json)
```

## 🔒 Security Considerations

- Add authentication for admin routes in production
- Implement rate limiting
- Validate URL formats before adding backends
- Use HTTPS in production

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Error**: Ensure Redis server is running and `REDIS_URL` is correct
2. **Port Already in Use**: Change the `PORT` environment variable
3. **Backend Not Accessible**: Check if the target URL is reachable

### Logs

The server logs all operations to the console. Check for:

- Mapping synchronization messages
- Proxy request logs
- Error messages for failed operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚀 Deployment

### Render.com

1. Connect your GitHub repository
2. Set environment variables in Render dashboard
3. Deploy with the start command: `npm start`

### Docker

```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 10000
CMD ["npm", "start"]
```

## 📊 Performance

- **Redis**: Sub-millisecond lookups
- **Express**: Handles thousands of concurrent connections
- **Proxy Middleware**: Efficient request forwarding with minimal overhead

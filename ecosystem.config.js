// PM2 Ecosystem Configuration
// Use with: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'learntrack',
    script: './server.js',
    
    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    
    // Process management
    instances: 1,
    exec_mode: 'cluster',
    
    // Restart behavior
    watch: false,
    max_memory_restart: '500M',
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000
  }]
};

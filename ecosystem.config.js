const { EC2_HOST, EC2_USERNAME, SERVER_PORT } = require('./server/config/deployment');

module.exports = {
  apps: [
    {
      name: 'colabvibe-server',
      script: './server/dist/src/server.js',
      cwd: '/home/ubuntu/covibes',
      env: {
        NODE_ENV: 'production',
        PORT: SERVER_PORT,
        EC2_HOST: EC2_HOST,
        EC2_USERNAME: EC2_USERNAME
      },
      env_file: './server/.env.production',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      log_file: '/home/ubuntu/covibes/logs/colabvibe-server.log',
      out_file: '/home/ubuntu/covibes/logs/colabvibe-server-out.log',
      error_file: '/home/ubuntu/covibes/logs/colabvibe-server-error.log',
      time: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'colabvibe-client',
      script: 'npx',
      args: ['serve', '-s', 'dist', '-l', '3000'],
      cwd: '/home/ubuntu/covibes/client',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      log_file: '/home/ubuntu/covibes/logs/colabvibe-client.log',
      out_file: '/home/ubuntu/covibes/logs/colabvibe-client-out.log',
      error_file: '/home/ubuntu/covibes/logs/colabvibe-client-error.log',
      time: true
    }
  ]
};
module.exports = {
  apps: [
    {
      name: 'covibes-server',
      script: './server/dist/src/server.js',
      cwd: '/home/ubuntu/covibes',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        EC2_HOST: 'ec2-13-48-135-139.eu-north-1.compute.amazonaws.com',
        EC2_USERNAME: 'ubuntu',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5433/covibes_prod',
        JWT_SECRET: 'prod_jwt_2024_covibes_secure_random_key_123456789',
        ENCRYPTION_KEY: 'abcdef1234567890abcdef1234567890',
        SESSION_SECRET: 'prod_session_covibes_secure_secret_key_987654321'
      },
      env_file: './server/.env.production',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      log_file: '/home/ubuntu/covibes/logs/covibes-server.log',
      out_file: '/home/ubuntu/covibes/logs/covibes-server-out.log',
      error_file: '/home/ubuntu/covibes/logs/covibes-server-error.log',
      time: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'covibes-client',
      script: 'npx',
      args: ['serve', '-s', 'dist', '-l', '3000'],
      cwd: '/home/ubuntu/covibes/client',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      log_file: '/home/ubuntu/covibes/logs/covibes-client.log',
      out_file: '/home/ubuntu/covibes/logs/covibes-client-out.log',
      error_file: '/home/ubuntu/covibes/logs/covibes-client-error.log',
      time: true
    }
  ]
};
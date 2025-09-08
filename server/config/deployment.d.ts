export interface DeploymentConfig {
  PRIMARY_HOST: string;
  EC2_HOST: string;
  BASE_HOST: string;
  SERVER_PORT: number;
  CLIENT_PORT: number;
  PREVIEW_PORT_RANGE: { min: number; max: number };
  EC2_USERNAME: string;
  SERVER_URL: string;
  CLIENT_URL: string;
  WEBSOCKET_URL: string;
  validate(): void;
}

declare const config: DeploymentConfig;
export = config;
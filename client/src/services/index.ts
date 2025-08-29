// Export all services for easy importing
export { apiService, ApiError } from './api';
export type { 
  JoinTeamRequest, 
  SpawnAgentRequest, 
  VMConfigRequest, 
  RepositoryConfigRequest,
  AuthUser, 
  AuthTeam, 
  EnhancedAuthResponse, 
  AgentDetails 
} from './api';

export { socketService, SocketError } from './socket';
export type { 
  SocketEventListeners, 
  ConnectionState, 
  SocketUser, 
  SocketTeam, 
  SocketChatMessage, 
  SocketAgentOutput, 
  SocketAgentEvent, 
  SocketUserActivity 
} from './socket';
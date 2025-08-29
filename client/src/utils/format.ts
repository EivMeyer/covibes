// Utility functions for formatting data

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString();
}

export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function formatAgentStatus(status: string): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'running':
      return 'Running';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'idle':
      return 'text-gray-500';
    case 'running':
      return 'text-green-500';
    case 'stopped':
      return 'text-red-500';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'idle':
      return 'bg-gray-100';
    case 'running':
      return 'bg-green-100';
    case 'stopped':
      return 'bg-red-100';
    case 'error':
      return 'bg-red-100';
    default:
      return 'bg-gray-100';
  }
}
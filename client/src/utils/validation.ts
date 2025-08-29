// Validation utility functions

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidTeamName(teamName: string): boolean {
  // Team name should be 3-50 characters, alphanumeric and spaces
  return teamName.length >= 3 && teamName.length <= 50 && /^[a-zA-Z0-9\s]+$/.test(teamName);
}

export function isValidUserName(userName: string): boolean {
  // Username should be 2-30 characters, alphanumeric and underscores
  return userName.length >= 2 && userName.length <= 30 && /^[a-zA-Z0-9_]+$/.test(userName);
}

export function isValidPassword(password: string): boolean {
  // Password should be at least 6 characters
  return password.length >= 6;
}

export function isValidAgentName(name: string): boolean {
  // Agent name should be 1-50 characters, alphanumeric, spaces, hyphens, and underscores
  return name.length >= 1 && name.length <= 50 && /^[a-zA-Z0-9\s\-_]+$/.test(name);
}

export function isValidIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateLoginForm(data: {
  teamName: string;
  userName: string;
  password: string;
}): ValidationResult {
  if (!data.teamName.trim()) {
    return { isValid: false, error: 'Team name is required' };
  }
  
  if (!isValidTeamName(data.teamName)) {
    return { isValid: false, error: 'Team name must be 3-50 characters, alphanumeric and spaces only' };
  }
  
  if (!data.userName.trim()) {
    return { isValid: false, error: 'Username is required' };
  }
  
  if (!isValidUserName(data.userName)) {
    return { isValid: false, error: 'Username must be 2-30 characters, alphanumeric and underscores only' };
  }
  
  if (!data.password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (!isValidPassword(data.password)) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }
  
  return { isValid: true };
}

export function validateRegisterForm(data: {
  teamName: string;
  userName: string;
  email: string;
  password: string;
}): ValidationResult {
  const loginValidation = validateLoginForm(data);
  if (!loginValidation.isValid) {
    return loginValidation;
  }
  
  if (!data.email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!isValidEmail(data.email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
}
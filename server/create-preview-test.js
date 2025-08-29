import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

// Create a valid JWT token
const token = jwt.sign(
  { 
    userId: 'cme7dtj050000ilc9jpswop3',
    teamId: 'cme7dtl770000ilc9c4590sb7'
  },
  'development-jwt-secret-key',
  { expiresIn: '1h' }
);

async function createPreview() {
  try {
    const response = await fetch('http://localhost:3001/api/preview/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ branch: 'workspace' })
    });
    
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}

createPreview();

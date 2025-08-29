import { universalPreviewService } from './services/universal-preview-service.js';

const status = universalPreviewService.getPreviewStatus('cme7dtl770000ilc9c4590sb7');
console.log('Preview status for team cme7dtl770000ilc9c4590sb7:', status);

// Also check if container is really running
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function checkDocker() {
  try {
    const { stdout } = await execAsync('docker ps --format "table {{.Names}}\t{{.Ports}}" | grep preview');
    console.log('\nDocker containers:\n', stdout);
  } catch (e) {
    console.log('No preview containers running');
  }
}

checkDocker();

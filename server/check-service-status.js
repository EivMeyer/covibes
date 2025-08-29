import { universalPreviewService } from './services/universal-preview-service.js';

const status = universalPreviewService.getPreviewStatus('cme7dtl770000ilc9c4590sb7');
console.log('Preview status in service:', status);

// Test if we can access the preview
if (status && status.port) {
  fetch(`http://localhost:${status.port}`)
    .then(res => res.text())
    .then(text => {
      console.log('Preview content includes "Live Preview":', text.includes('Live Preview'));
      console.log('Preview content includes "ColabVibe Preview":', text.includes('ColabVibe Preview'));
    });
}

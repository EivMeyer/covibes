/**
 * VM Preview Service - Stub implementation
 * This is a placeholder for the actual VM preview service
 */
class VMPreviewService {
    constructor() {
        this.previews = new Map();
    }
    getPreviewStatus(teamId) {
        return null; // No VM preview running
    }
    async startPreview(teamId) {
        throw new Error('VM preview mode not configured. Using local Docker preview instead.');
    }
    async stopPreview(teamId) {
        // No-op for now
    }
    async getContainerLogs(teamId) {
        return [];
    }
}
export const vmPreviewService = new VMPreviewService();

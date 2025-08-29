/**
 * VM Preview Service - Stub implementation
 * This is a placeholder for the actual VM preview service
 */

interface VMPreviewStatus {
  status: string;
  localPort: number;
  error?: string;
}

class VMPreviewService {
  // No instance variables needed for stub implementation

  getPreviewStatus(_teamId: string): VMPreviewStatus | null {
    return null; // No VM preview running
  }

  async startPreview(_teamId: string): Promise<VMPreviewStatus> {
    throw new Error('VM preview mode not configured. Using local Docker preview instead.');
  }

  async stopPreview(_teamId: string) {
    // No-op for now
  }

  async getContainerLogs(_teamId: string): Promise<string[]> {
    return [];
  }
}

export const vmPreviewService = new VMPreviewService();
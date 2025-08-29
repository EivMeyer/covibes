/**
 * GitHub Service for Repository Management
 *
 * Requirements:
 * - Fetch user repositories from GitHub
 * - Decrypt and use stored GitHub access tokens
 * - Handle GitHub API rate limiting
 * - Support repository search and filtering
 */
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import { cryptoService } from './crypto.js';
const prisma = new PrismaClient();
export class GitHubService {
    constructor(userId) {
        this.octokit = null;
        this.userId = userId;
    }
    /**
     * Initialize Octokit with user's stored access token
     */
    async initializeOctokit() {
        if (this.octokit) {
            return this.octokit;
        }
        // Get user's encrypted access token from database
        const user = await prisma.users.findUnique({
            where: { id: this.userId },
            select: { accessToken: true, githubUsername: true }
        });
        if (!user?.accessToken) {
            throw new Error('No GitHub access token found for user');
        }
        // Decrypt the access token
        let decryptedToken;
        try {
            const encryptedData = JSON.parse(user.accessToken);
            decryptedToken = cryptoService.decrypt(encryptedData);
        }
        catch (error) {
            throw new Error('Failed to decrypt GitHub access token');
        }
        // Initialize Octokit with the decrypted token
        this.octokit = new Octokit({
            auth: decryptedToken,
            userAgent: 'ColabVibe/1.0.0'
        });
        return this.octokit;
    }
    /**
     * Get authenticated user's repositories
     */
    async getUserRepositories(options) {
        const octokit = await this.initializeOctokit();
        try {
            const requestParams = {
                sort: options?.sort || 'updated',
                per_page: options?.per_page || 30,
                page: options?.page || 1
            };
            // GitHub API: If you specify type, you cannot specify affiliation
            const type = options?.type;
            if (type) {
                // Use type parameter when specified
                requestParams.type = type;
            }
            else {
                // When no type is specified, use affiliation to get all accessible repos
                requestParams.affiliation = 'owner,collaborator,organization_member';
            }
            const response = await octokit.repos.listForAuthenticatedUser(requestParams);
            return response.data;
        }
        catch (error) {
            if (error.status === 401) {
                throw new Error('GitHub authentication failed. Please reconnect your GitHub account.');
            }
            throw new Error(`Failed to fetch repositories: ${error.message}`);
        }
    }
    /**
     * Get a specific repository by name
     */
    async getRepository(owner, repo) {
        const octokit = await this.initializeOctokit();
        try {
            const response = await octokit.repos.get({
                owner,
                repo
            });
            return response.data;
        }
        catch (error) {
            if (error.status === 404) {
                throw new Error('Repository not found');
            }
            if (error.status === 401) {
                throw new Error('GitHub authentication failed');
            }
            throw new Error(`Failed to fetch repository: ${error.message}`);
        }
    }
    /**
     * Search repositories accessible to the user
     */
    async searchRepositories(query, options) {
        const octokit = await this.initializeOctokit();
        try {
            const user = await prisma.users.findUnique({
                where: { id: this.userId },
                select: { githubUsername: true }
            });
            // Search query including user's repos
            const searchQuery = `${query} user:${user?.githubUsername || '@me'}`;
            const response = await octokit.search.repos({
                q: searchQuery,
                per_page: options?.per_page || 10,
                page: options?.page || 1,
                sort: 'updated'
            });
            return response.data.items;
        }
        catch (error) {
            throw new Error(`Failed to search repositories: ${error.message}`);
        }
    }
    /**
     * Get repository branches
     */
    async getRepositoryBranches(owner, repo) {
        const octokit = await this.initializeOctokit();
        try {
            const response = await octokit.repos.listBranches({
                owner,
                repo,
                per_page: 100
            });
            return response.data.map(branch => branch.name);
        }
        catch (error) {
            throw new Error(`Failed to fetch branches: ${error.message}`);
        }
    }
    /**
     * Check if user has access to a repository
     */
    async hasRepositoryAccess(owner, repo) {
        try {
            await this.getRepository(owner, repo);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get user's GitHub profile
     */
    async getUserProfile() {
        const octokit = await this.initializeOctokit();
        try {
            const response = await octokit.users.getAuthenticated();
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to fetch GitHub profile: ${error.message}`);
        }
    }
    /**
     * Validate GitHub access token is still valid
     */
    async validateToken() {
        try {
            await this.getUserProfile();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get repository clone URL based on user preference
     */
    async getCloneUrl(owner, repo, useSSH = false) {
        const repository = await this.getRepository(owner, repo);
        return useSSH ? repository.ssh_url : repository.clone_url;
    }
}
/**
 * Create a GitHub service instance for a user
 */
export function createGitHubService(userId) {
    return new GitHubService(userId);
}
/**
 * Check if user has GitHub integration
 */
export async function hasGitHubIntegration(userId) {
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { githubId: true, accessToken: true }
    });
    return !!(user?.githubId && user?.accessToken);
}

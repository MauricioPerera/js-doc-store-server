import { AuthStorage } from "@earendil-works/pi-coding-agent";
import fs from "fs";
import path from "path";

/**
 * VaultBridge connects the Agent's AuthStorage to the Server's encrypted Vault.
 *
 * When constructed with `{ authPath }`, the SDK's AuthStorage persists keys to
 * that file across restarts (note: this file is plaintext JSON — keep the
 * .pi/agent directory out of git and off shared volumes). When `authPath` is
 * omitted the storage is in-memory only and keys vanish on process exit.
 */
class VaultBridge {
    constructor(serverVault, { authPath } = {}) {
        this.serverVault = serverVault;
        this.authPath = authPath || null;
        if (this.authPath) {
            fs.mkdirSync(path.dirname(this.authPath), { recursive: true });
        }
        this.authStorage = this.authPath ? AuthStorage.create(this.authPath) : AuthStorage.create();
    }

    /**
     * Syncs a specific API key from the server vault to the agent's runtime.
     * @param {string} provider - e.g., 'anthropic'
     * @param {string} encryptedKey - The encrypted key from the database
     */
    async syncKey(provider, encryptedKey) {
        try {
            const decryptedKey = await this.serverVault.decrypt(encryptedKey);
            this.authStorage.setRuntimeApiKey(provider, decryptedKey);
            return true;
        } catch (e) {
            console.error(`[VaultBridge] Failed to sync key for ${provider}:`, e);
            return false;
        }
    }

    getAuthStorage() {
        return this.authStorage;
    }
}

export { VaultBridge };

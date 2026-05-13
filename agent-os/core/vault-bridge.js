import { AuthStorage } from "@earendil-works/pi-coding-agent";

/**
 * VaultBridge connects the Agent's AuthStorage to the Server's encrypted Vault.
 * This prevents the agent from needing a plain-text auth.json and allows it
 * to use the server's secure credential management.
 */
class VaultBridge {
    constructor(serverVault) {
        this.serverVault = serverVault; // Instance of VaultCrypto from server.js
        this.authStorage = AuthStorage.create(); 
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

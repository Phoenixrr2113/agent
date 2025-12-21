export interface ApiKeyRecord {
  keyHash: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiKeyStorage {
  validate(key: string): Promise<string | null>;
  create(name: string): Promise<{ key: string; keyHash: string }>;
  list(): Promise<Array<{ keyHash: string; name: string; createdAt: Date; lastUsedAt: Date | null }>>;
  revoke(keyHash: string): Promise<boolean>;
  updateLastUsed(keyHash: string): Promise<void>;
  close(): Promise<void>;
}

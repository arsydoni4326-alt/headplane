export interface HeadscaleInstanceConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string; // Only present when creating/updating
  oidcClientId?: string;
  oidcClientSecret?: string; // Only present when creating/updating
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HeadscaleInstanceListItem {
  id: string;
  name: string;
  apiUrl: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  status?: "connected" | "disconnected" | "unknown";
}

export interface CreateInstanceRequest {
  name: string;
  apiUrl: string;
  apiKey?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  isDefault?: boolean;
}

export interface UpdateInstanceRequest {
  name?: string;
  apiUrl?: string;
  apiKey?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  isDefault?: boolean;
}

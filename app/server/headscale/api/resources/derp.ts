import type { Transport } from "../transport";

export interface DerpRegion {
  regionId: number;
  regionName: string;
  regionCode: string;
  nodes: DerpNode[];
}

export interface DerpNode {
  name: string;
  hostName: string;
  derpPort: number;
  stunPort: number;
  ipv4: string;
  ipv6: string;
}

export interface DerpResponse {
  configured: boolean;
  totalRegions: number;
  regions: DerpRegion[];
}

export interface DerpApi {
  get(): Promise<DerpResponse>;
}

export function makeDerpApi(transport: Transport, apiKey: string): DerpApi {
  return {
    get: async () => {
      return transport.request<DerpResponse>({
        method: "GET",
        path: "v1/derp",
        apiKey,
      });
    },
  };
}

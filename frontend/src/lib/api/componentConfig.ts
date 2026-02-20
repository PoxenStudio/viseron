/**
 * API client for reading/writing global (non-camera-keyed) component config
 * sections in config.yaml via GET/PUT /api/v1/config/{component}.
 *
 * Supported components: "logger", "storage", "webserver"
 */
import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToast } from "hooks/UseToast";
import { viseronAPI } from "lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoggerConfig {
  default_level?: string;
  logs?: Record<string, string>;
  cameras?: Record<string, string>;
}

export type ComponentConfigData = LoggerConfig | Record<string, unknown>;

// ---------------------------------------------------------------------------
// Raw fetch helpers
// ---------------------------------------------------------------------------

async function getComponentConfig<T = ComponentConfigData>(
  component: string,
): Promise<T> {
  const response = await viseronAPI.get<T>(`config/${component}`);
  return response.data;
}

async function updateComponentConfig(
  component: string,
  data: ComponentConfigData,
): Promise<void> {
  await viseronAPI.put(`config/${component}`, data);
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

export const useComponentConfig = <T = ComponentConfigData>(
  component: string,
  queryOptions?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) =>
  useQuery<T, Error>({
    queryKey: ["component-config", component],
    queryFn: () => getComponentConfig<T>(component),
    ...queryOptions,
  });

export const useUpdateComponentConfig = (
  component: string,
  mutationOptions?: Omit<
    UseMutationOptions<void, Error, ComponentConfigData>,
    "mutationFn"
  >,
) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<void, Error, ComponentConfigData>({
    mutationFn: (data) => updateComponentConfig(component, data),
    onSuccess: () => {
      toast.success(
        `'${component}' configuration saved. Restart Viseron to apply.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["component-config", component],
      });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error
          ? `Failed to save: ${error.response.data.error}`
          : `Error: ${error.message}`,
      );
    },
    ...mutationOptions,
  });
};

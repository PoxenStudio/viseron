import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToast } from "hooks/UseToast";
import { viseronAPI } from "lib/api/client";

export interface TuneConfig {
  [key: string]: any;
}

type TuneVariables = {
  camera_identifier: string;
  configOptions?: Omit<
    UseQueryOptions<TuneConfig, Error>,
    "queryKey" | "queryFn"
  >;
};

export interface UpdateTuneConfigPayload {
  domain: string;
  component: string;
  data: any;
}

export interface CreateCameraPayload {
  component: string;
  identifier: string;
  data: Record<string, any>;
}

export interface DeleteCameraPayload {
  camera_identifier: string;
  component: string;
}

async function getTuneConfig(camera_identifier: string) {
  const response = await viseronAPI.get<TuneConfig>(
    `tune/${camera_identifier}`,
  );
  return response.data;
}

async function updateTuneConfig(
  camera_identifier: string,
  payload: UpdateTuneConfigPayload,
) {
  const response = await viseronAPI.put(`tune/${camera_identifier}`, payload);
  return response.data;
}

async function createCamera(payload: CreateCameraPayload) {
  const response = await viseronAPI.post(`tune`, payload);
  return response.data;
}

async function deleteCamera({ camera_identifier, component }: DeleteCameraPayload) {
  const response = await viseronAPI.delete(`tune/${camera_identifier}`, {
    data: { component },
  });
  return response.data;
}

export const useTuneConfig = ({
  camera_identifier,
  configOptions,
}: TuneVariables) =>
  useQuery({
    queryKey: ["tune", camera_identifier],
    queryFn: () => getTuneConfig(camera_identifier),
    enabled: !!camera_identifier,
    ...configOptions,
  });

export const useUpdateTuneConfig = (
  camera_identifier: string,
  mutationOptions?: Omit<
    UseMutationOptions<any, Error, UpdateTuneConfigPayload>,
    "mutationFn"
  >,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateTuneConfigPayload) =>
      updateTuneConfig(camera_identifier, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tune", camera_identifier],
      });
    },
    ...mutationOptions,
  });
};

export const useCreateCamera = (
  mutationOptions?: Omit<
    UseMutationOptions<any, any, CreateCameraPayload>,
    "mutationFn"
  >,
) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: createCamera,
    onSuccess: (_data, variables) => {
      toast.success(`Camera '${variables.identifier}' created. Restart Viseron to apply.`);
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error
          ? `Failed to create camera: ${error.response.data.error}`
          : `An error occurred: ${error.message}`,
      );
    },
    ...mutationOptions,
  });
};

export const useDeleteCamera = (
  mutationOptions?: Omit<
    UseMutationOptions<any, any, DeleteCameraPayload>,
    "mutationFn"
  >,
) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: deleteCamera,
    onSuccess: (_data, variables) => {
      toast.success(`Camera '${variables.camera_identifier}' deleted. Restart Viseron to apply.`);
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error
          ? `Failed to delete camera: ${error.response.data.error}`
          : `An error occurred: ${error.message}`,
      );
    },
    ...mutationOptions,
  });
};

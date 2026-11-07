import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { callGuardKeys, getProfile, saveProfile } from "../callGuard.service";
import type { ProfileBody } from "../callGuard.types";

export function useGetProfile() {
  return useQuery({ queryKey: callGuardKeys.profile(), queryFn: getProfile });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileBody) => saveProfile(body),
    onSuccess: (profile) => queryClient.setQueryData(callGuardKeys.profile(), profile),
  });
}

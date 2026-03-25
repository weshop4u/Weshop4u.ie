import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

/**
 * Hook to manage test mode state
 * Provides access to test mode status and toggle functionality
 */
export function useTestMode() {
  const queryClient = useQueryClient();

  // Query to get current test mode status
  const { data, isLoading } = useQuery({
    queryKey: ["testingMode"],
    queryFn: async () => {
      return trpc.admin.getTestingMode.useQuery().data || { enabled: false };
    },
  });

  // Mutation to toggle test mode
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return trpc.admin.toggleTestingMode.useMutation().mutate({ enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testingMode"] });
    },
  });

  return {
    testingModeEnabled: data?.enabled ?? false,
    isLoading,
    toggleTestingMode: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
}

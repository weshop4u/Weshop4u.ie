import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook to manage test mode state
 * Provides access to test mode status and toggle functionality
 */
export function useTestMode() {
  const [testingModeEnabled, setTestingModeEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch test mode status
  const { data: testModeData, isLoading } = trpc.admin.getTestingMode.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update local state when data changes
  useEffect(() => {
    if (testModeData?.enabled !== undefined) {
      setTestingModeEnabled(testModeData.enabled);
    }
  }, [testModeData?.enabled]);

  // Toggle mutation
  const toggleMutation = trpc.admin.toggleTestingMode.useMutation({
    onSuccess: (result) => {
      setTestingModeEnabled(result.enabled);
    },
    onError: (error) => {
      console.error("Failed to toggle test mode:", error);
    },
  });

  // Toggle test mode
  const toggleTestingMode = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      await toggleMutation.mutateAsync({ enabled });
    } finally {
      setIsToggling(false);
    }
  };

  return {
    testingModeEnabled,
    isLoading,
    toggleTestingMode,
    isToggling: isToggling || toggleMutation.isPending,
  };
}
